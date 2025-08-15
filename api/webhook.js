import { db } from '../lib/firebase.js';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { testStoryGeneration, checkOllamaHealth, extractGuildInfo, routeStoryToGuilds } from '../lib/story-generator.js';
import { sendStoryNotification } from '../lib/slack-service.js';
import { awardXpFromWebhook } from '../lib/user-service.js';
import { getTitleForLevel } from '../lib/xp-calculator.js';
import { transformWebhookToTicketData, extractIssueDetails } from '../lib/data-processing.js';
import { debugLog } from '../lib/req-debug.js';

// Process webhook payload with proper XP calculation and story generation
async function processWebhookPayload(payload) {
  const { issue, user } = payload;
  
  if (!user) {
    throw new Error('No user found in payload');
  }

  const userId = user.emailAddress || user.name || user.displayName || 'unknown-user';
  
  // Extract issue details
  const issueDetails = extractIssueDetails(payload);
  
  // Get user data
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  let userData;
  if (!userSnap.exists()) {
    // Create new user (always create for XP tracking)
    userData = {
      slackUserId: null, // User not registered with Slack bot yet
      jiraUsername: user.name || userId,
      displayName: user.displayName || user.name || userId,
      xp: 0,
      level: 1,
      currentTitle: getTitleForLevel(1),
      guilds: [], // Start with no guild memberships
      achievements: [],
      totalTickets: 0,
      totalBugs: 0,
      joinedAt: new Date(),
      lastActivity: new Date()
    };
    await setDoc(userRef, userData);
    console.log('✅ Created new user in database:', userId);
  } else {
    userData = userSnap.data();
    console.log('✅ Found existing user in database:', userId);
  }
  
  // Check if user is a member of any guild
  const userGuilds = userData.guilds || [];
  const hasGuildMembership = userGuilds.length > 0;
  console.log('User guild membership status:', { userId, hasGuildMembership, guilds: userGuilds });
  
  // Debug payload structure before XP calculation
  await debugLog({
    hasChangelog: !!payload.changelog,
    changelogItems: payload.changelog?.items,
    webhookEvent: payload.webhookEvent,
    issueStatus: payload.issue?.fields?.status?.name
  }, 'xp-debug-payload');
  
  // Award XP using dynamic calculation system
  const xpResult = await awardXpFromWebhook(userId, payload);
  
  // Debug XP calculation result
  await debugLog(xpResult, 'xp-result');
  
  // Get final user data
  const finalUserSnap = await getDoc(userRef);
  const finalUserData = finalUserSnap.data();
  await debugLog(finalUserData, 'user-data');
  

  return {
    userId,
    xpResult,
    userStats: {
      totalXp: finalUserData.xp,
      level: finalUserData.level,
      title: finalUserData.currentTitle
    },
    issueDetails,
    hasGuildMembership
  };
}

export default async function handler(req, res) {
  console.log('Production webhook received:', {
    method: req.method,
    body: req.body,
    headers: req.headers
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Handle missing or malformed data gracefully
    if (!req.body || !req.body.user) {
      console.log('Invalid payload structure');
      return res.status(400).json({ 
        error: 'Invalid payload', 
        received: req.body 
      });
    }

    const payload = req.body;
    
    // Process the webhook payload
    const result = await processWebhookPayload(payload);
    
    // NEW: Guild-aware story routing - ONLY for guild members
    let guildRoutingResult = null;
    let dmNotification = null;
    
    if (!result.hasGuildMembership) {
      console.log('User not in any guild, skipping all story notifications:', result.userId);
      guildRoutingResult = {
        success: true,
        routedChannels: 0,
        matchingGuilds: 0,
        message: 'User not in any guild - no notifications sent',
        skippedReason: 'no_guild_membership'
      };
    } else {
      try {
        console.log('Starting guild-aware story routing for guild member:', result.issueDetails.issueKey);
        
        // Route story to matching guild channels (with user data for membership filtering)
        const finalUserSnap = await getDoc(doc(db, 'users', result.userId));
        const currentUserData = finalUserSnap.data();
        guildRoutingResult = await routeStoryToGuilds(payload, currentUserData);
        await debugLog(guildRoutingResult, 'guild-routing-result');
        
        console.log('Guild routing completed:', {
          routedChannels: guildRoutingResult.routedChannels,
          matchingGuilds: guildRoutingResult.matchingGuilds,
          success: guildRoutingResult.success
        });

        // Fallback to DM if no guild routing occurred
        if (guildRoutingResult.routedChannels === 0) {
          console.log('No guilds matched, sending DM notification as fallback');
          
          try {
            const ticketInfo = {
              issueKey: result.issueDetails.issueKey,
              issueUrl: result.issueDetails.issueUrl,
              summary: result.issueDetails.summary
            };
            
            // Generate individual story for DM (since no guild routing happened)
            const ticketData = transformWebhookToTicketData(payload);
            const [ollamaHealth, guildInfo, storyResult] = await Promise.all([
              checkOllamaHealth(),
              extractGuildInfo(payload.issue),
              testStoryGeneration(ticketData)
            ]);
            
            const storyGeneration = {
              narrative: storyResult,
              guildInfo: guildInfo,
              ollamaHealth: ollamaHealth,
              ticketData: ticketData,
              xpAward: result.xpResult,
              timestamp: new Date().toISOString()
            };
            
            dmNotification = await sendStoryNotification(
              storyGeneration,
              ticketInfo,
              payload.user
            );
            
            console.log('DM notification result:', dmNotification);
          } catch (dmError) {
            console.error('DM notification failed:', dmError);
            dmNotification = {
              success: false,
              error: dmError.message
            };
          }
        } else {
          // Guild routing succeeded, skip additional DM to avoid duplicates
          console.log('Guild routing successful, skipping additional DM notification to avoid duplicates');
          dmNotification = {
            success: true,
            skipped: true,
            reason: 'guild_routing_successful'
          };
        }
        
      } catch (routingError) {
        console.error('Guild routing failed for guild member, falling back to DM only:', routingError);
        
        // Critical fallback: Always ensure guild member gets story via DM
        try {
          const ticketInfo = {
            issueKey: result.issueDetails.issueKey,
            issueUrl: result.issueDetails.issueUrl,
            summary: result.issueDetails.summary
          };
          
          // Generate story for fallback DM
          const ticketData = transformWebhookToTicketData(payload);
          const [ollamaHealth, guildInfo, storyResult] = await Promise.all([
            checkOllamaHealth(),
            extractGuildInfo(payload.issue),
            testStoryGeneration(ticketData)
          ]);
          
          const storyGeneration = {
            narrative: storyResult,
            guildInfo: guildInfo,
            ollamaHealth: ollamaHealth,
            ticketData: ticketData,
            xpAward: result.xpResult,
            timestamp: new Date().toISOString()
          };
          
          dmNotification = await sendStoryNotification(
            storyGeneration,
            ticketInfo,
            payload.user
          );
          
          console.log('Fallback DM notification sent:', dmNotification);
        } catch (fallbackError) {
          console.error('Even fallback DM failed:', fallbackError);
          dmNotification = {
            success: false,
            error: fallbackError.message
          };
        }
        
        guildRoutingResult = {
          success: false,
          error: routingError.message,
          routedChannels: 0
        };
      }
    } // End of guild member check
    
    const responseData = {
      success: true,
      message: 'Production webhook processed successfully',
      processingDetails: {
        userAffected: result.userId,
        xpAwarded: result.xpResult.xpAwarded,
        xpReason: result.xpResult.reason,
        levelUp: result.xpResult.leveledUp ? {
          oldLevel: result.xpResult.oldLevel,
          newLevel: result.xpResult.newLevel,
          oldTitle: result.xpResult.oldTitle,
          newTitle: result.xpResult.newTitle
        } : null,
        userStats: result.userStats
      },
      issueDetails: result.issueDetails,
      guildRouting: guildRoutingResult,
      dmNotification: dmNotification
    };
    
    console.log('Production webhook processed successfully');
    res.status(200).json(responseData);
    
  } catch (error) {
    console.error('Production webhook error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}


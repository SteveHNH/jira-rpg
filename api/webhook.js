import { db } from '../lib/firebase.js';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { testStoryGeneration, checkOllamaHealth, extractGuildInfo, routeStoryToGuilds } from '../lib/story-generator.js';
import { sendStoryNotification } from '../lib/slack-service.js';
import { awardXpFromWebhook, getUserByJiraIdentifier, createUserFromWebhook } from '../lib/user-service.js';
import { getTitleForLevel } from '../lib/xp-calculator.js';
import { transformWebhookToTicketData, extractIssueDetails } from '../lib/data-processing.js';
import { debugLog } from '../lib/req-debug.js';

// Enhanced webhook processing with flexible user lookup and auto-creation
async function processWebhookPayload(payload) {
  const { issue, user } = payload;
  
  if (!user) {
    throw new Error('No user found in payload');
  }

  // Enhanced user lookup using multiple identifiers
  let existingUser = await getUserByJiraIdentifier(user);
  let userData;
  let userId;
  
  if (existingUser) {
    // User found using enhanced lookup
    userData = existingUser;
    userId = existingUser.id;
    console.log(`Found existing user: ${userId} via enhanced lookup`);
  } else {
    // Auto-create user from webhook data
    console.log('User not found, auto-creating from webhook data:', {
      name: user.name,
      accountId: user.accountId,
      emailAddress: user.emailAddress,
      displayName: user.displayName
    });
    
    userData = await createUserFromWebhook(user);
    userId = userData.id;
    console.log(`Auto-created user: ${userId}`);
  }
  
  // Extract issue details
  const issueDetails = extractIssueDetails(payload);
  
  // Debug payload structure before XP calculation
  await debugLog({
    userId: userId,
    userLookupMethod: existingUser ? 'enhanced-lookup' : 'auto-created',
    hasChangelog: !!payload.changelog,
    changelogItems: payload.changelog?.items,
    webhookEvent: payload.webhookEvent,
    issueStatus: payload.issue?.fields?.status?.name
  }, 'xp-debug-payload');
  
  // Award XP using dynamic calculation system
  const xpResult = await awardXpFromWebhook(userId, payload);
  
  // Debug XP calculation result
  await debugLog(xpResult, 'xp-result');
  
  // Get final user data after XP award
  const userRef = doc(db, 'users', userId);
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
    userCreated: !existingUser // Flag indicating if user was auto-created
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
    
    // NEW: Guild-aware story routing
    let guildRoutingResult = null;
    let dmNotification = null;
    
    try {
      console.log('Starting guild-aware story routing for issue:', result.issueDetails.issueKey);
      
      // Route story to matching guild channels
      guildRoutingResult = await routeStoryToGuilds(payload);
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
        // Guild routing succeeded, also send DM as backup
        console.log('Guild routing successful, sending additional DM notification');
        
        try {
          const ticketInfo = {
            issueKey: result.issueDetails.issueKey,
            issueUrl: result.issueDetails.issueUrl,
            summary: result.issueDetails.summary
          };
          
          // Use the same story data from guild routing for DM
          if (guildRoutingResult.storyData) {
            dmNotification = await sendStoryNotification(
              guildRoutingResult.storyData,
              ticketInfo,
              payload.user
            );
            console.log('Additional DM notification sent:', dmNotification);
          }
        } catch (dmError) {
          console.error('Additional DM notification failed (non-critical):', dmError);
          dmNotification = {
            success: false,
            error: dmError.message
          };
        }
      }
      
    } catch (routingError) {
      console.error('Guild routing failed, falling back to DM only:', routingError);
      
      // Critical fallback: Always ensure user gets story via DM
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


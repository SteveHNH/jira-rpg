import { db } from '../lib/firebase.js';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { testStoryGeneration, checkOllamaHealth, extractGuildInfo } from '../lib/story-generator.js';
import { sendStoryNotification } from '../lib/slack-service.js';
import { awardXpFromWebhook, getUserBySlackId } from '../lib/user-service.js';
import { calculateLevel, getTitleForLevel } from '../lib/xp-calculator.js';
import { transformWebhookToTicketData, extractIssueDetails } from '../lib/data-processing.js';

// RequestBin URL for debugging responses
const REQUEST_BIN_URL = 'https://webhook.site/b2e9fb5c-5000-4032-b954-070261bf6152';

// Mock JIRA webhook payloads for testing - JIRAPLAY hackathon project
const mockPayloads = {
  inProgress: {
    webhookEvent: 'jira:issue_updated',
    issue: {
      key: 'JIRAPLAY-123',
      fields: {
        summary: 'Hackathon test issue moved to In Progress',
        issuetype: { name: 'Story' },
        priority: { name: 'Medium' },
        status: { name: 'In Progress' },
        project: { key: 'JIRAPLAY', name: 'JIRAPLAY' },
        components: [{ name: 'hackathon-test' }],
        customfield_10016: 3, // Story points
        assignee: {
          name: 'hackathon.user',
          emailAddress: 'hackathon.user@company.com',
          displayName: 'Hackathon User'
        }
      }
    },
    user: {
      name: 'hackathon.user',
      emailAddress: 'hackathon.user@company.com',
      displayName: 'Hackathon User'
    },
    changelog: {
      items: [
        {
          field: 'status',
          fromString: 'To Do',
          toString: 'In Progress'
        }
      ]
    }
  },
  done: {
    webhookEvent: 'jira:issue_updated',
    issue: {
      key: 'JIRAPLAY-124',
      fields: {
        summary: 'Hackathon test issue completed',
        issuetype: { name: 'Story' },
        priority: { name: 'High' },
        status: { name: 'Done' },
        project: { key: 'JIRAPLAY', name: 'JIRAPLAY' },
        components: [{ name: 'hackathon-test' }],
        customfield_10016: 5, // Story points
        assignee: {
          name: 'hackathon.user',
          emailAddress: 'hackathon.user@company.com',
          displayName: 'Hackathon User'
        }
      }
    },
    user: {
      name: 'hackathon.user',
      emailAddress: 'hackathon.user@company.com',
      displayName: 'Hackathon User'
    },
    changelog: {
      items: [
        {
          field: 'status',
          fromString: 'In Progress',
          toString: 'Done'
        }
      ]
    }
  }
};


// Process webhook payload with proper XP calculation
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
    // Create new user
    userData = {
      slackUserId: null,
      jiraUsername: user.name || userId,
      displayName: user.displayName || user.name || userId,
      xp: 0,
      level: 1,
      currentTitle: getTitleForLevel(1),
      joinedAt: new Date(),
      lastActivity: new Date()
    };
    await setDoc(userRef, userData);
  } else {
    userData = userSnap.data();
  }
  
  // Award XP using new dynamic calculation system
  const xpResult = await awardXpFromWebhook(userId, payload);
  
  // Get final user data
  const finalUserSnap = await getDoc(userRef);
  const finalUserData = finalUserSnap.data();
  
  return {
    userId,
    xpResult,
    userStats: {
      totalXp: finalUserData.xp,
      level: finalUserData.level,
      title: finalUserData.currentTitle
    },
    issueDetails
  };
}

export default async function handler(req, res) {
  console.log('Test endpoint called:', {
    method: req.method,
    query: req.query,
    body: req.body
  });

  try {
    // Handle GET request - show available test scenarios
    if (req.method === 'GET') {
      const scenarios = Object.keys(mockPayloads);
      return res.status(200).json({
        message: 'JIRA RPG Webhook Test Endpoint',
        availableScenarios: scenarios,
        usage: {
          testScenario: 'POST /api/test?scenario=<scenarioName>',
          customPayload: 'POST /api/test (with custom payload in body)'
        },
        scenarios: Object.keys(mockPayloads).map(key => ({
          name: key,
          description: mockPayloads[key].webhookEvent,
          issueKey: mockPayloads[key].issue?.key
        }))
      });
    }

    // Handle POST request - process webhook
    if (req.method === 'POST') {
      let payload;
      
      // Check if scenario parameter is provided
      const scenario = req.query.scenario;
      if (scenario && mockPayloads[scenario]) {
        payload = mockPayloads[scenario];
        console.log(`Using mock scenario: ${scenario}`);
      } else if (req.body) {
        payload = req.body;
        console.log('Using custom payload from request body');
      } else {
        return res.status(400).json({
          error: 'No payload provided. Use ?scenario=<name> or send payload in body',
          availableScenarios: Object.keys(mockPayloads)
        });
      }

      // Process the payload
      const result = await processWebhookPayload(payload);
      
      // Generate story from the JIRA payload
      let storyGeneration = null;
      let slackNotification = null;
      try {
        console.log('Generating fantasy story for issue:', result.issueDetails.issueKey);
        
        // Transform webhook payload to ticket data format
        const ticketData = transformWebhookToTicketData(payload);
        console.log('Transformed ticket data:', ticketData);
        
        const [ollamaHealth, guildInfo, storyResult] = await Promise.all([
          checkOllamaHealth(),
          extractGuildInfo(payload.issue),
          testStoryGeneration(ticketData) // Pass transformed data instead of using hardcoded test data
        ]);
        
        storyGeneration = {
          narrative: storyResult,
          guildInfo: guildInfo,
          ollamaHealth: ollamaHealth,
          ticketData: ticketData, // Include transformed data for debugging
          xpAward: result.xpResult,
          timestamp: new Date().toISOString()
        };
        
        console.log('Story generation completed successfully');
        
        // Send Slack notification with the generated story
        try {
          console.log('Sending Slack notification for story...');
          const ticketInfo = {
            issueKey: result.issueDetails.issueKey,
            issueUrl: result.issueDetails.issueUrl,
            summary: result.issueDetails.summary
          };
          
          slackNotification = await sendStoryNotification(
            storyGeneration,
            ticketInfo,
            payload.user
          );
          
          console.log('Slack notification result:', slackNotification);
        } catch (slackError) {
          console.error('Slack notification failed:', slackError);
          slackNotification = {
            success: false,
            error: slackError.message
          };
        }
      } catch (storyError) {
        console.error('Story generation failed:', storyError);
        storyGeneration = {
          error: 'Story generation failed',
          message: storyError.message,
          timestamp: new Date().toISOString()
        };
      }
      
      const responseData = {
        success: true,
        message: 'Test webhook processed successfully',
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
        storyGeneration: storyGeneration,
        slackNotification: slackNotification,
        payload: payload
      };

      // Forward webhook processing response to RequestBin for debugging
      try {
        await fetch(REQUEST_BIN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Source': 'jira-rpg-webhook-processing'
          },
          body: JSON.stringify({
            timestamp: new Date().toISOString(),
            endpoint: '/api/test',
            type: 'webhook-processing',
            response: responseData
          })
        });
        console.log('Webhook processing response forwarded to RequestBin successfully');
      } catch (requestBinError) {
        console.error('Failed to forward webhook processing to RequestBin:', requestBinError);
      }

      // Forward story generation results to RequestBin for debugging
      if (storyGeneration) {
        try {
          await fetch(REQUEST_BIN_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Source': 'jira-rpg-story-generation'
            },
            body: JSON.stringify({
              timestamp: new Date().toISOString(),
              endpoint: '/api/test',
              type: 'story-generation',
              issueKey: result.issueDetails.issueKey,
              storyGeneration: storyGeneration
            })
          });
          console.log('Story generation response forwarded to RequestBin successfully');
        } catch (requestBinError) {
          console.error('Failed to forward story generation to RequestBin:', requestBinError);
        }
      }
      
      return res.status(200).json(responseData);
    }

    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Test endpoint error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
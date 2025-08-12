import { db } from '../lib/firebase.js';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { testStoryGeneration, checkOllamaHealth, extractGuildInfo } from '../lib/story-generator.js';

// RequestBin URL for debugging responses
const REQUEST_BIN_URL = 'https://eod4tmlsrs55sol.m.pipedream.net';

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

// Extract issue details from JIRA payload
function extractIssueDetails(payload) {
  const { issue } = payload;
  
  if (!issue) {
    return {};
  }

  const fields = issue.fields || {};
  
  return {
    eventType: payload.webhookEvent,
    issueKey: issue.key,
    project: fields.project?.key || fields.project?.name,
    component: fields.components && fields.components.length > 0 
      ? fields.components.map(c => c.name).join(', ') 
      : null,
    storyPoints: fields.customfield_10016 || fields.story_points || null,
    assignee: fields.assignee ? {
      name: fields.assignee.name,
      displayName: fields.assignee.displayName,
      emailAddress: fields.assignee.emailAddress
    } : null,
    description: fields.summary || fields.description || null,
    status: fields.status?.name,
    issueType: fields.issuetype?.name,
    priority: fields.priority?.name
  };
}

// Transform webhook payload to story generator format
function transformWebhookToTicketData(payload) {
  const issue = payload.issue;
  const fields = issue?.fields || {};
  
  // Helper function to extract description text from JIRA's complex description format
  function extractDescription(description) {
    if (!description) return null;
    if (typeof description === 'string') return description;
    if (description.content && Array.isArray(description.content)) {
      return description.content
        .map(block => {
          if (block.content && Array.isArray(block.content)) {
            return block.content.map(item => item.text || '').join(' ');
          }
          return '';
        })
        .join(' ')
        .trim();
    }
    return null;
  }
  
  return {
    assignee: fields.assignee?.displayName || 'Unknown Hero',
    title: fields.summary || 'Mysterious Quest',
    description: extractDescription(fields.description) || 'A quest awaits...',
    status: fields.status?.name || 'Unknown',
    reporter: payload.user?.displayName || 'Quest Giver',
    comments: `Event: ${payload.webhookEvent}`, 
    ticketKey: issue?.key || 'UNKNOWN',
    ticketType: fields.issuetype?.name || 'Task',
    priority: fields.priority?.name || 'Medium',
    storyPoints: fields.customfield_10016 || null,
    project: fields.project?.key || 'UNKNOWN',
    components: fields.components?.map(c => c.name) || [],
    labels: fields.labels || []
  };
}

// Process webhook payload (reusing logic from webhook.js)
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
      currentTitle: "Novice Adventurer",
      joinedAt: new Date(),
      lastActivity: new Date()
    };
    await setDoc(userRef, userData);
  } else {
    userData = userSnap.data();
  }
  
  // Award XP (simplified - just give 50 XP for any webhook)
  const xpAwarded = 50;
  await updateDoc(userRef, {
    xp: increment(xpAwarded),
    lastActivity: new Date()
  });
  
  // Get updated user data
  const updatedUserSnap = await getDoc(userRef);
  const updatedUserData = updatedUserSnap.data();
  
  return {
    userId,
    xpAwarded,
    userStats: {
      totalXp: updatedUserData.xp,
      level: updatedUserData.level,
      title: updatedUserData.currentTitle
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
          timestamp: new Date().toISOString()
        };
        
        console.log('Story generation completed successfully');
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
          eventType: result.eventType,
          issueKey: result.issueKey,
          xpAwarded: result.xpAwarded,
          userStats: result.userStats
        },
        issueDetails: result.issueDetails,
        storyGeneration: storyGeneration,
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
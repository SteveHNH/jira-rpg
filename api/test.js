import { db } from '../lib/firebase.js';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

// Mock JIRA webhook payloads for testing
const mockPayloads = {
  issueCreated: {
    webhookEvent: 'jira:issue_created',
    issue: {
      key: 'TEST-123',
      fields: {
        summary: 'Test issue created',
        issuetype: { name: 'Task' },
        priority: { name: 'Medium' },
        status: { name: 'To Do' }
      }
    },
    user: {
      name: 'test.user',
      emailAddress: 'test.user@company.com',
      displayName: 'Test User'
    }
  },
  issueAssigned: {
    webhookEvent: 'jira:issue_updated',
    issue: {
      key: 'TEST-124',
      fields: {
        summary: 'Test issue assigned',
        issuetype: { name: 'Story' },
        priority: { name: 'High' },
        status: { name: 'To Do' },
        assignee: {
          name: 'test.user',
          emailAddress: 'test.user@company.com',
          displayName: 'Test User'
        }
      }
    },
    user: {
      name: 'test.user',
      emailAddress: 'test.user@company.com',
      displayName: 'Test User'
    },
    changelog: {
      items: [
        {
          field: 'assignee',
          fromString: null,
          toString: 'test.user'
        }
      ]
    }
  },
  issueInProgress: {
    webhookEvent: 'jira:issue_updated',
    issue: {
      key: 'TEST-125',
      fields: {
        summary: 'Test issue in progress',
        issuetype: { name: 'Bug' },
        priority: { name: 'Critical' },
        status: { name: 'In Progress' }
      }
    },
    user: {
      name: 'test.user',
      emailAddress: 'test.user@company.com',
      displayName: 'Test User'
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
  issueCompleted: {
    webhookEvent: 'jira:issue_updated',
    issue: {
      key: 'TEST-126',
      fields: {
        summary: 'Test issue completed',
        issuetype: { name: 'Story' },
        priority: { name: 'Medium' },
        status: { name: 'Done' },
        customfield_10016: 5 // Story points
      }
    },
    user: {
      name: 'test.user',
      emailAddress: 'test.user@company.com',
      displayName: 'Test User'
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
      
      return res.status(200).json({
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
        payload: payload
      });
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
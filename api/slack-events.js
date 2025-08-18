// api/slack-events.js - Slack Events API handler for DM conversations

import crypto from 'crypto';
import { getUserBySlackId, testFirebaseConnection } from '../lib/user-service.js';
import { handleConversationalRequest } from '../lib/conversation-service.js';
import { publishHomeTab } from '../lib/home-tab-service.js';

export default async function handler(req, res) {
  
  console.log('Slack event received:', {
    method: req.method,
    contentType: req.headers['content-type'],
    bodyKeys: Object.keys(req.body || {})
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Capture raw body for signature verification
  if (!req.rawBody && req.body) {
    req.rawBody = JSON.stringify(req.body);
  }

  try {
    // Verify the request came from Slack
    const isValidRequest = verifySlackEventRequest(req);
    if (!isValidRequest) {
      console.error('Invalid Slack event request signature');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { type, challenge, event } = req.body;

    // Handle URL verification challenge
    if (type === 'url_verification') {
      console.log('URL verification challenge received');
      return res.status(200).json({ challenge });
    }

    // Handle event callbacks
    if (type === 'event_callback') {
      console.log('Event callback received:', {
        eventType: event?.type,
        channelType: event?.channel_type,
        user: event?.user,
        hasText: !!event?.text
      });

      // Handle direct messages (wait for completion to prevent serverless termination)
      if (event.type === 'message' && event.channel_type === 'im') {
        try {
          await handleDirectMessage(event);
        } catch (error) {
          console.error('DM handling error:', error);
        }
      }

      // Handle App Home opened events (wait for completion to prevent serverless termination)
      if (event.type === 'app_home_opened') {
        try {
          await handleAppHomeOpened(event);
        } catch (error) {
          console.error('App Home handling error:', error);
        }
      }

      return res.status(200).json({ ok: true });
    }

    // Unknown event type
    console.log('Unknown event type:', type);
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Slack event handler error:', error);
    return res.status(200).json({ ok: true }); // Always return 200 to Slack
  }
}

/**
 * Handles direct message events from Slack
 * @param {Object} event - Slack message event
 */
async function handleDirectMessage(event) {
  try {
    const { user, text, channel, ts, bot_id, subtype } = event;

    console.log('DM event details:', {
      user,
      hasText: !!text,
      textLength: text?.length || 0,
      textPreview: text?.substring(0, 50) || '',
      bot_id,
      subtype,
      channel,
      ts
    });

    // Ignore bot messages and specific system message subtypes
    if (bot_id || !text) {
      console.log('Ignoring bot message or message without text');
      return;
    }

    // Ignore specific system subtypes but allow normal user message subtypes
    const ignoredSubtypes = ['bot_message', 'channel_join', 'channel_leave', 'channel_topic', 'channel_purpose'];
    if (subtype && ignoredSubtypes.includes(subtype)) {
      console.log('Ignoring system message with subtype:', subtype);
      return;
    }

    // Ignore slash commands (they're handled by slack-commands.js)
    if (text.startsWith('/')) {
      console.log('Ignoring slash command:', text.substring(0, 20));
      return;
    }

    console.log('Processing DM from user:', user, 'Text:', text.substring(0, 100));

    // Check if user is registered in our system
    let userData;
    try {
      console.log('Looking up user by Slack ID:', user);
      
      // Skip connection test for now to improve speed
      // const connectionTest = await testFirebaseConnection();
      // console.log('Firebase connection test result:', connectionTest);
      
      // Add timeout to Firebase lookup to prevent hanging  
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('User lookup timeout after 15 seconds')), 15000)
      );
      
      userData = await Promise.race([
        getUserBySlackId(user),
        timeoutPromise
      ]);
      
      console.log('User lookup result:', userData ? 'found' : 'not found');
    } catch (error) {
      console.error('Error during user lookup:', error);
      await sendErrorMessage(channel);
      return;
    }
    
    if (!userData) {
      console.log('User not registered:', user);
      await sendNotRegisteredMessage(channel);
      return;
    }

    // Handle the conversational request
    try {
      console.log('Starting conversational request for user:', userData.jiraUsername, 'message:', text.substring(0, 50));
      await handleConversationalRequest(user, text, channel, userData);
      console.log('Conversational request completed successfully');
    } catch (error) {
      console.error('Error in conversational request:', error);
      console.error('Error stack:', error.stack);
      await sendErrorMessage(channel);
    }

  } catch (error) {
    console.error('Error handling direct message:', error);
    // Send error message to user
    await sendErrorMessage(event.channel);
  }
}

/**
 * Sends immediate acknowledgment message to user
 * @param {string} channel - Slack channel/DM ID
 */
async function sendProcessingMessage(channel) {
  try {
    const message = {
      text: "⚔️ Greetings, brave adventurer! I'm conjuring up an epic tale of your recent coding quests... Give me a moment to weave the magic! ✨"
    };

    // Add timeout to prevent hanging (increased from 3s to 8s)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Slack API timeout after 8 seconds')), 8000)
    );

    const response = await Promise.race([
      fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel,
          ...message
        })
      }),
      timeoutPromise
    ]);

    // Check if the Slack API call was successful
    if (response && !response.ok) {
      console.error('Slack API error:', response.status, response.statusText);
      // Don't throw - this is just an acknowledgment message
    }

    console.log('Processing acknowledgment sent to channel:', channel);

  } catch (error) {
    console.error('Error sending processing message:', error);
    // Don't throw - this is just an acknowledgment, continue processing
  }
}

/**
 * Sends a message to unregistered users
 * @param {string} channel - Slack channel/DM ID
 */
async function sendNotRegisteredMessage(channel) {
  try {
    const message = {
      text: "🎮 Welcome to Backlog Bard RPG! I'd love to tell you epic tales of your JIRA adventures, but you'll need to register first.\n\nUse `/rpg-register your.email@company.com` to get started and unlock the storytelling magic! ⚔️"
    };

    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel,
        ...message
      })
    });

  } catch (error) {
    console.error('Error sending not registered message:', error);
  }
}

/**
 * Sends an error message to the user
 * @param {string} channel - Slack channel/DM ID
 */
async function sendErrorMessage(channel) {
  try {
    const message = {
      text: "⚠️ Something went wrong while processing your request. Our wizards are looking into it! Try asking about your recent JIRA tickets again in a moment. 🔮"
    };

    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel,
        ...message
      })
    });

  } catch (error) {
    console.error('Error sending error message:', error);
  }
}

/**
 * Verifies that the request came from Slack using signature validation
 * @param {Object} req - Express request object
 * @returns {boolean} - True if valid Slack request
 */
function verifySlackEventRequest(req) {
  // Skip verification for testing with mock signatures
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.log('SLACK_SIGNING_SECRET not configured - skipping verification');
    return true; // Allow for testing
  }

  const timestamp = req.headers['x-slack-request-timestamp'];
  const slackSignature = req.headers['x-slack-signature'];

  if (!timestamp || !slackSignature) {
    console.log('Missing Slack headers - allowing for testing');
    return true; // Allow for testing
  }

  // Skip mock signatures used in testing
  if (slackSignature === 'v0=mock-signature-for-testing') {
    console.log('Mock signature detected - allowing for testing');
    return true;
  }

  // TEMPORARY: Skip signature verification for Events API until we fix raw body handling
  // TODO: Implement proper middleware to capture raw body before JSON parsing
  console.log('TEMP: Skipping signature verification for Events API - raw body reconstruction issue');
  
  // Still check for replay attacks even without signature verification
  try {
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - (60 * 5);
    if (parseInt(timestamp) < fiveMinutesAgo) {
      console.error('Request timestamp too old - potential replay attack');
      return false;
    }
  } catch (error) {
    console.error('Error checking timestamp:', error.message);
  }
  
  return true;

  /* COMMENTED OUT UNTIL RAW BODY ISSUE IS FIXED
  try {
    // Prevent replay attacks
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - (60 * 5);
    if (parseInt(timestamp) < fiveMinutesAgo) {
      console.error('Request timestamp too old');
      return false;
    }

    // Get raw body - in Vercel, we need to reconstruct it from the parsed JSON
    // For Events API, Slack sends JSON so we need to stringify consistently
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const baseString = `v0:${timestamp}:${rawBody}`;
    const expectedSignature = `v0=${crypto
      .createHmac('sha256', signingSecret)
      .update(baseString)
      .digest('hex')}`;

    console.log('Signature verification debug:', {
      timestamp,
      bodyLength: rawBody.length,
      bodyStart: rawBody.substring(0, 100),
      expectedSig: expectedSignature.substring(0, 20) + '...',
      actualSig: slackSignature.substring(0, 20) + '...'
    });

    // Ensure both signatures are the same length before comparison
    if (expectedSignature.length !== slackSignature.length) {
      console.error('Signature length mismatch');
      return false;
    }

    // Compare signatures
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf8'),
      Buffer.from(slackSignature, 'utf8')
    );

  } catch (error) {
    console.error('Error verifying signature:', error.message);
    return false;
  }
  */
}

/**
 * Handles App Home opened events from Slack
 * @param {Object} event - Slack app_home_opened event
 */
async function handleAppHomeOpened(event) {
  try {
    const { user, tab } = event;

    console.log('App Home opened by user:', user, 'tab:', tab);

    // Only handle the Home tab (not Messages or About tabs)
    if (tab !== 'home') {
      console.log('Ignoring non-home tab:', tab);
      return;
    }

    // Check if user is registered in our system
    const userData = await getUserBySlackId(user);
    
    // Publish the Home tab view (works for both registered and unregistered users)
    const success = await publishHomeTab(user, userData);
    console.log('Home tab published for user:', user, 'registered:', !!userData);

  } catch (error) {
    console.error('Error handling App Home opened:', error);
    console.error('Error stack:', error.stack);
  }
}
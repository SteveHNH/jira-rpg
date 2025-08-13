// lib/slack.js - Slack API helper functions

import crypto from 'crypto';

/**
 * Verifies that a request came from Slack using the signing secret
 * @param {Object} req - Express request object
 * @returns {boolean} - Whether the request is valid
 */
export function verifySlackRequest(req) {
  const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
  
  if (!slackSigningSecret) {
    console.error('SLACK_SIGNING_SECRET not found in environment variables');
    return false;
  }

  // Get Slack signature and timestamp from headers
  const slackSignature = req.headers['x-slack-signature'];
  const slackTimestamp = req.headers['x-slack-request-timestamp'];

  if (!slackSignature || !slackTimestamp) {
    console.error('Missing Slack signature or timestamp headers');
    return false;
  }

  // Check if request is too old (more than 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - slackTimestamp) > 300) {
    console.error('Request timestamp too old');
    return false;
  }

  // Create base string for signature verification
  const body = typeof req.body === 'string' ? req.body : new URLSearchParams(req.body).toString();
  const baseString = `v0:${slackTimestamp}:${body}`;

  // Generate expected signature
  const expectedSignature = 'v0=' + crypto
    .createHmac('sha256', slackSigningSecret)
    .update(baseString)
    .digest('hex');

  // Compare signatures using crypto.timingSafeEqual to prevent timing attacks
  const actualSignature = slackSignature;
  
  if (expectedSignature.length !== actualSignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(actualSignature)
  );
}

/**
 * Posts a message to a Slack channel
 * @param {string} channelId - Slack channel ID
 * @param {string} text - Message text
 * @param {Object} options - Additional message options
 * @returns {Promise<Object>} - Slack API response
 */
export async function postMessage(channelId, text, options = {}) {
  const slackBotToken = process.env.SLACK_BOT_TOKEN;
  
  if (!slackBotToken) {
    throw new Error('SLACK_BOT_TOKEN not found in environment variables');
  }

  const payload = {
    channel: channelId,
    text: text,
    ...options
  };

  console.log('Posting to Slack:', { channelId, text: text.substring(0, 100) + '...' });

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${slackBotToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    console.log('Message posted successfully:', data.ts);
    return data;

  } catch (error) {
    console.error('Failed to post Slack message:', error);
    throw error;
  }
}

/**
 * Posts a rich message with formatting to Slack
 * @param {string} channelId - Slack channel ID  
 * @param {string} story - Fantasy story text
 * @param {Object} ticketData - JIRA ticket information
 * @returns {Promise<Object>} - Slack API response
 */
export async function postStoryMessage(channelId, story, ticketData) {
  const { assignee, ticketKey, title, status, priority, guildName } = ticketData;
  
  // Create rich message with blocks
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: story
      }
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🎯 *${ticketKey}:* ${title} | 👤 *${assignee}* | 📊 *${status}* | ⚡ *${priority}*`
        }
      ]
    }
  ];

  // Add guild info if available
  if (guildName) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🏰 *${guildName}*`
        }
      ]
    });
  }

  return await postMessage(channelId, story, {
    blocks: blocks,
    unfurl_links: false,
    unfurl_media: false
  });
}

/**
 * Posts a level-up celebration message
 * @param {string} channelId - Slack channel ID
 * @param {Object} levelUpData - Level up information
 * @returns {Promise<Object>} - Slack API response
 */
export async function postLevelUpMessage(channelId, levelUpData) {
  const { userName, oldLevel, newLevel, newTitle, totalXP } = levelUpData;
  
  const celebration = `🎉 **LEVEL UP!** 🎉

🏆 Congratulations ${userName}! 
⬆️ You've advanced from Level ${oldLevel} to **Level ${newLevel}**!
👑 You are now a **${newTitle}**!
📊 Total XP: ${totalXP}

Keep up the epic work! ⚔️✨`;

  return await postMessage(channelId, celebration, {
    unfurl_links: false
  });
}

/**
 * Gets user information from Slack
 * @param {string} userId - Slack user ID
 * @returns {Promise<Object>} - User information
 */
export async function getUserInfo(userId) {
  const slackBotToken = process.env.SLACK_BOT_TOKEN;
  
  if (!slackBotToken) {
    throw new Error('SLACK_BOT_TOKEN not found');
  }

  try {
    const response = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
      headers: {
        'Authorization': `Bearer ${slackBotToken}`
      }
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    return data.user;

  } catch (error) {
    console.error('Failed to get user info:', error);
    throw error;
  }
}

/**
 * Gets channel information from Slack
 * @param {string} channelId - Slack channel ID
 * @returns {Promise<Object>} - Channel information
 */
export async function getChannelInfo(channelId) {
  const slackBotToken = process.env.SLACK_BOT_TOKEN;
  
  if (!slackBotToken) {
    throw new Error('SLACK_BOT_TOKEN not found');
  }

  try {
    const response = await fetch(`https://slack.com/api/conversations.info?channel=${channelId}`, {
      headers: {
        'Authorization': `Bearer ${slackBotToken}`
      }
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    return data.channel;

  } catch (error) {
    console.error('Failed to get channel info:', error);
    throw error;
  }
}

/**
 * Responds to a slash command with a delayed response
 * @param {string} responseUrl - Slack response URL from command
 * @param {Object} message - Message to send
 * @returns {Promise<Object>} - Response
 */
export async function respondToCommand(responseUrl, message) {
  try {
    const response = await fetch(responseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Response failed: ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error('Failed to respond to command:', error);
    throw error;
  }
}

/**
 * Formats a user mention for Slack
 * @param {string} userId - Slack user ID
 * @returns {string} - Formatted mention
 */
export function formatUserMention(userId) {
  return `<@${userId}>`;
}

/**
 * Formats a channel mention for Slack
 * @param {string} channelId - Slack channel ID  
 * @returns {string} - Formatted channel mention
 */
export function formatChannelMention(channelId) {
  return `<#${channelId}>`;
}

/**
 * Health check for Slack API connectivity
 * @returns {Promise<Object>} - Health status
 */
export async function checkSlackHealth() {
  const slackBotToken = process.env.SLACK_BOT_TOKEN;
  
  if (!slackBotToken) {
    return { healthy: false, error: 'Missing SLACK_BOT_TOKEN' };
  }

  try {
    const response = await fetch('https://slack.com/api/auth.test', {
      headers: {
        'Authorization': `Bearer ${slackBotToken}`
      }
    });

    const data = await response.json();

    return {
      healthy: data.ok,
      botUserId: data.user_id,
      teamName: data.team,
      error: data.ok ? null : data.error
    };

  } catch (error) {
    return {
      healthy: false,
      error: error.message
    };
  }
}

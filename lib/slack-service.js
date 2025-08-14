// lib/slack-service.js - Slack Bot Integration for JIRA RPG

import { db } from './firebase.js';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getUserBySlackId } from './user-service.js';
import { getGuildByName, getGuildsByUser } from './guild-service.js';

/**
 * Sends a story notification to Slack after JIRA ticket update
 * @param {Object} storyData - Generated story and metadata
 * @param {Object} ticketInfo - JIRA ticket information
 * @param {Object} userInfo - User information from webhook
 * @returns {Promise<Object>} - Success/failure result
 */
export async function sendStoryNotification(storyData, ticketInfo, userInfo) {
  try {
    // Find the user's Slack ID from their JIRA email/username
    const slackUserId = await findSlackUserByJiraInfo(userInfo);
    
    if (!slackUserId) {
      console.log('No Slack user found for JIRA user:', userInfo);
      return {
        success: false,
        reason: 'user_not_found',
        message: 'User not registered with Slack bot'
      };
    }

    // Format the message with story and JIRA link
    const message = formatStoryMessage(storyData, ticketInfo);
    
    // Send message to user's DM
    const result = await sendSlackMessage(slackUserId, message);
    
    return {
      success: true,
      slackUserId,
      messageResult: result
    };
    
  } catch (error) {
    console.error('Failed to send story notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Finds a Slack user ID based on JIRA user information
 * @param {Object} jiraUser - JIRA user info from webhook
 * @returns {Promise<string|null>} - Slack user ID or null if not found
 */
async function findSlackUserByJiraInfo(jiraUser) {
  const { emailAddress, name, displayName } = jiraUser;
  
  // Try to find user by email first (most reliable)
  if (emailAddress) {
    const userByEmail = await findUserByJiraEmail(emailAddress);
    if (userByEmail) {
      return userByEmail.slackUserId;
    }
  }
  
  // Try to find by JIRA username
  if (name) {
    const userByUsername = await findUserByJiraUsername(name);
    if (userByUsername) {
      return userByUsername.slackUserId;
    }
  }
  
  // No user found
  return null;
}

/**
 * Finds user document by JIRA email address
 * @param {string} email - JIRA email address
 * @returns {Promise<Object|null>} - User document or null
 */
async function findUserByJiraEmail(email) {
  try {
    // Check if user exists with this email as document ID
    const userRef = doc(db, 'users', email);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data();
    }
    
    // If not found by email as ID, search by jiraUsername field
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('jiraUsername', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data();
    }
    
    return null;
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
}

/**
 * Finds user document by JIRA username
 * @param {string} username - JIRA username
 * @returns {Promise<Object|null>} - User document or null
 */
async function findUserByJiraUsername(username) {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('jiraUsername', '==', username));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data();
    }
    
    return null;
  } catch (error) {
    console.error('Error finding user by username:', error);
    return null;
  }
}

/**
 * Formats the story message with JIRA link for Slack
 * @param {Object} storyData - Generated story and metadata
 * @param {Object} ticketInfo - JIRA ticket information
 * @returns {Object} - Formatted Slack message payload
 */
function formatStoryMessage(storyData, ticketInfo) {
  const { narrative } = storyData;
  const { issueKey, issueUrl, summary } = ticketInfo;
  
  // Create JIRA link (fallback if no URL provided)
  const jiraLink = issueUrl || `https://your-domain.atlassian.net/browse/${issueKey}`;
  
  // Format message with blocks for better presentation
  return {
    text: `New quest story for ${issueKey}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: narrative
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📋 *JIRA Ticket:* <${jiraLink}|${issueKey}>`
        }
      }
    ]
  };
}

/**
 * Sends a message to Slack using the Web API
 * @param {string} slackUserId - Slack user ID to send message to
 * @param {Object} message - Formatted message payload
 * @returns {Promise<Object>} - Slack API response
 */
async function sendSlackMessage(slackUserId, message) {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel: slackUserId, // Send as DM
      ...message
    })
  });

  const result = await response.json();
  
  if (!result.ok) {
    throw new Error(`Slack API error: ${result.error}`);
  }
  
  return result;
}

/**
 * Sends a story notification to a team channel
 * @param {string} channelId - Slack channel ID
 * @param {Object} storyData - Generated story and metadata
 * @param {Object} ticketInfo - JIRA ticket information
 * @param {Object} userInfo - User information
 * @returns {Promise<Object>} - Success/failure result
 */
export async function sendTeamStoryNotification(channelId, storyData, ticketInfo, userInfo) {
  try {
    const message = formatTeamStoryMessage(storyData, ticketInfo, userInfo);
    const result = await sendSlackMessage(channelId, message);
    
    return {
      success: true,
      channelId,
      messageResult: result
    };
    
  } catch (error) {
    console.error('Failed to send team story notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Formats the story message for team channels with user mention
 * @param {Object} storyData - Generated story and metadata
 * @param {Object} ticketInfo - JIRA ticket information
 * @param {Object} userInfo - User information from webhook
 * @returns {Object} - Formatted Slack message payload
 */
function formatTeamStoryMessage(storyData, ticketInfo, userInfo) {
  // Handle both old format (narrative) and new format (storyData)
  const { narrative, guildInfo, storyData: newStoryData, xpAward } = storyData;
  const { issueKey, issueUrl, summary } = ticketInfo;
  const { displayName } = userInfo;
  
  // Extract story data from new or old format
  const story = newStoryData ? newStoryData : { story: narrative, loot: null, achievements: null };
  
  const jiraLink = issueUrl || `https://your-domain.atlassian.net/browse/${issueKey}`;
  
  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🏰 **${guildInfo?.guildName || 'Guild'} Quest Update**`
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: story.story || narrative
      }
    }
  ];
  
  // Add XP section if present
  if (xpAward && xpAward.xp > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⚡ *XP Gained:* +${xpAward.xp} XP${xpAward.reason ? ` (${xpAward.reason})` : ''}`
      }
    });
  }
  
  // Add loot section if present
  if (story.loot) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🎁 *Loot Acquired:* ${story.loot}`
      }
    });
  }
  
  // Add achievement section if present
  if (story.achievements) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🏆 *Achievement Unlocked:* ${story.achievements}`
      }
    });
  }
  
  // Add context footer
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `👤 *Hero:* ${displayName} • 📋 *Quest:* <${jiraLink}|${issueKey}>`
      }
    ]
  });
  
  return {
    text: `New quest story for ${issueKey}`,
    blocks
  };
}

/**
 * Validates a Slack channel exists and bot has access
 * @param {string} channelId - Slack channel ID to validate
 * @returns {Promise<Object>} - Validation result with channel info
 */
export async function validateSlackChannel(channelId) {
  try {
    const url = new URL('https://slack.com/api/conversations.info');
    url.searchParams.append('channel', channelId);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`
      }
    });

    const result = await response.json();
    
    if (!result.ok) {
      return {
        isValid: false,
        error: result.error,
        message: getChannelErrorMessage(result.error)
      };
    }

    const channel = result.channel;
    
    // Check if bot is a member of the channel
    const membershipCheck = await checkBotMembership(channelId);
    
    return {
      isValid: true,
      channel: {
        id: channel.id,
        name: channel.name,
        isPrivate: channel.is_private,
        isMember: membershipCheck.isMember
      }
    };
    
  } catch (error) {
    console.error('Channel validation error:', error);
    return {
      isValid: false,
      error: 'validation_failed',
      message: 'Failed to validate channel'
    };
  }
}

/**
 * Checks if the bot is a member of the specified channel
 * @param {string} channelId - Slack channel ID
 * @returns {Promise<Object>} - Membership status
 */
async function checkBotMembership(channelId) {
  try {
    const url = new URL('https://slack.com/api/conversations.members');
    url.searchParams.append('channel', channelId);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`
      }
    });

    const result = await response.json();
    
    if (!result.ok) {
      return { isMember: false, error: result.error };
    }

    // Get bot user ID
    const botUserId = await getBotUserId();
    const isMember = result.members && result.members.includes(botUserId);
    
    return { isMember, members: result.members };
    
  } catch (error) {
    console.error('Membership check error:', error);
    return { isMember: false, error: 'check_failed' };
  }
}

/**
 * Gets the bot's user ID
 * @returns {Promise<string>} - Bot user ID
 */
async function getBotUserId() {
  try {
    const response = await fetch('https://slack.com/api/auth.test', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`
      }
    });

    const result = await response.json();
    return result.user_id;
    
  } catch (error) {
    console.error('Failed to get bot user ID:', error);
    return null;
  }
}

/**
 * Validates command context (guild channel or DM only)
 * @param {string} channelId - Channel where command was invoked
 * @param {string} userId - User who invoked the command
 * @param {string} guildName - Guild name for validation
 * @returns {Promise<Object>} - Context validation result
 */
export async function validateCommandContext(channelId, userId, guildName = null) {
  try {
    // Check if it's a DM (channel starts with 'D')
    const isDM = channelId.startsWith('D');
    
    if (isDM) {
      return {
        isValid: true,
        context: 'dm',
        message: 'Command executed in DM'
      };
    }

    // If guild name provided, check if channel matches guild channel
    if (guildName) {
      const guild = await getGuildByName(guildName);
      
      if (guild && guild.slackChannelId === channelId) {
        return {
          isValid: true,
          context: 'guild_channel',
          guild: guild,
          message: `Command executed in guild channel #${guild.slackChannelName}`
        };
      }
    }

    // Check if channel belongs to any guild the user is member of
    const user = await getUserBySlackId(userId);
    if (user) {
      const userGuilds = await getGuildsByUser(userId);
      const matchingGuild = userGuilds.find(guild => guild.slackChannelId === channelId);
      
      if (matchingGuild) {
        return {
          isValid: true,
          context: 'guild_channel',
          guild: matchingGuild,
          message: `Command executed in guild channel #${matchingGuild.slackChannelName}`
        };
      }
    }

    // Invalid context
    return {
      isValid: false,
      context: 'invalid',
      message: 'Guild commands can only be used in guild channels or direct messages'
    };
    
  } catch (error) {
    console.error('Context validation error:', error);
    return {
      isValid: false,
      context: 'error',
      message: 'Failed to validate command context'
    };
  }
}

/**
 * Gets user-friendly error message for channel validation errors
 * @param {string} errorCode - Slack API error code
 * @returns {string} - User-friendly error message
 */
function getChannelErrorMessage(errorCode) {
  switch (errorCode) {
    case 'channel_not_found':
      return 'Channel not found. Make sure the channel exists and you\'ve invited the bot.';
    case 'not_in_channel':
      return 'Bot is not a member of this channel. Please invite the bot to the channel first.';
    case 'invalid_auth':
      return 'Bot authentication failed. Please contact an administrator.';
    case 'missing_scope':
      return 'Bot lacks required permissions. Please contact an administrator.';
    default:
      return `Channel validation failed: ${errorCode}`;
  }
}

/**
 * Gets appropriate channel for story notification based on guild info
 * @param {Object} guildInfo - Guild information from story generation
 * @returns {Promise<string|null>} - Channel ID or null if no mapping found
 */
export async function getNotificationChannel(guildInfo) {
  // This would typically query team mappings from Firestore
  // For now, return null to indicate DM-only notifications
  // TODO: Implement team/channel mapping lookup
  return null;
}
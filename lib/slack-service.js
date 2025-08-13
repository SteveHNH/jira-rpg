// lib/slack-service.js - Slack Bot Integration for JIRA RPG

import { db } from './firebase.js';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

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
  const { narrative, guildInfo } = storyData;
  const { issueKey, issueUrl, summary } = ticketInfo;
  const { displayName } = userInfo;
  
  const jiraLink = issueUrl || `https://your-domain.atlassian.net/browse/${issueKey}`;
  
  return {
    text: `New quest story for ${issueKey}`,
    blocks: [
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
          text: narrative
        }
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `👤 *Hero:* ${displayName} • 📋 *Quest:* <${jiraLink}|${issueKey}>`
          }
        ]
      }
    ]
  };
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
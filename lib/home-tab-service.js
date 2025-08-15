// lib/home-tab-service.js - Slack App Home tab management

import { getGuildsByUser, getGuildById } from './guild-service.js';
import { getXpForLevel } from './xp-calculator.js';
import { getRecentStories } from './story-service.js';

/**
 * Publishes the Home tab view for a user
 * @param {string} slackUserId - Slack user ID
 * @param {Object|null} userData - User data from Firebase (null if not registered)
 */
export async function publishHomeTab(slackUserId, userData) {
  try {
    const view = userData 
      ? await buildRegisteredUserHomeView(userData)
      : buildUnregisteredUserHomeView();

    // Check if SLACK_BOT_TOKEN is available
    if (!process.env.SLACK_BOT_TOKEN) {
      console.error('SLACK_BOT_TOKEN is not configured');
      return false;
    }

    const response = await fetch('https://slack.com/api/views.publish', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: slackUserId,
        view: view
      })
    });

    const result = await response.json();
    
    if (!result.ok) {
      console.error('Failed to publish Home tab:', result.error);
      console.error('Full response:', JSON.stringify(result, null, 2));
      return false;
    }

    return true;

  } catch (error) {
    console.error('Error publishing Home tab:', error);
    return false;
  }
}

/**
 * Builds the Home tab view for registered users
 * @param {Object} userData - User data from Firebase
 * @returns {Object} Slack Block Kit view
 */
async function buildRegisteredUserHomeView(userData) {
  const blocks = [];

  // Header section
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: "🎮 Backlog Bard RPG Dashboard"
    }
  });

  // Player stats section
  blocks.push(...buildPlayerStatsSection(userData));

  // Guild section
  const guildBlocks = await buildGuildSection(userData);
  blocks.push(...guildBlocks);

  // Quick actions section
  blocks.push(...buildQuickActionsSection());

  // Recent adventures section
  const adventureBlocks = await buildRecentAdventuresSection(userData);
  blocks.push(...adventureBlocks);

  return {
    type: "home",
    blocks: blocks
  };
}

/**
 * Builds the Home tab view for unregistered users
 * @returns {Object} Slack Block Kit view
 */
function buildUnregisteredUserHomeView() {
  return {
    type: "home",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🎮 Welcome to Backlog Bard RPG!"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "⚔️ *Ready to transform your JIRA work into epic adventures?*\n\nRegister now to start earning XP, joining guilds, and receiving epic tales of your coding conquests!"
        }
      },
      {
        type: "divider"
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "🚀 *Get Started:*"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Use `/rpg-register your.email@company.com` to link your JIRA account and begin your adventure!"
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "Register Now"
          },
          action_id: "register_button",
          style: "primary"
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "💡 Need help? Use `/rpg-help` to see all available commands"
          }
        ]
      }
    ]
  };
}

/**
 * Builds the player stats section
 * @param {Object} userData - User data from Firebase
 * @returns {Array} Array of Block Kit blocks
 */
function buildPlayerStatsSection(userData) {
  const { level, xp } = userData;
  const currentLevelXp = getXpForLevel(level);
  const nextLevelXp = getXpForLevel(level + 1);
  const progressXp = xp - currentLevelXp;
  const requiredXp = nextLevelXp - currentLevelXp;
  const progressPercent = Math.min(Math.round((progressXp / requiredXp) * 100), 100);

  // Create a visual progress bar using emoji
  const progressBarLength = 10;
  const filledBars = Math.round((progressPercent / 100) * progressBarLength);
  const progressBar = '🟩'.repeat(filledBars) + '⬜'.repeat(progressBarLength - filledBars);

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${getLevelBadgeEmoji(level)} *Level ${level} Adventurer*\n🌟 ${xp.toLocaleString()} Total XP`
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `📊 *Progress to Level ${level + 1}*\n${progressBar} ${progressPercent}%\n${progressXp.toLocaleString()}/${requiredXp.toLocaleString()} XP`
      }
    },
    {
      type: "divider"
    }
  ];
}

/**
 * Builds the guild section
 * @param {Object} userData - User data from Firebase
 * @returns {Array} Array of Block Kit blocks
 */
async function buildGuildSection(userData) {
  try {
    // Use same guild resolution logic as /rpg-status command
    let userGuilds = [];
    if (userData.guilds && userData.guilds.length > 0) {
      const guildPromises = userData.guilds.map(async (guildId) => {
        const guild = await getGuildById(guildId);
        return guild && guild.isActive ? guild : null;
      });
      const resolvedGuilds = await Promise.all(guildPromises);
      userGuilds = resolvedGuilds.filter(guild => guild !== null);
    }
    
    if (!userGuilds || userGuilds.length === 0) {
      return [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "🏰 *Guilds*\nYou haven't joined any guilds yet. Join a guild to collaborate on epic quests!"
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "View Guilds"
            },
            action_id: "view_guilds",
            style: "primary"
          }
        },
        {
          type: "divider"
        }
      ];
    }

    const guildText = userGuilds.map(guild => {
      const roleEmoji = guild.leaderId === userData.jiraUsername ? '👑' : '⚔️';
      return `${roleEmoji} *${guild.name}* (${guild.members?.length || 0} members)`;
    }).join('\n');

    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🏰 *Your Guilds*\n${guildText}`
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: "Manage Guilds"
          },
          action_id: "manage_guilds"
        }
      },
      {
        type: "divider"
      }
    ];

  } catch (error) {
    console.error('Error building guild section:', error);
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "🏰 *Guilds*\nUnable to load guild information at the moment."
        }
      },
      {
        type: "divider"
      }
    ];
  }
}

/**
 * Builds the quick actions section
 * @returns {Array} Array of Block Kit blocks
 */
function buildQuickActionsSection() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "⚡ *Quick Actions*"
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "📊 View Status"
          },
          action_id: "view_status",
          style: "primary"
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🏆 Leaderboard"
          },
          action_id: "view_leaderboard"
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🏰 Join Guild"
          },
          action_id: "join_guild"
        }
      ]
    },
    {
      type: "divider"
    }
  ];
}

/**
 * Builds the recent adventures section
 * @param {Object} userData - User data from Firebase
 * @returns {Array} Array of Block Kit blocks
 */
async function buildRecentAdventuresSection(userData) {
  try {
    const recentStories = await getRecentStories(userData.jiraUsername, 3); // Get last 3 stories
    
    if (!recentStories || recentStories.length === 0) {
      return [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "📜 *Recent Adventures*\nNo epic tales yet! Complete JIRA tickets to see your heroic stories appear here. ⚔️"
          }
        },
        {
          type: "divider"
        }
      ];
    }

    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "📜 *Recent Adventures*"
        }
      }
    ];

    // Add each recent story
    recentStories.forEach((story, index) => {
      const timeAgo = getTimeAgo(story.createdAt);
      const xpGained = story.xpAward?.xp || 0;
      const truncatedNarrative = story.narrative && story.narrative.length > 150 
        ? story.narrative.substring(0, 150) + "..." 
        : story.narrative || "Epic tale completed!";

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🎯 *${story.ticketKey}* • +${xpGained} XP • ${timeAgo}\n${truncatedNarrative}`
        }
      });

      // Add divider after each story except the last one
      if (index < recentStories.length - 1) {
        blocks.push({
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "─────────────────────"
            }
          ]
        });
      }
    });

    blocks.push({
      type: "divider"
    });

    return blocks;

  } catch (error) {
    console.error('Error building recent adventures section:', error);
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "📜 *Recent Adventures*\nUnable to load your epic tales at the moment. ⚔️"
        }
      },
      {
        type: "divider"
      }
    ];
  }
}

/**
 * Gets human-readable time ago string
 * @param {Date|Object} date - Date object or Firestore timestamp
 * @returns {string} Time ago string
 */
function getTimeAgo(date) {
  try {
    // Handle Firestore timestamp format
    const dateObj = date?.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const diffMs = now - dateObj;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return dateObj.toLocaleDateString();
    }
  } catch (error) {
    console.error('Error calculating time ago:', error);
    return 'recently';
  }
}

/**
 * Gets the badge emoji for a given level
 * @param {number} level - User level
 * @returns {string} Badge emoji
 */
function getLevelBadgeEmoji(level) {
  if (level >= 20) return '🏆';
  if (level >= 15) return '💎';
  if (level >= 10) return '🥇';
  if (level >= 5) return '🥈';
  return '🥉';
}

/**
 * Refreshes the Home tab for a user (call after XP changes, guild updates, etc.)
 * @param {string} slackUserId - Slack user ID
 * @param {Object} userData - Updated user data
 */
export async function refreshHomeTab(slackUserId, userData) {
  console.log('Refreshing Home tab for user:', slackUserId);
  return await publishHomeTab(slackUserId, userData);
}
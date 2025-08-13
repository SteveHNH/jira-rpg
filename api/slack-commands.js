// api/slack-commands.js - Slack slash command handler

import { verifySlackRequest } from '../lib/slack.js';
import { db } from '../lib/firebase.js';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

export default async function handler(req, res) {
  console.log('Slack command received:', {
    method: req.method,
    headers: req.headers,
    body: req.body
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify the request came from Slack
    const isValidRequest = verifySlackRequest(req);
    if (!isValidRequest) {
      console.error('Invalid Slack request signature');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Parse the slash command data
    const {
      command,
      text,
      user_id,
      user_name,
      channel_id,
      channel_name,
      team_id,
      response_url
    } = req.body;

    console.log('Processing command:', {
      command,
      text,
      user_id,
      user_name,
      channel_id
    });

    // Route to appropriate command handler
    let response;
    switch (command) {
      case '/rpg-help':
        response = await handleHelpCommand();
        break;
      
      case '/rpg-status':
        response = await handleStatusCommand(user_id, user_name);
        break;
      
      case '/rpg-register':
        response = await handleRegisterCommand(user_id, user_name, text);
        break;
      
      case '/rpg-leaderboard':
        response = await handleLeaderboardCommand(channel_id);
        break;
      
      case '/rpg-teams':
        response = await handleTeamsCommand();
        break;
      
      case '/rpg-join':
        response = await handleJoinCommand(user_id, text);
        break;
      
      case '/rpg-leave':
        response = await handleLeaveCommand(user_id, text);
        break;
      
      case '/rpg-config':
        response = await handleConfigCommand(user_id, text, channel_id);
        break;
      
      case '/rpg-achievements':
        response = await handleAchievementsCommand(user_id);
        break;
      
      case '/rpg-guild-stats':
        response = await handleGuildStatsCommand(text, channel_id);
        break;
      
      default:
        response = {
          text: `❓ Unknown command: ${command}. Use \`/rpg-help\` to see available commands.`,
          response_type: 'ephemeral'
        };
    }

    // Return the response to Slack
    return res.status(200).json(response);

  } catch (error) {
    console.error('Slack command error:', error);
    
    return res.status(200).json({
      text: '⚠️ Something went wrong! Our wizards are looking into it.',
      response_type: 'ephemeral'
    });
  }
}

// Command Handlers

async function handleHelpCommand() {
  const helpText = `🎮 **Backlog Bard RPG Commands**

📊 **Player Commands:**
• \`/rpg-status\` - Check your level, XP, and achievements
• \`/rpg-register <jira-username>\` - Link your Slack to JIRA
• \`/rpg-achievements\` - View your unlocked achievements

🏰 **Guild Commands:**
• \`/rpg-teams\` - List available guilds/teams
• \`/rpg-join <guild-name>\` - Join a guild
• \`/rpg-leave <guild-name>\` - Leave a guild
• \`/rpg-guild-stats [guild-name]\` - View guild performance

🏆 **Social Commands:**
• \`/rpg-leaderboard\` - Top players in this channel
• \`/rpg-help\` - Show this help message

⚙️ **Admin Commands:**
• \`/rpg-config create-team <name> <component> <#channel>\` - Create new team

🗡️ **How it works:** Complete JIRA tickets to gain XP, level up, and unlock achievements! Stories about your epic coding adventures will appear in your guild's channel.

*Level up from Novice Adventurer to The Debugging God! ⚔️*`;

  return {
    text: helpText,
    response_type: 'ephemeral'
  };
}

async function handleStatusCommand(userId, userName) {
  try {
    // Try to find user by Slack ID first
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('slackUserId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return {
        text: `👋 Welcome to the RPG, ${userName}! 

You're not registered yet. Complete a JIRA ticket to automatically join, or use \`/rpg-register <your-jira-username>\` to link your account manually.

Once registered, you'll start earning XP and leveling up! 🗡️`,
        response_type: 'ephemeral'
      };
    }
    
    const userData = querySnapshot.docs[0].data();
    const progressToNext = calculateProgressToNextLevel(userData.xp, userData.level);
    
    const statusText = `🏆 **${userData.displayName}** *(${userData.currentTitle})*

📊 **Level ${userData.level}** | **${userData.xp} XP**
📈 Progress to Level ${userData.level + 1}: ${progressToNext.current}/${progressToNext.needed} XP (${progressToNext.percentage}%)

🏰 **Guilds:** ${userData.guilds?.join(', ') || 'None'}
⚔️ **Total Quests:** ${userData.totalTickets || 0}
🐛 **Bugs Slain:** ${userData.totalBugs || 0}
🕐 **Last Quest:** ${userData.lastActivity ? new Date(userData.lastActivity.seconds * 1000).toLocaleDateString() : 'Never'}

Keep completing tickets to level up! 🌟`;

    return {
      text: statusText,
      response_type: 'ephemeral'
    };
    
  } catch (error) {
    console.error('Status command error:', error);
    return {
      text: '⚠️ Could not retrieve your status. Try again later.',
      response_type: 'ephemeral'
    };
  }
}

async function handleRegisterCommand(userId, userName, jiraUsername) {
  if (!jiraUsername || jiraUsername.trim() === '') {
    return {
      text: '❓ Please provide your JIRA username: `/rpg-register your.jira.username`',
      response_type: 'ephemeral'
    };
  }
  
  // TODO: Implement user registration logic
  // This would link the Slack user ID to a JIRA username
  
  return {
    text: `✅ Registration coming soon! For now, complete a JIRA ticket and you'll be automatically registered as **${jiraUsername}**.`,
    response_type: 'ephemeral'
  };
}

async function handleLeaderboardCommand(channelId) {
  try {
    // Get top 10 users by XP
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('xp', 'desc'), limit(10));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return {
        text: '🏆 No adventurers have started their journey yet! Complete some JIRA tickets to get on the leaderboard!',
        response_type: 'in_channel'
      };
    }
    
    let leaderboard = '🏆 **Hall of Legends**\n\n';
    let rank = 1;
    
    querySnapshot.forEach((doc) => {
      const user = doc.data();
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏅';
      
      leaderboard += `${medal} **${rank}.** ${user.displayName} - Level ${user.level} *(${user.xp} XP)*\n`;
      rank++;
    });
    
    leaderboard += '\n⚔️ Complete JIRA tickets to climb the ranks!';
    
    return {
      text: leaderboard,
      response_type: 'in_channel'
    };
    
  } catch (error) {
    console.error('Leaderboard error:', error);
    return {
      text: '⚠️ Could not load leaderboard. Try again later.',
      response_type: 'ephemeral'
    };
  }
}

async function handleTeamsCommand() {
  try {
    // Get all guilds from database
    const guildsRef = collection(db, 'guilds');
    const querySnapshot = await getDocs(guildsRef);
    
    if (querySnapshot.empty) {
      return {
        text: '🏰 No guilds exist yet! Complete some JIRA tickets to automatically create guilds based on your projects and components.',
        response_type: 'ephemeral'
      };
    }
    
    let teamsText = '🏰 **Available Guilds**\n\n';
    
    querySnapshot.forEach((doc) => {
      const guild = doc.data();
      const memberCount = guild.members?.length || 0;
      const avgLevel = guild.averageLevel?.toFixed(1) || '1.0';
      
      teamsText += `⚔️ **${guild.name}**\n`;
      teamsText += `   📊 Project: ${guild.project} | Component: ${guild.primaryComponent}\n`;
      teamsText += `   👥 ${memberCount} members | Avg Level: ${avgLevel}\n`;
      teamsText += `   💬 Channel: ${guild.slackChannelId ? '<#' + guild.slackChannelId + '>' : 'Not configured'}\n\n`;
    });
    
    teamsText += 'Use `/rpg-join <guild-name>` to join a guild!';
    
    return {
      text: teamsText,
      response_type: 'ephemeral'
    };
    
  } catch (error) {
    console.error('Teams command error:', error);
    return {
      text: '⚠️ Could not load teams. Try again later.',
      response_type: 'ephemeral'
    };
  }
}

async function handleJoinCommand(userId, guildName) {
  if (!guildName || guildName.trim() === '') {
    return {
      text: '❓ Please specify a guild name: `/rpg-join frontend-ui`',
      response_type: 'ephemeral'
    };
  }
  
  // TODO: Implement guild joining logic
  return {
    text: `⚔️ Guild joining coming soon! You'll be able to join **${guildName}** guild.`,
    response_type: 'ephemeral'
  };
}

async function handleLeaveCommand(userId, guildName) {
  if (!guildName || guildName.trim() === '') {
    return {
      text: '❓ Please specify a guild name: `/rpg-leave frontend-ui`',
      response_type: 'ephemeral'
    };
  }
  
  // TODO: Implement guild leaving logic
  return {
    text: `👋 Guild leaving coming soon! You'll be able to leave **${guildName}** guild.`,
    response_type: 'ephemeral'
  };
}

async function handleConfigCommand(userId, text, channelId) {
  // TODO: Add admin permission check
  
  if (!text || text.trim() === '') {
    return {
      text: `⚙️ **Admin Configuration Commands:**

\`/rpg-config create-team <name> <component> <#channel>\`
Example: \`/rpg-config create-team frontend-warriors UI #dev-frontend\`

More config options coming soon!`,
      response_type: 'ephemeral'
    };
  }
  
  // TODO: Implement config logic
  return {
    text: '⚙️ Configuration coming soon! This will let admins set up team mappings.',
    response_type: 'ephemeral'
  };
}

async function handleAchievementsCommand(userId) {
  // TODO: Implement achievements system
  return {
    text: '🏅 Achievements system coming soon! You\'ll be able to unlock titles like "Bug Slayer" and "Speed Demon".',
    response_type: 'ephemeral'
  };
}

async function handleGuildStatsCommand(guildName, channelId) {
  // TODO: Implement guild stats
  return {
    text: '📊 Guild stats coming soon! View your guild\'s performance and top contributors.',
    response_type: 'ephemeral'
  };
}

// Helper Functions

function calculateProgressToNextLevel(currentXP, currentLevel) {
  const levelThresholds = [
    0, 160, 360, 600, 880, 1200, // Levels 1-5
    1600, 2000, 2400, 2800, 3200, // Levels 6-10
    3800, 4400, 5000, 5600, 6200, // Levels 11-15
    7000, 7800, 8600, 9400, 10400 // Levels 16-20
  ];
  
  if (currentLevel >= 20) {
    return { current: 0, needed: 0, percentage: 100 };
  }
  
  const currentLevelXP = levelThresholds[currentLevel - 1] || 0;
  const nextLevelXP = levelThresholds[currentLevel] || levelThresholds[levelThresholds.length - 1];
  
  const progressInLevel = currentXP - currentLevelXP;
  const xpNeededForLevel = nextLevelXP - currentLevelXP;
  const percentage = Math.round((progressInLevel / xpNeededForLevel) * 100);
  
  return {
    current: progressInLevel,
    needed: xpNeededForLevel,
    percentage: Math.min(percentage, 100)
  };
}

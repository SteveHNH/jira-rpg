// api/slack-commands.js - Slack slash command handler

import { verifySlackRequest } from '../lib/slack.js';
import { db } from '../lib/firebase.js';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { createUser } from '../lib/user-service.js';
import { validateSlackChannel, validateCommandContext } from '../lib/slack-service.js';
import { 
  createGuild,
  joinGuild,
  leaveGuild,
  getAllActiveGuilds,
  getGuildByName,
  getGuildsByUser,
  renameGuild,
  kickGuildMember,
  transferGuildLeadership,
  validateGuildLeadership
} from '../lib/guild-service.js';

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
      
      case '/rpg-guild-create':
        response = await handleGuildCreateCommand(user_id, user_name, text, channel_id);
        break;
      
      case '/rpg-guild-join':
        response = await handleGuildJoinCommand(user_id, text, channel_id);
        break;
      
      case '/rpg-guild-leave':
        response = await handleGuildLeaveCommand(user_id, text, channel_id);
        break;
      
      case '/rpg-guild-list':
        response = await handleGuildListCommand();
        break;
      
      case '/rpg-guild-info':
        response = await handleGuildInfoCommand(text);
        break;
      
      case '/rpg-guild-rename':
        response = await handleGuildRenameCommand(user_id, text, channel_id);
        break;
      
      case '/rpg-guild-kick':
        response = await handleGuildKickCommand(user_id, text, channel_id);
        break;
      
      case '/rpg-guild-transfer':
        response = await handleGuildTransferCommand(user_id, text, channel_id);
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
• \`/rpg-register <email>\` - Link your Slack to JIRA
• \`/rpg-achievements\` - View your unlocked achievements

🏰 **Guild Commands:**
• \`/rpg-guild-list\` - List available guilds
• \`/rpg-guild-create <#channel> "<name>" <components> [labels]\` - Create new guild
• \`/rpg-guild-join <guild-name>\` - Join a guild
• \`/rpg-guild-leave [guild-name]\` - Leave a guild
• \`/rpg-guild-info [guild-name]\` - View guild details
• \`/rpg-teams\` - Legacy guild listing (deprecated)

🔧 **Guild Leadership:** *(Guild channel or DM only)*
• \`/rpg-guild-rename <new-name>\` - Rename guild (leader only)
• \`/rpg-guild-kick <@user>\` - Remove member (leader only)  
• \`/rpg-guild-transfer <@user>\` - Transfer leadership (leader only)

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

You're not registered yet. Complete a JIRA ticket to automatically join, or use \`/rpg-register <your.email@company.com>\` to link your account manually.

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

async function handleRegisterCommand(userId, userName, email) {
  if (!email || email.trim() === '') {
    return {
      text: '❓ Please provide your email address: `/rpg-register your.email@company.com`',
      response_type: 'ephemeral'
    };
  }
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return {
      text: '❌ Please provide a valid email address: `/rpg-register your.email@company.com`',
      response_type: 'ephemeral'
    };
  }
  
  try {
    const trimmedEmail = email.trim();
    const newUser = await createUser(userId, userName, trimmedEmail);
    
    return {
      text: `🎉 **Welcome to the RPG, ${userName}!**

🗡️ You've been registered with email: **${trimmedEmail}**
📊 Starting Level: **1** (Novice Adventurer)
⚔️ Current XP: **0**

Complete JIRA tickets to start earning XP and leveling up! Your epic coding adventures await! 🌟`,
      response_type: 'ephemeral'
    };
    
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.message.includes('already registered')) {
      return {
        text: `⚠️ ${error.message}. Use \`/rpg-status\` to check your current progress!`,
        response_type: 'ephemeral'
      };
    }
    
    return {
      text: '❌ Registration failed. Please try again later or contact an admin.',
      response_type: 'ephemeral'
    };
  }
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

// Guild Command Handlers

async function handleGuildCreateCommand(userId, userName, text, channelId) {
  try {
    // Parse command: /rpg-guild-create <#channel> "<name>" <components> [labels]
    const args = parseGuildCreateArgs(text);
    if (!args.isValid) {
      return {
        text: `❌ ${args.error}\n\n**Usage:** \`/rpg-guild-create <#channel> "<guild-name>" <components> [labels]\`\n**Example:** \`/rpg-guild-create #dev-frontend "Frontend Warriors" UI,React frontend,ui-bug\``,
        response_type: 'ephemeral'
      };
    }

    const { channelId: guildChannelId, channelName, guildName, components, labels } = args;

    // Validate Slack channel
    const channelValidation = await validateSlackChannel(guildChannelId);
    if (!channelValidation.isValid) {
      return {
        text: `❌ Channel validation failed: ${channelValidation.message}`,
        response_type: 'ephemeral'
      };
    }

    if (!channelValidation.channel.isMember) {
      return {
        text: `❌ Bot is not a member of #${channelValidation.channel.name}. Please invite the bot to the channel first.`,
        response_type: 'ephemeral'
      };
    }

    // Create guild
    const guild = await createGuild(
      userId,
      guildChannelId,
      channelName,
      guildName,
      components,
      labels
    );

    return {
      text: `🏰 **Guild Created Successfully!**

⚔️ **${guild.name}** has been established!
📍 **Channel:** #${guild.slackChannelName}
👑 **Leader:** ${userName}

🎯 **JIRA Components:** ${guild.jiraComponents.join(', ') || 'None'}
🏷️ **JIRA Labels:** ${guild.jiraLabels.join(', ') || 'None'}

Guild members will receive epic stories when working on tickets matching these components or labels!

Use \`/rpg-guild-join ${guild.name}\` to invite others to join your guild! ⚔️`,
      response_type: 'in_channel'
    };

  } catch (error) {
    console.error('Guild create command error:', error);
    return {
      text: `❌ Failed to create guild: ${error.message}`,
      response_type: 'ephemeral'
    };
  }
}

async function handleGuildJoinCommand(userId, text, channelId) {
  try {
    // Validate context first
    const context = await validateCommandContext(channelId, userId);
    if (!context.isValid) {
      return {
        text: `❌ ${context.message}`,
        response_type: 'ephemeral'
      };
    }

    if (!text || text.trim() === '') {
      return {
        text: '❓ Please specify a guild name: `/rpg-guild-join "Frontend Warriors"`',
        response_type: 'ephemeral'
      };
    }

    const guildName = text.trim().replace(/^"|"$/g, ''); // Remove quotes if present
    const result = await joinGuild(userId, guildName);

    return {
      text: `⚔️ **Welcome to the Guild!**

You've successfully joined **${result.guildName}**!
📍 **Channel:** #${result.channelName}
👥 **Members:** ${result.memberCount}

You'll now receive epic quest stories when working on tickets for this guild! Check out #${result.channelName} for guild activities. 🏰`,
      response_type: 'ephemeral'
    };

  } catch (error) {
    console.error('Guild join command error:', error);
    return {
      text: `❌ Failed to join guild: ${error.message}`,
      response_type: 'ephemeral'
    };
  }
}

async function handleGuildLeaveCommand(userId, text, channelId) {
  try {
    // Validate context first
    const context = await validateCommandContext(channelId, userId);
    if (!context.isValid) {
      return {
        text: `❌ ${context.message}`,
        response_type: 'ephemeral'
      };
    }

    let guildName = text ? text.trim().replace(/^"|"$/g, '') : null;

    // If no guild specified and in guild channel, use current guild
    if (!guildName && context.guild) {
      guildName = context.guild.name;
    }

    // If still no guild name, show user's guilds
    if (!guildName) {
      const userGuilds = await getGuildsByUser(userId);
      if (userGuilds.length === 0) {
        return {
          text: '❌ You are not a member of any guilds.',
          response_type: 'ephemeral'
        };
      }

      if (userGuilds.length === 1) {
        guildName = userGuilds[0].name;
      } else {
        const guildList = userGuilds.map(guild => `• ${guild.name}`).join('\n');
        return {
          text: `❓ Please specify which guild to leave:\n\n${guildList}\n\n**Usage:** \`/rpg-guild-leave "Guild Name"\``,
          response_type: 'ephemeral'
        };
      }
    }

    const result = await leaveGuild(userId, guildName);

    let message = `👋 **Left Guild**\n\nYou've left **${result.guildName}**.`;
    
    if (result.wasLeader && result.remainingMembers > 0) {
      message += `\n\n⚠️ As the former leader, make sure to transfer leadership or the guild may become inactive.`;
    } else if (result.remainingMembers === 0) {
      message += `\n\n🏰 The guild has been deactivated as you were the last member.`;
    }

    return {
      text: message,
      response_type: 'ephemeral'
    };

  } catch (error) {
    console.error('Guild leave command error:', error);
    return {
      text: `❌ Failed to leave guild: ${error.message}`,
      response_type: 'ephemeral'
    };
  }
}

async function handleGuildListCommand() {
  try {
    const guilds = await getAllActiveGuilds();
    
    if (guilds.length === 0) {
      return {
        text: '🏰 No active guilds exist yet! Use `/rpg-guild-create` to create the first guild.',
        response_type: 'ephemeral'
      };
    }
    
    let guildsList = '🏰 **Active Guilds**\n\n';
    
    guilds.forEach((guild) => {
      const memberCount = guild.members?.length || 0;
      const avgLevel = guild.averageLevel?.toFixed(1) || '1.0';
      const componentsList = guild.jiraComponents.length > 0 ? guild.jiraComponents.join(', ') : 'None';
      const labelsList = guild.jiraLabels.length > 0 ? guild.jiraLabels.join(', ') : 'None';
      
      guildsList += `⚔️ **${guild.name}**\n`;
      guildsList += `   📍 Channel: <#${guild.slackChannelId}>\n`;
      guildsList += `   👥 ${memberCount} members | Avg Level: ${avgLevel}\n`;
      guildsList += `   🎯 Components: ${componentsList}\n`;
      guildsList += `   🏷️ Labels: ${labelsList}\n\n`;
    });
    
    guildsList += 'Use `/rpg-guild-join "Guild Name"` to join a guild!';
    
    return {
      text: guildsList,
      response_type: 'ephemeral'
    };
    
  } catch (error) {
    console.error('Guild list command error:', error);
    return {
      text: '⚠️ Could not load guild list. Try again later.',
      response_type: 'ephemeral'
    };
  }
}

async function handleGuildInfoCommand(text) {
  try {
    let guildName = text ? text.trim().replace(/^"|"$/g, '') : null;
    
    if (!guildName) {
      return {
        text: '❓ Please specify a guild name: `/rpg-guild-info "Frontend Warriors"`',
        response_type: 'ephemeral'
      };
    }

    const guild = await getGuildByName(guildName);
    if (!guild) {
      return {
        text: `❌ Guild "${guildName}" not found.`,
        response_type: 'ephemeral'
      };
    }

    const memberCount = guild.members?.length || 0;
    const leader = guild.members.find(member => member.role === 'leader');
    const memberList = guild.members.map(member => {
      const icon = member.role === 'leader' ? '👑' : '⚔️';
      return `${icon} ${member.displayName}`;
    }).join('\n   ');

    const componentsList = guild.jiraComponents.length > 0 ? guild.jiraComponents.join(', ') : 'None';
    const labelsList = guild.jiraLabels.length > 0 ? guild.jiraLabels.join(', ') : 'None';
    
    const infoText = `🏰 **${guild.name}**

📍 **Channel:** <#${guild.slackChannelId}>
👑 **Leader:** ${leader?.displayName || 'None'}
📅 **Created:** ${new Date(guild.createdAt.seconds * 1000).toLocaleDateString()}

📊 **Guild Stats:**
   👥 Members: ${memberCount}/${guild.maxMembers}
   🏆 Average Level: ${guild.averageLevel?.toFixed(1) || '1.0'}
   ⚔️ Total Quests: ${guild.totalTickets || 0}
   ✨ Total XP: ${guild.totalXp || 0}

🎯 **JIRA Components:** ${componentsList}
🏷️ **JIRA Labels:** ${labelsList}

👥 **Members:**
   ${memberList}

${guild.allowAutoJoin ? 'Use `/rpg-guild-join "' + guild.name + '"` to join this guild!' : 'This guild requires an invitation to join.'}`;

    return {
      text: infoText,
      response_type: 'ephemeral'
    };

  } catch (error) {
    console.error('Guild info command error:', error);
    return {
      text: '⚠️ Could not load guild information. Try again later.',
      response_type: 'ephemeral'
    };
  }
}

// Leadership Commands

async function handleGuildRenameCommand(userId, text, channelId) {
  try {
    // Validate context first
    const context = await validateCommandContext(channelId, userId);
    if (!context.isValid) {
      return {
        text: `❌ ${context.message}`,
        response_type: 'ephemeral'
      };
    }

    if (!text || text.trim() === '') {
      return {
        text: '❓ Please specify the new guild name: `/rpg-guild-rename "New Guild Name"`',
        response_type: 'ephemeral'
      };
    }

    const newName = text.trim().replace(/^"|"$/g, '');
    
    // Get current guild name from context
    let currentGuildName = null;
    if (context.guild) {
      currentGuildName = context.guild.name;
    } else {
      // In DM, need to determine which guild to rename
      const userGuilds = await getGuildsByUser(userId);
      const leaderGuilds = userGuilds.filter(guild => guild.leaderId === (await import('../lib/user-service.js')).getUserBySlackId(userId).then(user => user?.jiraUsername));
      
      if (leaderGuilds.length === 0) {
        return {
          text: '❌ You are not the leader of any guilds.',
          response_type: 'ephemeral'
        };
      }
      
      if (leaderGuilds.length > 1) {
        const guildList = leaderGuilds.map(guild => `• ${guild.name}`).join('\n');
        return {
          text: `❓ You lead multiple guilds. Please run this command from the specific guild channel:\n\n${guildList}`,
          response_type: 'ephemeral'
        };
      }
      
      currentGuildName = leaderGuilds[0].name;
    }

    const result = await renameGuild(userId, currentGuildName, newName);

    return {
      text: `🏰 **Guild Renamed Successfully!**

The guild has been renamed from **${result.oldName}** to **${result.newName}**.

📍 Channel: #${result.channelName}

All guild members will be notified of the name change! ⚔️`,
      response_type: context.context === 'dm' ? 'ephemeral' : 'in_channel'
    };

  } catch (error) {
    console.error('Guild rename command error:', error);
    return {
      text: `❌ Failed to rename guild: ${error.message}`,
      response_type: 'ephemeral'
    };
  }
}

async function handleGuildKickCommand(userId, text, channelId) {
  try {
    // Validate context first
    const context = await validateCommandContext(channelId, userId);
    if (!context.isValid) {
      return {
        text: `❌ ${context.message}`,
        response_type: 'ephemeral'
      };
    }

    if (!text || text.trim() === '') {
      return {
        text: '❓ Please specify a user to kick: `/rpg-guild-kick @username`',
        response_type: 'ephemeral'
      };
    }

    // Parse user mention
    const userMatch = text.match(/<@([A-Z0-9]+)>/);
    if (!userMatch) {
      return {
        text: '❓ Please mention a user to kick: `/rpg-guild-kick @username`',
        response_type: 'ephemeral'
      };
    }

    const targetUserId = userMatch[1];
    
    // Get guild name from context
    let guildName = null;
    if (context.guild) {
      guildName = context.guild.name;
    } else {
      return {
        text: '❌ Please run this command from the guild channel.',
        response_type: 'ephemeral'
      };
    }

    const result = await kickGuildMember(userId, targetUserId, guildName);

    return {
      text: `⚔️ **Member Removed**

**${result.kickedUser}** has been removed from **${result.guildName}**.

👥 Remaining members: ${result.remainingMembers}`,
      response_type: 'in_channel'
    };

  } catch (error) {
    console.error('Guild kick command error:', error);
    return {
      text: `❌ Failed to kick member: ${error.message}`,
      response_type: 'ephemeral'
    };
  }
}

async function handleGuildTransferCommand(userId, text, channelId) {
  try {
    // Validate context first
    const context = await validateCommandContext(channelId, userId);
    if (!context.isValid) {
      return {
        text: `❌ ${context.message}`,
        response_type: 'ephemeral'
      };
    }

    if (!text || text.trim() === '') {
      return {
        text: '❓ Please specify a user to transfer leadership to: `/rpg-guild-transfer @username`',
        response_type: 'ephemeral'
      };
    }

    // Parse user mention
    const userMatch = text.match(/<@([A-Z0-9]+)>/);
    if (!userMatch) {
      return {
        text: '❓ Please mention a user to transfer leadership to: `/rpg-guild-transfer @username`',
        response_type: 'ephemeral'
      };
    }

    const newLeaderUserId = userMatch[1];
    
    // Get guild name from context
    let guildName = null;
    if (context.guild) {
      guildName = context.guild.name;
    } else {
      return {
        text: '❌ Please run this command from the guild channel.',
        response_type: 'ephemeral'
      };
    }

    const result = await transferGuildLeadership(userId, newLeaderUserId, guildName);

    return {
      text: `👑 **Leadership Transferred**

**${result.newLeader}** is now the leader of **${result.guildName}**!

The guild is in good hands. Thank you for your leadership, **${result.oldLeader}**! ⚔️`,
      response_type: 'in_channel'
    };

  } catch (error) {
    console.error('Guild transfer command error:', error);
    return {
      text: `❌ Failed to transfer leadership: ${error.message}`,
      response_type: 'ephemeral'
    };
  }
}

// Helper Functions

function parseGuildCreateArgs(text) {
  try {
    if (!text || text.trim() === '') {
      return { isValid: false, error: 'Missing required arguments' };
    }

    // Match: <#C123456|channel-name> "Guild Name" component1,component2 label1,label2
    const pattern = /<#([A-Z0-9]+)\|([^>]+)>\s+"([^"]+)"\s+([^\s]+)(?:\s+(.+))?/;
    const match = text.match(pattern);
    
    if (!match) {
      return { isValid: false, error: 'Invalid format' };
    }

    const [, channelId, channelName, guildName, componentsStr, labelsStr] = match;
    
    const components = componentsStr.split(',').map(c => c.trim()).filter(c => c);
    const labels = labelsStr ? labelsStr.split(',').map(l => l.trim()).filter(l => l) : [];
    
    if (!channelId || !channelName || !guildName || components.length === 0) {
      return { isValid: false, error: 'Missing required fields' };
    }

    return {
      isValid: true,
      channelId,
      channelName,
      guildName,
      components,
      labels
    };

  } catch (error) {
    return { isValid: false, error: 'Failed to parse arguments' };
  }
}

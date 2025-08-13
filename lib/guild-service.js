import { db } from './firebase.js';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  collection, 
  query, 
  where, 
  getDocs, 
  arrayUnion, 
  arrayRemove,
  addDoc,
  orderBy
} from 'firebase/firestore';
import { getUserBySlackId } from './user-service.js';

export async function createGuild(creatorSlackId, slackChannelId, slackChannelName, guildName, jiraComponents = [], jiraLabels = [], project = null) {
  // Get creator user data
  const creator = await getUserBySlackId(creatorSlackId);
  if (!creator) {
    throw new Error('Creator must be registered in the RPG system');
  }

  // Check if channel is already assigned to a guild
  const existingGuild = await getGuildByChannelId(slackChannelId);
  if (existingGuild) {
    throw new Error(`Channel #${slackChannelName} is already assigned to guild "${existingGuild.name}"`);
  }

  // Check if guild name is already taken
  const nameCheck = await getGuildByName(guildName);
  if (nameCheck) {
    throw new Error(`Guild name "${guildName}" is already taken`);
  }

  // Create guild document
  const guildData = {
    name: guildName,
    slackChannelId: slackChannelId,
    slackChannelName: slackChannelName,
    leaderId: creator.jiraUsername, // Use email as consistent ID
    createdAt: new Date(),
    createdBy: creator.jiraUsername,
    description: `${guildName} guild`,
    
    // JIRA Integration
    jiraComponents: jiraComponents,
    jiraLabels: jiraLabels,
    project: project,
    
    // Member management - leader is first member
    members: [{
      email: creator.jiraUsername,
      slackUserId: creator.slackUserId,
      displayName: creator.displayName,
      joinedAt: new Date(),
      role: 'leader'
    }],
    
    // Guild stats
    totalXp: creator.xp || 0,
    averageLevel: creator.level || 1,
    totalTickets: creator.totalTickets || 0,
    activeMembers: 1,
    
    // Settings
    isActive: true,
    maxMembers: 50,
    allowAutoJoin: true
  };

  // Add guild to Firestore
  const guildRef = await addDoc(collection(db, 'guilds'), guildData);
  
  // Add guild ID to user's guilds array
  const userRef = doc(db, 'users', creator.jiraUsername);
  await updateDoc(userRef, {
    guilds: arrayUnion(guildRef.id)
  });

  return {
    id: guildRef.id,
    ...guildData
  };
}

export async function joinGuild(userSlackId, guildName) {
  // Get user data
  const user = await getUserBySlackId(userSlackId);
  if (!user) {
    throw new Error('User must be registered in the RPG system');
  }

  // Find guild by name
  const guild = await getGuildByName(guildName);
  if (!guild) {
    throw new Error(`Guild "${guildName}" not found`);
  }

  // Check if user is already a member
  const isAlreadyMember = guild.members.some(member => member.email === user.jiraUsername);
  if (isAlreadyMember) {
    throw new Error(`You are already a member of "${guildName}"`);
  }

  // Check if guild is at capacity
  if (guild.members.length >= guild.maxMembers) {
    throw new Error(`Guild "${guildName}" is at maximum capacity (${guild.maxMembers} members)`);
  }

  // Add user to guild members
  const newMember = {
    email: user.jiraUsername,
    slackUserId: user.slackUserId,
    displayName: user.displayName,
    joinedAt: new Date(),
    role: 'member'
  };

  const guildRef = doc(db, 'guilds', guild.id);
  await updateDoc(guildRef, {
    members: arrayUnion(newMember),
    activeMembers: guild.members.length + 1
  });

  // Add guild to user's guilds array
  const userRef = doc(db, 'users', user.jiraUsername);
  await updateDoc(userRef, {
    guilds: arrayUnion(guild.id)
  });

  // Update guild stats
  await updateGuildStats(guild.id);

  return {
    guildName: guild.name,
    channelName: guild.slackChannelName,
    memberCount: guild.members.length + 1
  };
}

export async function leaveGuild(userSlackId, guildName) {
  // Get user data
  const user = await getUserBySlackId(userSlackId);
  if (!user) {
    throw new Error('User must be registered in the RPG system');
  }

  // Find guild by name
  const guild = await getGuildByName(guildName);
  if (!guild) {
    throw new Error(`Guild "${guildName}" not found`);
  }

  // Check if user is a member
  const memberIndex = guild.members.findIndex(member => member.email === user.jiraUsername);
  if (memberIndex === -1) {
    throw new Error(`You are not a member of "${guildName}"`);
  }

  const isLeader = guild.leaderId === user.jiraUsername;
  
  // If leader is leaving and there are other members, require replacement designation
  if (isLeader && guild.members.length > 1) {
    throw new Error('As guild leader, you must transfer leadership before leaving. Use `/rpg-guild-transfer @user` first.');
  }

  // Remove user from guild members
  const updatedMembers = guild.members.filter(member => member.email !== user.jiraUsername);
  
  const guildRef = doc(db, 'guilds', guild.id);
  
  // If this is the last member, deactivate the guild
  if (updatedMembers.length === 0) {
    await updateDoc(guildRef, {
      members: [],
      activeMembers: 0,
      isActive: false,
      leaderId: null
    });
  } else {
    await updateDoc(guildRef, {
      members: updatedMembers,
      activeMembers: updatedMembers.length
    });
    
    // Update guild stats
    await updateGuildStats(guild.id);
  }

  // Remove guild from user's guilds array
  const userRef = doc(db, 'users', user.jiraUsername);
  await updateDoc(userRef, {
    guilds: arrayRemove(guild.id)
  });

  return {
    guildName: guild.name,
    remainingMembers: updatedMembers.length,
    wasLeader: isLeader
  };
}

export async function transferGuildLeadership(currentLeaderSlackId, newLeaderSlackId, guildName) {
  // Get current leader data
  const currentLeader = await getUserBySlackId(currentLeaderSlackId);
  if (!currentLeader) {
    throw new Error('Current leader not found in RPG system');
  }

  // Get new leader data
  const newLeader = await getUserBySlackId(newLeaderSlackId);
  if (!newLeader) {
    throw new Error('New leader must be registered in the RPG system');
  }

  // Find guild
  const guild = await getGuildByName(guildName);
  if (!guild) {
    throw new Error(`Guild "${guildName}" not found`);
  }

  // Verify current user is the leader
  if (guild.leaderId !== currentLeader.jiraUsername) {
    throw new Error('Only the guild leader can transfer leadership');
  }

  // Verify new leader is a member
  const newLeaderMember = guild.members.find(member => member.email === newLeader.jiraUsername);
  if (!newLeaderMember) {
    throw new Error(`@${newLeader.displayName} is not a member of "${guildName}"`);
  }

  // Update guild leadership
  const updatedMembers = guild.members.map(member => {
    if (member.email === currentLeader.jiraUsername) {
      return { ...member, role: 'member' };
    } else if (member.email === newLeader.jiraUsername) {
      return { ...member, role: 'leader' };
    }
    return member;
  });

  const guildRef = doc(db, 'guilds', guild.id);
  await updateDoc(guildRef, {
    leaderId: newLeader.jiraUsername,
    members: updatedMembers
  });

  return {
    guildName: guild.name,
    oldLeader: currentLeader.displayName,
    newLeader: newLeader.displayName
  };
}

export async function kickGuildMember(leaderSlackId, targetSlackId, guildName) {
  // Get leader data
  const leader = await getUserBySlackId(leaderSlackId);
  if (!leader) {
    throw new Error('Leader not found in RPG system');
  }

  // Get target user data
  const targetUser = await getUserBySlackId(targetSlackId);
  if (!targetUser) {
    throw new Error('Target user not found in RPG system');
  }

  // Find guild
  const guild = await getGuildByName(guildName);
  if (!guild) {
    throw new Error(`Guild "${guildName}" not found`);
  }

  // Verify current user is the leader
  if (guild.leaderId !== leader.jiraUsername) {
    throw new Error('Only the guild leader can kick members');
  }

  // Can't kick yourself
  if (leader.jiraUsername === targetUser.jiraUsername) {
    throw new Error('You cannot kick yourself. Use `/rpg-guild-leave` to leave the guild.');
  }

  // Verify target is a member
  const targetMember = guild.members.find(member => member.email === targetUser.jiraUsername);
  if (!targetMember) {
    throw new Error(`@${targetUser.displayName} is not a member of "${guildName}"`);
  }

  // Remove target from guild
  const updatedMembers = guild.members.filter(member => member.email !== targetUser.jiraUsername);
  
  const guildRef = doc(db, 'guilds', guild.id);
  await updateDoc(guildRef, {
    members: updatedMembers,
    activeMembers: updatedMembers.length
  });

  // Remove guild from target user's guilds array
  const userRef = doc(db, 'users', targetUser.jiraUsername);
  await updateDoc(userRef, {
    guilds: arrayRemove(guild.id)
  });

  // Update guild stats
  await updateGuildStats(guild.id);

  return {
    guildName: guild.name,
    kickedUser: targetUser.displayName,
    remainingMembers: updatedMembers.length
  };
}

export async function renameGuild(leaderSlackId, currentGuildName, newGuildName) {
  // Get leader data
  const leader = await getUserBySlackId(leaderSlackId);
  if (!leader) {
    throw new Error('Leader not found in RPG system');
  }

  // Find current guild
  const guild = await getGuildByName(currentGuildName);
  if (!guild) {
    throw new Error(`Guild "${currentGuildName}" not found`);
  }

  // Verify current user is the leader
  if (guild.leaderId !== leader.jiraUsername) {
    throw new Error('Only the guild leader can rename the guild');
  }

  // Check if new name is already taken
  const nameCheck = await getGuildByName(newGuildName);
  if (nameCheck) {
    throw new Error(`Guild name "${newGuildName}" is already taken`);
  }

  // Update guild name
  const guildRef = doc(db, 'guilds', guild.id);
  await updateDoc(guildRef, {
    name: newGuildName
  });

  return {
    oldName: currentGuildName,
    newName: newGuildName,
    channelName: guild.slackChannelName
  };
}

export async function getGuildByName(guildName) {
  const guildsRef = collection(db, 'guilds');
  const q = query(guildsRef, where('name', '==', guildName));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    return null;
  }
  
  return {
    id: querySnapshot.docs[0].id,
    ...querySnapshot.docs[0].data()
  };
}

export async function getGuildByChannelId(channelId) {
  const guildsRef = collection(db, 'guilds');
  const q = query(guildsRef, where('slackChannelId', '==', channelId));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    return null;
  }
  
  return {
    id: querySnapshot.docs[0].id,
    ...querySnapshot.docs[0].data()
  };
}

export async function getGuildById(guildId) {
  const guildRef = doc(db, 'guilds', guildId);
  const guildSnap = await getDoc(guildRef);
  
  if (!guildSnap.exists()) {
    return null;
  }
  
  return {
    id: guildId,
    ...guildSnap.data()
  };
}

export async function getAllActiveGuilds() {
  const guildsRef = collection(db, 'guilds');
  const q = query(guildsRef, where('isActive', '==', true), orderBy('name'));
  const querySnapshot = await getDocs(q);
  
  const guilds = [];
  querySnapshot.forEach((doc) => {
    guilds.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  return guilds;
}

export async function getGuildsByUser(userSlackId) {
  const user = await getUserBySlackId(userSlackId);
  if (!user || !user.guilds) {
    return [];
  }

  const guilds = [];
  for (const guildId of user.guilds) {
    const guild = await getGuildById(guildId);
    if (guild && guild.isActive) {
      guilds.push(guild);
    }
  }
  
  return guilds;
}

export async function findGuildsForTicket(ticketComponents = [], ticketLabels = []) {
  const guildsRef = collection(db, 'guilds');
  const activeGuildsQuery = query(guildsRef, where('isActive', '==', true));
  const querySnapshot = await getDocs(activeGuildsQuery);
  
  const matchingGuilds = [];
  
  querySnapshot.forEach((doc) => {
    const guild = { id: doc.id, ...doc.data() };
    
    // Check if any ticket components match guild components
    const componentMatch = ticketComponents.some(component => 
      guild.jiraComponents.includes(component)
    );
    
    // Check if any ticket labels match guild labels
    const labelMatch = ticketLabels.some(label => 
      guild.jiraLabels.includes(label)
    );
    
    if (componentMatch || labelMatch) {
      matchingGuilds.push(guild);
    }
  });
  
  return matchingGuilds;
}

export async function validateGuildLeadership(userSlackId, guildName) {
  const user = await getUserBySlackId(userSlackId);
  if (!user) {
    return { isValid: false, error: 'User not registered in RPG system' };
  }

  const guild = await getGuildByName(guildName);
  if (!guild) {
    return { isValid: false, error: `Guild "${guildName}" not found` };
  }

  if (guild.leaderId !== user.jiraUsername) {
    return { isValid: false, error: 'Only the guild leader can perform this action' };
  }

  return { isValid: true, guild, user };
}

async function updateGuildStats(guildId) {
  const guild = await getGuildById(guildId);
  if (!guild) return;

  let totalXp = 0;
  let totalLevel = 0;
  let totalTickets = 0;

  // Calculate stats from all members
  for (const member of guild.members) {
    const userRef = doc(db, 'users', member.email);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      totalXp += userData.xp || 0;
      totalLevel += userData.level || 1;
      totalTickets += userData.totalTickets || 0;
    }
  }

  const averageLevel = guild.members.length > 0 ? totalLevel / guild.members.length : 1;

  // Update guild stats
  const guildRef = doc(db, 'guilds', guildId);
  await updateDoc(guildRef, {
    totalXp,
    averageLevel: Math.round(averageLevel * 10) / 10, // Round to 1 decimal
    totalTickets,
    activeMembers: guild.members.length
  });
}
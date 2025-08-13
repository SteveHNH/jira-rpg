import { db } from './firebase.js';
import { doc, getDoc, setDoc, updateDoc, increment, collection, query, where, getDocs } from 'firebase/firestore';
import { calculateLevel, getTitleForLevel, checkLevelUp, calculateXpAward } from './xp-calculator.js';

// Helper function to get user by Slack ID
export async function getUserBySlackId(slackUserId) {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('slackUserId', '==', slackUserId));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    return null;
  }
  
  return {
    id: querySnapshot.docs[0].id,
    ...querySnapshot.docs[0].data()
  };
}

// Note: calculateLevel function now imported from xp-calculator.js

// Helper function to award XP
export async function awardXP(userEmail, xpAmount, reason) {
  const userRef = doc(db, 'users', userEmail);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    throw new Error('User not found');
  }
  
  const currentData = userSnap.data();
  const oldXp = currentData.xp || 0;
  const newXp = oldXp + xpAmount;
  const newLevel = calculateLevel(newXp);
  const newTitle = getTitleForLevel(newLevel);
  
  // Check for level up
  const levelUpInfo = checkLevelUp(oldXp, newXp);
  
  // Update user data with new XP, level, and title
  await updateDoc(userRef, {
    xp: newXp,
    level: newLevel,
    currentTitle: newTitle,
    lastActivity: new Date()
  });
  
  return {
    xpAwarded: xpAmount,
    reason,
    totalXp: newXp,
    ...levelUpInfo
  };
}

// Helper function to create a new user
export async function createUser(slackUserId, userName, email) {
  // Check if user already exists by Slack ID
  const existingUserBySlack = await getUserBySlackId(slackUserId);
  if (existingUserBySlack) {
    throw new Error('User already registered with this Slack account');
  }
  
  // Check if user already exists by email
  const userRef = doc(db, 'users', email);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    throw new Error('User already registered with this email');
  }
  
  // Create new user document
  const newUserData = {
    slackUserId: slackUserId,
    jiraUsername: email,
    displayName: userName,
    xp: 0,
    level: 1,
    currentTitle: getTitleForLevel(1),
    guilds: [],
    achievements: [],
    totalTickets: 0,
    totalBugs: 0,
    createdAt: new Date(),
    lastActivity: new Date()
  };
  
  await setDoc(userRef, newUserData);
  
  return {
    email: email,
    ...newUserData
  };
}

// Helper function to award XP from JIRA webhook payload
export async function awardXpFromWebhook(userEmail, webhookPayload) {
  const xpAward = calculateXpAward(webhookPayload);
  
  if (xpAward.xp === 0) {
    return {
      xpAwarded: 0,
      reason: xpAward.reason,
      leveledUp: false
    };
  }
  
  return await awardXP(userEmail, xpAward.xp, xpAward.reason);
}

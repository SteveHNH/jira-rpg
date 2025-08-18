import { db } from './firebase.js';
import { doc, getDoc, setDoc, updateDoc, increment, collection, query, where, getDocs, or } from 'firebase/firestore';
import { calculateLevel, getTitleForLevel, checkLevelUp, calculateXpAward } from './xp-calculator.js';
import jiraClient from './jira-client.js';

// Quick Firebase connection test
export async function testFirebaseConnection() {
  try {
    console.log('Testing Firebase connection...');
    const testRef = collection(db, 'users');
    const testQuery = query(testRef, where('__test__', '==', 'test'));
    const start = Date.now();
    await getDocs(testQuery);
    const duration = Date.now() - start;
    console.log(`Firebase connection test completed in ${duration}ms`);
    return { healthy: true, duration };
  } catch (error) {
    console.error('Firebase connection test failed:', error);
    return { healthy: false, error: error.message };
  }
}

// Enhanced user lookup functions with multiple identifier support

// Helper function to get user by Slack ID
export async function getUserBySlackId(slackUserId) {
  try {
    console.log('Starting Firebase query for slackUserId:', slackUserId);
    
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('slackUserId', '==', slackUserId));
    
    console.log('Executing Firebase query...');
    const querySnapshot = await getDocs(q);
    console.log('Firebase query completed, empty:', querySnapshot.empty, 'size:', querySnapshot.size);
    
    if (querySnapshot.empty) {
      console.log('No user found with slackUserId:', slackUserId);
      return null;
    }
    
    const userData = {
      id: querySnapshot.docs[0].id,
      ...querySnapshot.docs[0].data()
    };
    
    console.log('User found:', userData.id, 'jiraUsername:', userData.jiraUsername);
    return userData;
    
  } catch (error) {
    console.error('Firebase getUserBySlackId error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack?.substring(0, 500)
    });
    throw error;
  }
}

// Enhanced function to find user by multiple JIRA identifiers
export async function getUserByJiraIdentifier(webhookUser) {
  const { emailAddress, name, accountId, displayName } = webhookUser;
  
  // Strategy 1: Try direct document lookup by email (legacy support)
  if (emailAddress) {
    const userRef = doc(db, 'users', emailAddress);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return {
        id: emailAddress,
        ...userSnap.data()
      };
    }
  }
  
  // Strategy 2: Search by multiple identifiers using compound queries
  const usersRef = collection(db, 'users');
  const searchFields = [];
  
  if (name) searchFields.push(where('jiraUsername', '==', name));
  if (accountId) searchFields.push(where('jiraAccountId', '==', accountId));
  if (emailAddress) searchFields.push(where('email', '==', emailAddress));
  
  // Execute searches in priority order
  for (const searchField of searchFields) {
    const q = query(usersRef, searchField);
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      return {
        id: querySnapshot.docs[0].id,
        ...userData
      };
    }
  }
  
  // Strategy 3: Fuzzy match by display name (last resort)
  if (displayName) {
    const allUsersQuery = query(usersRef);
    const allUsersSnapshot = await getDocs(allUsersQuery);
    
    for (const userDoc of allUsersSnapshot.docs) {
      const userData = userDoc.data();
      if (userData.displayName && 
          userData.displayName.toLowerCase() === displayName.toLowerCase()) {
        console.log(`Fuzzy matched user by displayName: ${displayName}`);
        return {
          id: userDoc.id,
          ...userData
        };
      }
    }
  }
  
  return null;
}

// Function to validate JIRA username exists
export async function validateJiraUsername(username) {
  try {
    // Use JIRA API to search for user by username
    const response = await jiraClient.httpClient.get(`/rest/api/2/user/search`, {
      params: { username: username, maxResults: 1 }
    });
    
    if (response.data && response.data.length > 0) {
      const user = response.data[0];
      return {
        valid: true,
        user: {
          accountId: user.accountId,
          username: user.name,
          displayName: user.displayName,
          emailAddress: user.emailAddress
        }
      };
    }
    
    return { valid: false, error: 'Username not found in JIRA' };
    
  } catch (error) {
    console.error('JIRA username validation failed:', error);
    return { valid: false, error: 'Failed to validate username with JIRA API' };
  }
}

// Note: calculateLevel function now imported from xp-calculator.js

// Helper function to award XP with optional quest/bug tracking
export async function awardXP(userEmail, xpAmount, reason, options = {}) {
  const { isTicketCompletion = false, isBugFix = false } = options;
  
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
  
  // Build update object with XP and level changes
  const updates = {
    xp: newXp,
    level: newLevel,
    currentTitle: newTitle,
    lastActivity: new Date()
  };
  
  // Add counter increments if applicable
  if (isTicketCompletion) {
    updates.totalTickets = increment(1);
  }
  
  if (isBugFix) {
    updates.totalBugs = increment(1);
  }
  
  // Perform atomic update with all changes
  await updateDoc(userRef, updates);
  
  return {
    xpAwarded: xpAmount,
    reason,
    totalXp: newXp,
    tracking: {
      ticketCompleted: isTicketCompletion,
      bugFixed: isBugFix
    },
    ...levelUpInfo
  };
}

// Enhanced function to create user with JIRA username
export async function createUser(slackUserId, userName, jiraUsername) {
  // Check if user already exists by Slack ID
  const existingUserBySlack = await getUserBySlackId(slackUserId);
  if (existingUserBySlack) {
    throw new Error('User already registered with this Slack account');
  }
  
  // Validate JIRA username exists
  const jiraValidation = await validateJiraUsername(jiraUsername);
  if (!jiraValidation.valid) {
    throw new Error(`JIRA username validation failed: ${jiraValidation.error}`);
  }
  
  const jiraUser = jiraValidation.user;
  
  // Use jiraUsername as document ID for consistent lookup
  const userRef = doc(db, 'users', jiraUsername);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    throw new Error('User already registered with this JIRA username');
  }
  
  // Create enhanced user document with multiple identifiers
  const newUserData = {
    slackUserId: slackUserId,
    jiraUsername: jiraUsername,
    jiraAccountId: jiraUser.accountId,
    email: jiraUser.emailAddress || null,
    displayName: userName,
    jiraDisplayName: jiraUser.displayName,
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
    id: jiraUsername,
    ...newUserData
  };
}

// Legacy function for backward compatibility
export async function createUserWithEmail(slackUserId, userName, email) {
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
  
  // Create legacy user document (email as document ID)
  const newUserData = {
    slackUserId: slackUserId,
    jiraUsername: email, // Legacy: email stored as jiraUsername
    email: email,
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
    id: email,
    ...newUserData
  };
}

// Enhanced function to award XP from JIRA webhook with flexible user lookup and tracking
export async function awardXpFromWebhook(userIdentifier, webhookPayload) {
  const xpAward = calculateXpAward(webhookPayload);
  
  if (xpAward.xp === 0) {
    return {
      xpAwarded: 0,
      reason: xpAward.reason,
      leveledUp: false,
      tracking: {
        ticketCompleted: false,
        bugFixed: false
      }
    };
  }
  
  // Extract tracking information from XP calculation
  const trackingOptions = {
    isTicketCompletion: xpAward.tracking?.isTicketCompletion || false,
    isBugFix: xpAward.tracking?.isBugFix || false
  };
  
  return await awardXP(userIdentifier, xpAward.xp, xpAward.reason, trackingOptions);
}

// Function to auto-create user from webhook data when not found
export async function createUserFromWebhook(webhookUser) {
  const { emailAddress, name, accountId, displayName } = webhookUser;
  
  // Determine best identifier for document ID
  const documentId = name || accountId || emailAddress || `unknown-${Date.now()}`;
  
  console.log(`Auto-creating user from webhook: ${documentId}`);
  
  const newUserData = {
    slackUserId: null, // Will be linked when user registers
    jiraUsername: name || null,
    jiraAccountId: accountId || null,
    email: emailAddress || null,
    displayName: displayName || name || 'Unknown User',
    jiraDisplayName: displayName,
    xp: 0,
    level: 1,
    currentTitle: getTitleForLevel(1),
    guilds: [],
    achievements: [],
    totalTickets: 0,
    totalBugs: 0,
    createdAt: new Date(),
    lastActivity: new Date(),
    autoCreated: true // Flag to indicate this was auto-created
  };
  
  const userRef = doc(db, 'users', documentId);
  await setDoc(userRef, newUserData);
  
  return {
    id: documentId,
    ...newUserData
  };
}

import { db } from './firebase.js';
import { doc, getDoc, setDoc, updateDoc, increment, collection, query, where, getDocs } from 'firebase/firestore';

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

// Helper function to calculate user level from XP
export function calculateLevel(xp) {
  if (xp < 160) return 1;
  if (xp < 360) return 2;
  if (xp < 600) return 3;
  // ... rest of level calculation
  return Math.floor(xp / 500) + 1; // Simplified for example
}

// Helper function to award XP
export async function awardXP(userEmail, xpAmount, reason) {
  const userRef = doc(db, 'users', userEmail);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    throw new Error('User not found');
  }
  
  const currentData = userSnap.data();
  const newXP = currentData.xp + xpAmount;
  const newLevel = calculateLevel(newXP);
  
  await updateDoc(userRef, {
    xp: newXP,
    level: newLevel,
    lastActivity: new Date()
  });
  
  // Return level up info if they leveled up
  return {
    leveledUp: newLevel > currentData.level,
    oldLevel: currentData.level,
    newLevel: newLevel,
    totalXP: newXP
  };
}

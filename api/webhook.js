import { db } from '../lib/firebase.js';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

export default async function handler(req, res) {
  // Log the incoming request for debugging
  console.log('Webhook received:', {
    method: req.method,
    body: req.body,
    headers: req.headers
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Handle missing or malformed data gracefully
    if (!req.body || !req.body.user) {
      console.log('Invalid payload structure');
      return res.status(400).json({ 
        error: 'Invalid payload', 
        received: req.body 
      });
    }

    const { issue, user } = req.body;
    
    // Use email or name as user identifier
    const userId = user.emailAddress || user.name || user.displayName || 'unknown-user';
    
    console.log('Processing for user:', userId);
    
    // Get user data
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      console.log('Creating new user:', userId);
      // Create new user
      await setDoc(userRef, {
        slackUserId: null,
        jiraUsername: user.name || userId,
        displayName: user.displayName || user.name || userId,
        xp: 0,
        level: 1,
        currentTitle: "Novice Adventurer",
        joinedAt: new Date(),
        lastActivity: new Date()
      });
    }
    
    // Award XP (simplified - just give 50 XP for any webhook)
    console.log('Awarding XP to user:', userId);
    await updateDoc(userRef, {
      xp: increment(50),
      lastActivity: new Date()
    });
    
    console.log('Webhook processed successfully');
    
    res.status(200).json({ 
      success: true, 
      message: 'User XP updated',
      userId: userId,
      xpAwarded: 50
    });
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}


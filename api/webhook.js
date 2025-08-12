import { db } from '../lib/firebase.js';
import { doc, setDoc, updateDoc, increment } from 'firebase/firestore';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse JIRA webhook data
    const { issue, user } = req.body;
    
    // Update user XP in Firestore
    const userRef = doc(db, 'users', user.emailAddress);
    await updateDoc(userRef, {
      xp: increment(50), // Add 50 XP for ticket completion
      lastActivity: new Date()
    });

    // Generate and post story (you'll add this logic)
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

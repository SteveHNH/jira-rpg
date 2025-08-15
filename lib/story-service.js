// lib/story-service.js - Story persistence and retrieval service

import { db } from './firebase.js';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  addDoc 
} from 'firebase/firestore';

/**
 * Saves a generated story to Firebase
 * @param {Object} storyData - Story data to save
 * @param {string} storyData.userJiraUsername - User's JIRA username
 * @param {string} storyData.ticketKey - JIRA ticket key
 * @param {string} storyData.narrative - Generated story narrative
 * @param {Object} storyData.ticketData - Original ticket data
 * @param {Object} storyData.xpAward - XP award details
 * @param {Array} storyData.guilds - Guilds this story was sent to
 * @param {string} storyData.status - JIRA ticket status (e.g., "In Progress", "Done")
 * @returns {Promise<string>} - Document ID of saved story
 */
export async function saveStory(storyData) {
  try {
    // Extract status from ticketData if not provided directly
    const ticketStatus = storyData.status || storyData.ticketData?.status || 'Unknown';
    
    // Check if story already exists for this user+ticket+status combination
    const existingStory = await getStoryByTicketAndStatus(storyData.userJiraUsername, storyData.ticketKey, ticketStatus);
    if (existingStory) {
      console.log('Story already exists for ticket:', storyData.ticketKey, 'status:', ticketStatus, '- skipping duplicate save');
      return existingStory.id;
    }

    const storyDocument = {
      userJiraUsername: storyData.userJiraUsername,
      ticketKey: storyData.ticketKey,
      status: ticketStatus,
      narrative: storyData.narrative,
      ticketData: storyData.ticketData,
      xpAward: storyData.xpAward,
      guilds: storyData.guilds || [],
      createdAt: new Date(),
      timestamp: storyData.timestamp || new Date().toISOString()
    };

    const storiesRef = collection(db, 'stories');
    const docRef = await addDoc(storiesRef, storyDocument);
    
    console.log('Story saved with ID:', docRef.id, 'for ticket:', storyData.ticketKey, 'status:', ticketStatus);
    return docRef.id;

  } catch (error) {
    console.error('Error saving story:', error);
    throw error;
  }
}

/**
 * Retrieves recent stories for a user, showing only the latest status per ticket
 * @param {string} userJiraUsername - User's JIRA username
 * @param {number} limitCount - Maximum number of tickets to return (default: 10)
 * @returns {Promise<Array>} - Array of recent stories (latest status per ticket)
 */
export async function getRecentStories(userJiraUsername, limitCount = 10) {
  try {
    const storiesRef = collection(db, 'stories');
    
    // Fetch all stories for the user ordered by creation date (most recent first)
    const q = query(
      storiesRef,
      where('userJiraUsername', '==', userJiraUsername),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const allStories = [];

    querySnapshot.forEach((doc) => {
      allStories.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Group by ticket key and keep only the most recent status per ticket
    const ticketMap = new Map();
    
    for (const story of allStories) {
      const ticketKey = story.ticketKey;
      
      // Only keep the first (most recent) story for each ticket
      if (!ticketMap.has(ticketKey)) {
        ticketMap.set(ticketKey, story);
      }
    }

    // Convert back to array and limit results
    const uniqueStories = Array.from(ticketMap.values())
      .slice(0, limitCount);

    console.log(`Retrieved ${uniqueStories.length} unique recent stories (latest status per ticket) for user: ${userJiraUsername}`);
    return uniqueStories;

  } catch (error) {
    console.error('Error retrieving recent stories:', error);
    return []; // Return empty array on error to prevent crashes
  }
}

/**
 * Retrieves a specific story by ticket key (latest status)
 * @param {string} userJiraUsername - User's JIRA username
 * @param {string} ticketKey - JIRA ticket key
 * @returns {Promise<Object|null>} - Story data or null if not found
 */
export async function getStoryByTicket(userJiraUsername, ticketKey) {
  try {
    const storiesRef = collection(db, 'stories');
    const q = query(
      storiesRef,
      where('userJiraUsername', '==', userJiraUsername),
      where('ticketKey', '==', ticketKey),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    };

  } catch (error) {
    console.error('Error retrieving story by ticket:', error);
    return null;
  }
}

/**
 * Retrieves a specific story by ticket key and status
 * @param {string} userJiraUsername - User's JIRA username
 * @param {string} ticketKey - JIRA ticket key
 * @param {string} status - JIRA ticket status
 * @returns {Promise<Object|null>} - Story data or null if not found
 */
export async function getStoryByTicketAndStatus(userJiraUsername, ticketKey, status) {
  try {
    const storiesRef = collection(db, 'stories');
    const q = query(
      storiesRef,
      where('userJiraUsername', '==', userJiraUsername),
      where('ticketKey', '==', ticketKey),
      where('status', '==', status),
      limit(1)
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    };

  } catch (error) {
    console.error('Error retrieving story by ticket and status:', error);
    return null;
  }
}

/**
 * Gets story statistics for a user
 * @param {string} userJiraUsername - User's JIRA username
 * @returns {Promise<Object>} - Story statistics
 */
export async function getStoryStats(userJiraUsername) {
  try {
    const storiesRef = collection(db, 'stories');
    const q = query(
      storiesRef,
      where('userJiraUsername', '==', userJiraUsername)
    );

    const querySnapshot = await getDocs(q);
    
    let totalXp = 0;
    let totalTickets = querySnapshot.size;
    let latestStory = null;
    
    querySnapshot.forEach((doc) => {
      const story = doc.data();
      if (story.xpAward?.xp) {
        totalXp += story.xpAward.xp;
      }
      
      if (!latestStory || story.createdAt > latestStory.createdAt) {
        latestStory = {
          id: doc.id,
          ...story
        };
      }
    });

    return {
      totalStories: totalTickets,
      totalXpFromStories: totalXp,
      latestStory,
      userJiraUsername
    };

  } catch (error) {
    console.error('Error retrieving story stats:', error);
    return {
      totalStories: 0,
      totalXpFromStories: 0,
      latestStory: null,
      userJiraUsername
    };
  }
}
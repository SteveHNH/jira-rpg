// lib/conversation-service.js - Orchestrates conversational JIRA storytelling

import jiraClient from './jira-client.js';
import { getRecentStories } from './story-service.js';

/**
 * Handles conversational requests from users about their JIRA work
 * @param {string} userId - Slack user ID
 * @param {string} userMessage - User's message
 * @param {string} channel - Slack channel/DM ID
 * @param {Object} userData - User data from Firebase
 */
export async function handleConversationalRequest(userId, userMessage, channel, userData) {
  try {
    console.log('Processing conversational request:', {
      userId,
      userEmail: userData.jiraUsername,
      messageLength: userMessage.length
    });

    // Parse the user's intent and extract parameters
    const intent = parseUserIntent(userMessage);
    console.log('Parsed intent:', intent);

    let response;

    if (intent.needsTicketData) {
      // First try to get saved stories, then fall back to JIRA if needed
      const stories = await fetchRelevantStories(userData.jiraUsername, intent.filters);
      console.log(`Fetched ${stories.length} stories for storytelling`);

      if (stories.length === 0) {
        response = await generateNoStoriesResponse(userMessage, intent);
      } else {
        response = await generateStoriesResponse(userMessage, stories);
      }
    } else {
      // General conversation - no ticket data needed
      response = await generateGeneralResponse(userMessage);
    }

    // Send response to user
    await sendConversationalResponse(channel, response);

  } catch (error) {
    console.error('Error handling conversational request:', error);
    await sendErrorResponse(channel, error);
  }
}

/**
 * Parses user intent from natural language message
 * @param {string} message - User's message
 * @returns {Object} - Parsed intent with filters
 */
function parseUserIntent(message) {
  const lowerMessage = message.toLowerCase();
  
  // Determine if they want ticket data
  const needsTicketData = 
    lowerMessage.includes('ticket') ||
    lowerMessage.includes('task') ||
    lowerMessage.includes('work') ||
    lowerMessage.includes('did') ||
    lowerMessage.includes('completed') ||
    lowerMessage.includes('finished') ||
    lowerMessage.includes('closed') ||
    lowerMessage.includes('last') ||
    lowerMessage.includes('this') ||
    lowerMessage.includes('recent') ||
    /\d+/.test(lowerMessage); // Contains numbers like "5 tickets"

  // Extract ticket count
  const numberMatch = message.match(/(\d+)/);
  const requestedCount = numberMatch ? Math.min(parseInt(numberMatch[1]), 10) : 10;

  // Parse date range
  let dateRange = '1m'; // Default to last month
  if (lowerMessage.includes('week') || lowerMessage.includes('7')) {
    dateRange = '1w';
  } else if (lowerMessage.includes('month') || lowerMessage.includes('30')) {
    dateRange = '1m';
  } else if (lowerMessage.includes('quarter') || lowerMessage.includes('90')) {
    dateRange = '3m';
  } else if (lowerMessage.includes('year') || lowerMessage.includes('365')) {
    dateRange = '1y';
  }

  // Parse status preference
  let status = 'closed,done,resolved'; // Default to completed
  if (lowerMessage.includes('progress') || lowerMessage.includes('working')) {
    status = 'in progress,in development';
  } else if (lowerMessage.includes('open') || lowerMessage.includes('todo')) {
    status = 'open,to do,backlog';
  }

  return {
    needsTicketData,
    filters: {
      limit: requestedCount,
      dateRange,
      status
    },
    originalMessage: message
  };
}

/**
 * Fetches relevant stories (prioritizing saved stories, falling back to JIRA)
 * @param {string} userJiraUsername - JIRA username/email
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} - Array of stories
 */
async function fetchRelevantStories(userJiraUsername, filters) {
  try {
    // First, try to get saved stories from Firebase
    const savedStories = await getRecentStories(userJiraUsername, filters.limit);
    
    if (savedStories && savedStories.length > 0) {
      console.log(`Found ${savedStories.length} saved stories`);
      // Transform saved stories to a consistent format
      return savedStories.map(story => ({
        ticketKey: story.ticketKey,
        title: story.ticketData?.title || story.ticketData?.summary || 'Quest Completed',
        narrative: story.narrative,
        status: 'completed', // All saved stories are from completed tickets
        resolved: story.createdAt,
        timeSpent: story.ticketData?.timeSpent || null,
        ticketType: story.ticketData?.ticketType || 'task',
        project: { key: story.ticketData?.project || 'PROJ' },
        components: story.ticketData?.components || [],
        xpAwarded: story.xpAward?.xp || 0,
        source: 'saved_story'
      }));
    } else {
      console.log('No saved stories found, falling back to JIRA API');
      // Fall back to JIRA API if no saved stories
      const tickets = await jiraClient.fetchUserTickets(userJiraUsername, filters);
      
      // Transform JIRA tickets to consistent format
      return tickets
        .filter(ticket => ticket.resolved) // Only include resolved tickets
        .sort((a, b) => new Date(b.resolved) - new Date(a.resolved))
        .slice(0, filters.limit)
        .map(ticket => ({
          ...ticket,
          narrative: null, // No pre-generated narrative
          xpAwarded: 0, // No XP info from JIRA
          source: 'jira_api'
        }));
    }
      
  } catch (error) {
    console.error('Error fetching stories:', error);
    throw new Error('Unable to fetch your quest stories right now');
  }
}

/**
 * Generates response using story data (prioritizing saved narratives)
 * @param {string} userMessage - Original user message
 * @param {Array} stories - Array of story data
 * @returns {Promise<Object>} - Generated response
 */
async function generateStoriesResponse(userMessage, stories) {
  try {
    // Check if we have saved stories with narratives
    const hasNarratives = stories.some(story => story.narrative && story.source === 'saved_story');
    
    if (hasNarratives) {
      // Use saved epic narratives directly
      const epicTales = stories
        .filter(story => story.narrative)
        .map(story => `🎯 **${story.ticketKey}**: ${story.narrative} (+${story.xpAwarded} XP)`)
        .join('\n\n');
      
      const summary = `You've completed ${stories.length} epic quest${stories.length > 1 ? 's' : ''}! Here are your legendary tales:\n\n${epicTales}`;
      
      return {
        success: true,
        message: summary,
        metadata: {
          ticketCount: stories.length,
          ticketSummary: `${stories.length} epic stories`,
          totalXp: stories.reduce((sum, story) => sum + (story.xpAwarded || 0), 0),
          hasEpicNarratives: true
        }
      };
    } else {
      // Fall back to generating new narratives from JIRA data
      const simplifiedTickets = stories.map(story => ({
        ticketKey: story.ticketKey,
        title: story.title,
        status: story.status,
        resolved: story.resolved,
        timeSpent: story.timeSpent,
        ticketType: story.ticketType,
        project: story.project.key,
        components: story.components.slice(0, 3), // Limit to avoid token overflow
      }));

    // Build prompt for conversational model
    const prompt = `USER_REQUEST: ${userMessage}\nTICKETS: ${JSON.stringify(simplifiedTickets)}`;
    
    console.log('Calling conversational model with prompt length:', prompt.length);

    // Call Ollama conversational model
    const headers = { 'Content-Type': 'application/json' };
    
    // Add authentication if OLLAMA_API_KEY is provided
    if (process.env.OLLAMA_API_KEY) {
      headers['X-API-Key'] = process.env.OLLAMA_API_KEY;
    }
    
    console.log('Calling Ollama at:', process.env.OLLAMA_API_URL);
    
    const ollamaResponse = await fetch(`${process.env.OLLAMA_API_URL}/api/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'jira-conversational',
        prompt: prompt,
        stream: false
      })
    });

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text().catch(() => 'Unable to read error response');
      console.error('Ollama API Error Details:', {
        status: ollamaResponse.status,
        statusText: ollamaResponse.statusText,
        url: process.env.OLLAMA_API_URL,
        hasApiKey: !!process.env.OLLAMA_API_KEY,
        errorResponse: errorText
      });
      throw new Error(`Ollama API error: ${ollamaResponse.status} - ${errorText}`);
    }

    const ollamaData = await ollamaResponse.json();
    console.log('Raw Ollama response:', ollamaData.response?.substring(0, 200));

    // Parse JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(ollamaData.response);
    } catch (parseError) {
      console.error('Failed to parse Ollama response as JSON:', parseError);
      // Fallback response
      parsedResponse = {
        message: "🗡️ I've reviewed your recent coding quests, but my storytelling magic seems a bit scrambled right now. Try asking me about your work again in a moment!",
        ticketSummary: `${stories.length} stories found`
      };
    }

    return {
      success: true,
      message: parsedResponse.message,
      metadata: {
        ticketCount: stories.length,
        ticketSummary: parsedResponse.ticketSummary,
        timeRange: stories.length > 0 ? {
          earliest: stories[stories.length - 1].resolved,
          latest: stories[0].resolved
        } : null,
        hasEpicNarratives: false
      }
    };
    } // Close the else block

  } catch (error) {
    console.error('Error generating stories response:', error);
    throw error;
  }
}

/**
 * Generates response when no stories are found
 * @param {string} userMessage - Original user message
 * @param {Object} intent - Parsed user intent
 * @returns {Promise<Object>} - No stories response
 */
async function generateNoStoriesResponse(userMessage, intent) {
  const suggestions = [
    "Try asking about a longer time period (like 'last 3 months')",
    "Check if you have completed any tickets recently in JIRA",
    "Make sure your JIRA email matches your registration"
  ];

  const message = `🔍 I searched for your recent coding adventures but couldn't find any epic tales yet! This might mean:\n\n• ${suggestions.join('\n• ')}\n\nComplete some JIRA tickets to generate your legendary quest stories, or try asking about different time periods. I'm here when you're ready to hear tales of your development heroics! ⚔️`;

  return {
    success: true,
    message,
    metadata: {
      storyCount: 0,
      searchFilters: intent.filters
    }
  };
}

/**
 * Generates general conversational response
 * @param {string} userMessage - User's message
 * @returns {Promise<Object>} - General response
 */
async function generateGeneralResponse(userMessage) {
  try {
    // Build prompt for general conversation
    const prompt = `USER_REQUEST: ${userMessage}`;
    
    console.log('Generating general conversational response');

    // Call Ollama conversational model
    const headers = { 'Content-Type': 'application/json' };
    
    // Add authentication if OLLAMA_API_KEY is provided
    if (process.env.OLLAMA_API_KEY) {
      headers['X-API-Key'] = process.env.OLLAMA_API_KEY;
    }
    
    console.log('Calling Ollama at:', process.env.OLLAMA_API_URL);
    
    const ollamaResponse = await fetch(`${process.env.OLLAMA_API_URL}/api/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'jira-conversational',
        prompt: prompt,
        stream: false
      })
    });

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text().catch(() => 'Unable to read error response');
      console.error('Ollama API Error Details:', {
        status: ollamaResponse.status,
        statusText: ollamaResponse.statusText,
        url: process.env.OLLAMA_API_URL,
        hasApiKey: !!process.env.OLLAMA_API_KEY,
        errorResponse: errorText
      });
      throw new Error(`Ollama API error: ${ollamaResponse.status} - ${errorText}`);
    }

    const ollamaData = await ollamaResponse.json();

    // Parse JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(ollamaData.response);
    } catch (parseError) {
      console.error('Failed to parse Ollama response as JSON:', parseError);
      // Fallback response
      parsedResponse = {
        message: "🎮 Greetings! I'm your coding companion, ready to tell epic tales of your JIRA adventures! Ask me about your recent work, completed tickets, or what you've accomplished lately, and I'll turn your development tasks into legendary stories! ⚔️",
        ticketSummary: null
      };
    }

    return {
      success: true,
      message: parsedResponse.message,
      metadata: {
        conversationType: 'general',
        ticketSummary: parsedResponse.ticketSummary
      }
    };

  } catch (error) {
    console.error('Error generating general response:', error);
    throw error;
  }
}

/**
 * Sends conversational response to Slack
 * @param {string} channel - Slack channel/DM ID
 * @param {Object} response - Generated response
 */
async function sendConversationalResponse(channel, response) {
  try {
    const message = {
      text: response.message,
      mrkdwn: true
    };

    // Add metadata as thread reply if useful
    if (response.metadata?.ticketCount > 0) {
      console.log(`Sending response about ${response.metadata.ticketCount} tickets`);
    }

    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel,
        ...message
      })
    });

    console.log('Conversational response sent successfully');

  } catch (error) {
    console.error('Error sending conversational response:', error);
    throw error;
  }
}

/**
 * Sends error response to user
 * @param {string} channel - Slack channel/DM ID
 * @param {Error} error - Error object
 */
async function sendErrorResponse(channel, error) {
  try {
    let errorMessage = "⚠️ Something went wrong while crafting your epic tale! ";
    
    if (error.message.includes('JIRA')) {
      errorMessage += "I'm having trouble connecting to JIRA right now. Please try again in a moment.";
    } else if (error.message.includes('Ollama')) {
      errorMessage += "My storytelling magic is temporarily offline. Please try again shortly.";
    } else {
      errorMessage += "Our wizards are looking into it! Try asking about your JIRA work again in a moment.";
    }

    errorMessage += " 🔮";

    const message = {
      text: errorMessage
    };

    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel,
        ...message
      })
    });

  } catch (sendError) {
    console.error('Error sending error response:', sendError);
  }
}

/**
 * Health check for conversation service dependencies
 * @returns {Promise<Object>} - Health status
 */
export async function conversationHealthCheck() {
  try {
    const checks = {
      jira: await jiraClient.healthCheck(),
      ollama: await checkOllamaHealth(),
      slack: checkSlackConfig()
    };

    const healthy = checks.jira.healthy && checks.ollama.healthy && checks.slack.healthy;

    return {
      healthy,
      checks,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Checks Ollama API health
 * @returns {Promise<Object>} - Ollama health status
 */
async function checkOllamaHealth() {
  try {
    const headers = { 'Content-Type': 'application/json' };
    
    // Add authentication if OLLAMA_API_KEY is provided
    if (process.env.OLLAMA_API_KEY) {
      headers['X-API-Key'] = process.env.OLLAMA_API_KEY;
    }
    
    const response = await fetch(`${process.env.OLLAMA_API_URL}/api/tags`, {
      method: 'GET',
      headers
    });

    if (response.ok) {
      const data = await response.json();
      const hasConversationalModel = data.models?.some(model => 
        model.name === 'jira-conversational' || model.name.includes('jira-conversational')
      );

      return {
        healthy: true,
        modelsAvailable: data.models?.length || 0,
        hasConversationalModel
      };
    } else {
      return {
        healthy: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

  } catch (error) {
    return {
      healthy: false,
      error: error.message
    };
  }
}

/**
 * Checks Slack configuration
 * @returns {Object} - Slack config health
 */
function checkSlackConfig() {
  const hasToken = !!process.env.SLACK_BOT_TOKEN;
  const hasSigningSecret = !!process.env.SLACK_SIGNING_SECRET;

  return {
    healthy: hasToken && hasSigningSecret,
    hasToken,
    hasSigningSecret
  };
}
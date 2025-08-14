// lib/conversation-service.js - Orchestrates conversational JIRA storytelling

import jiraClient from './jira-client.js';

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
      // Fetch JIRA tickets based on the user's request
      const tickets = await fetchRelevantTickets(userData.jiraUsername, intent.filters);
      console.log(`Fetched ${tickets.length} tickets for storytelling`);

      if (tickets.length === 0) {
        response = await generateNoTicketsResponse(userMessage, intent);
      } else {
        response = await generateTicketStoryResponse(userMessage, tickets);
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
 * Fetches relevant JIRA tickets based on user filters
 * @param {string} userEmail - JIRA email address
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} - Array of tickets
 */
async function fetchRelevantTickets(userEmail, filters) {
  try {
    const tickets = await jiraClient.fetchUserTickets(userEmail, filters);
    
    // Sort by resolution date (most recent first) and limit
    return tickets
      .filter(ticket => ticket.resolved) // Only include resolved tickets
      .sort((a, b) => new Date(b.resolved) - new Date(a.resolved))
      .slice(0, filters.limit);
      
  } catch (error) {
    console.error('Error fetching JIRA tickets:', error);
    throw new Error('Unable to fetch your JIRA tickets right now');
  }
}

/**
 * Generates story response using ticket data
 * @param {string} userMessage - Original user message
 * @param {Array} tickets - Array of ticket data
 * @returns {Promise<Object>} - Generated response
 */
async function generateTicketStoryResponse(userMessage, tickets) {
  try {
    // Prepare simplified ticket data for the model
    const simplifiedTickets = tickets.map(ticket => ({
      ticketKey: ticket.ticketKey,
      title: ticket.title,
      status: ticket.status,
      resolved: ticket.resolved,
      timeSpent: ticket.timeSpent,
      ticketType: ticket.ticketType,
      project: ticket.project.key,
      components: ticket.components.slice(0, 3), // Limit to avoid token overflow
    }));

    // Build prompt for conversational model
    const prompt = `USER_REQUEST: ${userMessage}\nTICKETS: ${JSON.stringify(simplifiedTickets)}`;
    
    console.log('Calling conversational model with prompt length:', prompt.length);

    // Call Ollama conversational model
    const ollamaResponse = await fetch(`${process.env.OLLAMA_API_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'jira-conversational',
        prompt: prompt,
        stream: false
      })
    });

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama API error: ${ollamaResponse.status}`);
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
        ticketSummary: `${tickets.length} tickets found`
      };
    }

    return {
      success: true,
      message: parsedResponse.message,
      metadata: {
        ticketCount: tickets.length,
        ticketSummary: parsedResponse.ticketSummary,
        timeRange: tickets.length > 0 ? {
          earliest: tickets[tickets.length - 1].resolved,
          latest: tickets[0].resolved
        } : null
      }
    };

  } catch (error) {
    console.error('Error generating ticket story response:', error);
    throw error;
  }
}

/**
 * Generates response when no tickets are found
 * @param {string} userMessage - Original user message
 * @param {Object} intent - Parsed user intent
 * @returns {Promise<Object>} - No tickets response
 */
async function generateNoTicketsResponse(userMessage, intent) {
  const suggestions = [
    "Try asking about a longer time period (like 'last 3 months')",
    "Check if you have completed any tickets recently in JIRA",
    "Make sure your JIRA email matches your registration"
  ];

  const message = `🔍 I searched for your recent coding adventures but couldn't find any completed quests in the specified timeframe! This might mean:\n\n• ${suggestions.join('\n• ')}\n\nTry asking about different time periods or check your JIRA activity. I'm here when you're ready to hear tales of your development heroics! ⚔️`;

  return {
    success: true,
    message,
    metadata: {
      ticketCount: 0,
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
    const ollamaResponse = await fetch(`${process.env.OLLAMA_API_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'jira-conversational',
        prompt: prompt,
        stream: false
      })
    });

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama API error: ${ollamaResponse.status}`);
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
    const response = await fetch(`${process.env.OLLAMA_API_URL}/api/tags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
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
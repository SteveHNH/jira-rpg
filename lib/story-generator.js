// lib/story-generator.js - Ollama API Integration for JIRA Story Generation

/**
 * Generates a fantasy story from JIRA ticket data using the custom Ollama model
 * @param {Object} ticketData - Extracted JIRA ticket information
 * @returns {Promise<string>} - Generated fantasy story
 */
export async function generateFantasyStory(ticketData) {
  const { 
    assignee, 
    title, 
    description, 
    comments, 
    reporter, 
    status,
    ticketKey,
    ticketType = 'Task',
    priority = 'Medium',
    storyPoints = null,
    project = null,
    components = [],
    labels = []
  } = ticketData;
  
  // Build the structured prompt for the jira-storyteller model
  const prompt = `ASSIGNEE: ${assignee}
TITLE: ${title}
DESCRIPTION: ${description}
STATUS: ${status}
REPORTER: ${reporter}
COMMENTS: ${comments}
TICKET_TYPE: ${ticketType}
PRIORITY: ${priority}${storyPoints ? `\nSTORY_POINTS: ${storyPoints}` : ''}`;

  console.log('Generating story with prompt:', prompt);

  try {
    const response = await fetch(`${process.env.OLLAMA_API_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.OLLAMA_API_KEY
      },
      body: JSON.stringify({
        model: 'jira-storyteller:latest',
        prompt: prompt,
        stream: false, // Get complete response at once
        options: {
          temperature: 0.8,
          top_p: 0.9,
          top_k: 40,
          num_predict: 100 // Limit to ~100 tokens for short stories
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Extract the story from Ollama's response format
    let story = data.response;
    
    if (!story || story.trim().length === 0) {
      throw new Error('Empty response from Ollama API');
    }
    
    // Remove any leading text before the emoji
    const emojiMatch = story.match(/([\u{1F300}-\u{1F9FF}].*)/u);
    if (emojiMatch) {
      story = emojiMatch[1];
    }
    
    // Clean up the story
    story = cleanupStory(story, assignee, ticketKey);
    
    console.log('Generated story:', story);
    return story;
    
  } catch (error) {
    console.error('Story generation failed:', error);
    
    // Return fallback story if AI fails
    return generateFallbackStory(assignee, title, status, ticketKey);
  }
}

/**
 * Cleans up and validates the generated story
 * @param {string} story - Raw story from AI
 * @param {string} assignee - Developer name
 * @param {string} ticketKey - JIRA ticket key
 * @returns {string} - Cleaned story
 */
function cleanupStory(story, assignee, ticketKey) {
  // Remove any extra whitespace or newlines
  story = story.trim();
  
  // Ensure story starts with an emoji if it doesn't already
  const emojiRegex = /^[\u{1F300}-\u{1F9FF}]/u;
  if (!emojiRegex.test(story)) {
    story = `⚔️ ${story}`;
  }
  
  // Ensure story ends with excitement
  if (!story.endsWith('!') && !story.endsWith('⚔️') && !story.endsWith('✨')) {
    story = `${story}!`;
  }
  
  // Ensure assignee name is included (fallback safety)
  if (!story.includes(assignee)) {
    console.warn(`Story doesn't include assignee ${assignee}, might need prompt adjustment`);
  }
  
  // Add ticket reference if story is very short
  if (story.length < 50) {
    story = `${story} [${ticketKey}]`;
  }
  
  return story;
}

/**
 * Generates a fallback story when AI fails
 * @param {string} assignee - Developer name
 * @param {string} title - Ticket title
 * @param {string} status - Ticket status
 * @param {string} ticketKey - JIRA ticket key
 * @returns {string} - Fallback story
 */
function generateFallbackStory(assignee, title, status, ticketKey) {
  const fallbackStories = [
    `⚔️ The brave developer ${assignee} embarks on a quest to conquer "${title}" and emerge victorious! [${ticketKey}]`,
    `🗡️ ${assignee} takes up their keyboard-sword to battle the challenges of "${title}" with determination and skill! [${ticketKey}]`,
    `✨ The legendary coder ${assignee} ventures forth to master the mystical arts of "${title}" and claim victory! [${ticketKey}]`,
    `🛡️ Armed with caffeine and courage, ${assignee} faces the epic challenge of "${title}" with unwavering resolve! [${ticketKey}]`,
    `🌟 The mighty ${assignee} channels their coding powers to overcome the trials of "${title}" and achieve greatness! [${ticketKey}]`
  ];
  
  // Select fallback based on assignee name hash for consistency
  const index = assignee.length % fallbackStories.length;
  return fallbackStories[index];
}

/**
 * Validates that the story meets quality requirements
 * @param {string} story - Generated story
 * @returns {boolean} - Whether story meets requirements
 */
function validateStory(story) {
  // Check minimum length
  if (story.length < 20) return false;
  
  // Check maximum length (keep stories concise)
  if (story.length > 300) return false;
  
  // Check for emoji start
  const emojiRegex = /^[\u{1F300}-\u{1F9FF}]/u;
  if (!emojiRegex.test(story)) return false;
  
  // Check for excitement ending
  if (!story.endsWith('!') && !story.endsWith('⚔️') && !story.endsWith('✨')) return false;
  
  return true;
}

/**
 * Extracts guild information (project + components) from JIRA webhook data
 * @param {Object} jiraIssue - JIRA issue object from webhook
 * @returns {Object} - Guild and component information
 */
export function extractGuildInfo(jiraIssue) {
  const project = jiraIssue?.fields?.project?.key || jiraIssue?.fields?.project?.name || 'Unknown';
  const components = jiraIssue?.fields?.components?.map(comp => comp.name) || [];
  const labels = jiraIssue?.fields?.labels || [];
  
  // Create a guild identifier combining project and primary component
  const primaryComponent = components.length > 0 ? components[0] : 'General';
  const guildId = `${project}-${primaryComponent}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  
  // Create a human-readable guild name
  let guildName;
  if (components.length > 0) {
    guildName = `${project} ${primaryComponent} Guild`;
  } else {
    guildName = `${project} Guild`;
  }
  
  return {
    project,
    components,
    labels,
    guildId,
    guildName,
    primaryComponent
  };
}

/**
 * Determines which Slack channel should receive the story based on guild info
 * @param {Object} guildInfo - Guild information from extractGuildInfo
 * @param {Object} teamMappings - Team/channel mappings from database
 * @returns {string|null} - Slack channel ID or null if no mapping found
 */
export function determineTargetChannel(guildInfo, teamMappings) {
  const { project, primaryComponent, guildId } = guildInfo;
  
  // Try exact guild match first
  if (teamMappings[guildId]) {
    return teamMappings[guildId].slackChannelId;
  }
  
  // Try project-level match
  const projectKey = project.toLowerCase();
  if (teamMappings[projectKey]) {
    return teamMappings[projectKey].slackChannelId;
  }
  
  // Try component-level match across any project
  const componentKey = primaryComponent.toLowerCase();
  for (const [mappingKey, mapping] of Object.entries(teamMappings)) {
    if (mapping.components && mapping.components.includes(primaryComponent)) {
      return mapping.slackChannelId;
    }
  }
  
  // No specific mapping found
  return null;
}

/**
 * Routes story to appropriate guild channels based on JIRA components/labels
 * @param {Object} webhookPayload - JIRA webhook payload
 * @returns {Promise<Object>} - Story routing results
 */
export async function routeStoryToGuilds(webhookPayload) {
  try {
    // Import guild service functions
    const { findGuildsForTicket } = await import('./guild-service.js');
    const { sendTeamStoryNotification } = await import('./slack-service.js');
    
    // Extract ticket components and labels
    const issue = webhookPayload.issue;
    const components = issue?.fields?.components?.map(comp => comp.name) || [];
    const labels = issue?.fields?.labels || [];
    
    // Find matching guilds
    const matchingGuilds = await findGuildsForTicket(components, labels);
    
    if (matchingGuilds.length === 0) {
      return {
        success: true,
        routedChannels: 0,
        message: 'No guilds found matching ticket components/labels'
      };
    }
    
    // Transform webhook data to story format
    const ticketData = transformWebhookToTicketData(webhookPayload);
    
    // Generate story
    const story = await generateFantasyStory(ticketData);
    
    // Route to unique channels only (prevent duplicates)
    const uniqueChannels = new Map();
    matchingGuilds.forEach(guild => {
      if (!uniqueChannels.has(guild.slackChannelId)) {
        uniqueChannels.set(guild.slackChannelId, {
          guild,
          story: enhanceStoryWithGuildContext(story, guild)
        });
      }
    });
    
    // Send stories to channels
    const results = [];
    for (const [channelId, { guild, story: guildStory }] of uniqueChannels) {
      try {
        const result = await sendTeamStoryNotification(
          channelId,
          { narrative: guildStory, guildInfo: guild },
          {
            issueKey: issue.key,
            issueUrl: `${webhookPayload.self?.split('/rest/')[0]}/browse/${issue.key}`,
            summary: issue.fields.summary
          },
          {
            displayName: issue.fields.assignee?.displayName || 'Unknown Hero',
            emailAddress: issue.fields.assignee?.emailAddress
          }
        );
        
        results.push({
          guild: guild.name,
          channelId,
          success: result.success,
          error: result.error || null
        });
        
      } catch (error) {
        console.error(`Failed to send story to ${guild.name}:`, error);
        results.push({
          guild: guild.name,
          channelId,
          success: false,
          error: error.message
        });
      }
    }
    
    return {
      success: true,
      routedChannels: uniqueChannels.size,
      matchingGuilds: matchingGuilds.length,
      results
    };
    
  } catch (error) {
    console.error('Story routing failed:', error);
    return {
      success: false,
      error: error.message,
      routedChannels: 0
    };
  }
}

/**
 * Transforms JIRA webhook payload to story generator format
 * @param {Object} webhookPayload - JIRA webhook payload
 * @returns {Object} - Ticket data for story generation
 */
export function transformWebhookToTicketData(webhookPayload) {
  const issue = webhookPayload.issue;
  const fields = issue.fields;
  
  // Extract description text from various formats
  function extractDescription(description) {
    if (!description) return 'No description provided';
    
    if (typeof description === 'string') return description;
    
    if (description.content) {
      // Atlassian Document Format
      return description.content
        .map(block => {
          if (block.type === 'paragraph' && block.content) {
            return block.content
              .filter(item => item.type === 'text')
              .map(item => item.text)
              .join('');
          }
          return '';
        })
        .filter(text => text.length > 0)
        .join(' ');
    }
    
    return 'Complex description format';
  }
  
  return {
    assignee: fields.assignee?.displayName || 'Unknown Hero',
    title: fields.summary || 'Mysterious Quest',
    description: extractDescription(fields.description),
    status: fields.status?.name || 'Unknown',
    reporter: fields.reporter?.displayName || 'Unknown Reporter',
    comments: 'Epic quest awaits', // Could be enhanced to extract actual comments
    ticketKey: issue.key,
    ticketType: fields.issuetype?.name || 'Task',
    priority: fields.priority?.name || 'Medium',
    storyPoints: fields.storyPoints || null,
    project: fields.project?.key || 'PROJ',
    components: fields.components?.map(c => c.name) || [],
    labels: fields.labels || []
  };
}

/**
 * Enhances story with guild-specific context
 * @param {string} story - Base generated story
 * @param {Object} guild - Guild information
 * @returns {string} - Enhanced story with guild context
 */
function enhanceStoryWithGuildContext(story, guild) {
  // Add guild context to the story
  const guildIntro = `🏰 *${guild.name}*\n\n`;
  return guildIntro + story;
}

/**
 * Enhanced story generation that includes guild context
 * @param {Object} ticketData - Full ticket data including guild info
 * @returns {Promise<Object>} - Story and guild information
 */
export async function generateGuildStory(ticketData) {
  const story = await generateFantasyStory(ticketData);
  const { project, components, guildId, guildName } = ticketData;
  
  return {
    story,
    guildInfo: {
      project,
      components,
      guildId,
      guildName,
      ticketKey: ticketData.ticketKey
    }
  };
}

/**
 * Test function for story generation with sample data
 * @param {Object} testTicketData - Sample ticket data
 */
export async function testStoryGeneration(testTicketData = null) {
  const sampleTicket = testTicketData || {
    assignee: 'Sarah Johnson',
    title: 'Fix login button CSS bug on mobile',
    description: 'Users are unable to click the login button on mobile devices. The button appears to be unresponsive.',
    status: 'In Progress',
    reporter: 'John Manager',
    comments: 'Mike Developer: I think this might be a CSS z-index issue | Sarah Johnson: Starting investigation now',
    ticketKey: 'PROJ-123',
    ticketType: 'Bug',
    priority: 'High',
    project: 'FRONTEND',
    components: ['UI', 'Mobile'],
    labels: ['bug', 'mobile', 'urgent']
  };
  
  console.log('Testing story generation with sample data...');
  const story = await generateFantasyStory(sampleTicket);
  console.log('Test result:', story);
  return story;
}

/**
 * Health check function to verify Ollama API connectivity
 */
export async function checkOllamaHealth() {
  try {
    const response = await fetch(`${process.env.OLLAMA_API_URL}/api/tags`, {
      method: 'GET',
      headers: {
        'X-API-Key': process.env.OLLAMA_API_KEY
      }
    });
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    
    const data = await response.json();
    const hasJiraModel = data.models?.some(model => 
      model.name === 'jira-storyteller:latest' || model.name.includes('jira-storyteller')
    );
    
    return {
      healthy: true,
      hasJiraModel,
      availableModels: data.models?.map(m => m.name) || []
    };
    
  } catch (error) {
    console.error('Ollama health check failed:', error);
    return {
      healthy: false,
      error: error.message
    };
  }
}

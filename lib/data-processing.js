// Webhook transformation utilities for JIRA RPG system

// Helper function to extract description text from JIRA's complex description format
function extractDescription(description) {
  if (!description) return null;
  if (typeof description === 'string') return description;
  if (description.content && Array.isArray(description.content)) {
    return description.content
      .map(block => {
        if (block.content && Array.isArray(block.content)) {
          return block.content.map(item => item.text || '').join(' ');
        }
        return '';
      })
      .join(' ')
      .trim();
  }
  return null;
}

// Transform webhook payload to story generator format
export function transformWebhookToTicketData(payload) {
  const issue = payload.issue;
  const fields = issue?.fields || {};
  
  return {
    assignee: fields.assignee?.displayName || 'Unknown Hero',
    title: fields.summary || 'Mysterious Quest',
    description: extractDescription(fields.description) || 'A quest awaits...',
    status: fields.status?.name || 'Unknown',
    reporter: payload.user?.displayName || 'Quest Giver',
    comments: `Event: ${payload.webhookEvent}`, 
    ticketKey: issue?.key || 'UNKNOWN',
    ticketType: fields.issuetype?.name || 'Task',
    priority: fields.priority?.name || 'Medium',
    storyPoints: fields.customfield_10016 || null,
    project: fields.project?.key || 'UNKNOWN',
    components: fields.components?.map(c => c.name) || [],
    labels: fields.labels || []
  };
}

// Extract issue details from JIRA payload
export function extractIssueDetails(payload) {
  const { issue } = payload;
  
  if (!issue) {
    return {};
  }

  const fields = issue.fields || {};
  
  return {
    eventType: payload.webhookEvent,
    issueKey: issue.key,
    project: fields.project?.key || fields.project?.name,
    component: fields.components && fields.components.length > 0 
      ? fields.components.map(c => c.name).join(', ') 
      : null,
    storyPoints: fields.customfield_10016 || fields.story_points || null,
    assignee: fields.assignee ? {
      name: fields.assignee.name,
      displayName: fields.assignee.displayName,
      emailAddress: fields.assignee.emailAddress
    } : null,
    description: fields.summary || fields.description || null,
    status: fields.status?.name,
    issueType: fields.issuetype?.name,
    priority: fields.priority?.name
  };
}
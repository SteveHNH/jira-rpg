// lib/jira-client.js - JIRA REST API client for fetching ticket data

import axios from 'axios';
import https from 'https';

/**
 * JIRA API client for fetching user tickets and generating epic stories
 */
export class JiraClient {
  constructor() {
    this.baseUrl = process.env.JIRA_API_URL;
    this.token = process.env.JIRA_API_TOKEN;
    this.email = process.env.JIRA_API_EMAIL;
    
    if (!this.baseUrl || !this.token || !this.email) {
      console.error('Missing JIRA configuration:', {
        hasUrl: !!this.baseUrl,
        hasToken: !!this.token,
        hasEmail: !!this.email
      });
    }

    // Create axios instance with HTTP/1.1 and proper Basic authentication
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'JIRA-RPG-Bot/1.0'
      },
      httpsAgent: new https.Agent({
        // Force HTTP/1.1 to avoid Atlassian HTTP/2 issues
        keepAlive: true,
        maxSockets: 5
      }),
      // Use proper Basic auth: email as username, API token as password
      auth: {
        username: this.email,
        password: this.token
      }
    });
  }

  /**
   * Fetches tickets for the current authenticated user with filters
   * @param {string} userEmail - JIRA user email (ignored - uses currentUser())
   * @param {Object} filters - Query filters
   * @param {number} filters.limit - Max tickets to return (default: 10)
   * @param {string} filters.status - Status filter ('closed', 'done', etc.)
   * @param {string} filters.dateRange - Date range ('1w', '1m', '3m')
   * @param {Array} filters.projects - Project keys to search
   * @returns {Promise<Array>} - Array of ticket objects
   */
  async fetchUserTickets(userEmail, filters = {}) {
    try {
      const {
        limit = 10,
        status = 'Done',
        dateRange = '6m',
        projects = []
      } = filters;

      // Use currentUser() for reliable user matching instead of email
      let jql = 'assignee = currentUser()';
      
      // Focus only on Done tickets for storytelling
      jql += ' AND status = "Done"';

      // Remove date filtering for now - focus on getting Done tickets
      // if (dateRange) {
      //   // For Done tickets, use resolved date with broader range
      //   jql += ` AND resolved >= -${dateRange}`;
      // }

      if (projects.length > 0) {
        const projectList = projects.map(p => `"${p}"`).join(',');
        jql += ` AND project in (${projectList})`;
      }

      jql += ' ORDER BY resolved DESC';

      console.log('Executing JQL query:', jql);

      const response = await this.executeJqlQuery(jql, limit);
      return this.transformTickets(response.issues || []);

    } catch (error) {
      console.error('Error fetching user tickets:', error);
      throw new Error(`Failed to fetch JIRA tickets: ${error.message}`);
    }
  }

  /**
   * Searches tickets using custom JQL query
   * @param {string} jql - JQL query string
   * @param {number} maxResults - Maximum results to return
   * @returns {Promise<Object>} - JIRA search response
   */
  async executeJqlQuery(jql, maxResults = 50) {
    try {
      const params = {
        jql,
        maxResults: Math.min(maxResults, 50), // JIRA API limit
        fields: 'summary,description,status,assignee,reporter,created,resolutiondate,issuetype,priority,project,components,labels,comment,timeoriginalestimate,timespent'
      };

      console.log('Executing JIRA search with JQL:', jql);
      console.log('Request params:', { maxResults: params.maxResults, fieldsCount: params.fields.split(',').length });

      const response = await this.httpClient.get('/rest/api/2/search', { params });

      console.log(`JIRA API returned ${response.data.issues?.length || 0} tickets (total: ${response.data.total || 0})`);
      
      return response.data;

    } catch (error) {
      console.error('Error executing JQL query:', error.message);
      if (error.response) {
        console.error('JIRA API error response:', error.response.status, error.response.data);
        throw new Error(`JIRA API error: ${error.response.status} ${error.response.statusText || 'Unknown error'}`);
      } else if (error.request) {
        console.error('No response received from JIRA API');
        throw new Error('No response from JIRA API - connection timeout');
      } else {
        console.error('Request setup error:', error.message);
        throw new Error(`JIRA request failed: ${error.message}`);
      }
    }
  }

  /**
   * Transforms JIRA API response into our ticket format
   * @param {Array} issues - JIRA issues array
   * @returns {Array} - Transformed ticket objects
   */
  transformTickets(issues) {
    return issues.map(issue => {
      const fields = issue.fields;
      
      return {
        ticketKey: issue.key,
        title: fields.summary || 'Untitled Ticket',
        description: this.extractDescription(fields.description) || 'No description provided',
        status: fields.status?.name || 'Unknown',
        assignee: fields.assignee?.displayName || 'Unassigned',
        reporter: fields.reporter?.displayName || 'Unknown',
        priority: fields.priority?.name || 'Medium',
        ticketType: fields.issuetype?.name || 'Task',
        project: {
          key: fields.project?.key || 'UNKNOWN',
          name: fields.project?.name || 'Unknown Project'
        },
        components: fields.components?.map(c => c.name) || [],
        labels: fields.labels || [],
        created: fields.created,
        resolved: fields.resolutiondate,
        timeSpent: fields.timespent ? Math.round(fields.timespent / 3600) : null, // Convert to hours
        estimatedTime: fields.timeoriginalestimate ? Math.round(fields.timeoriginalestimate / 3600) : null,
        comments: this.extractComments(fields.comment),
        url: `${this.baseUrl}/browse/${issue.key}`
      };
    });
  }

  /**
   * Extracts plain text from JIRA description (handles ADF format)
   * @param {Object|string} description - JIRA description object or string
   * @returns {string} - Plain text description
   */
  extractDescription(description) {
    if (!description) return '';
    
    if (typeof description === 'string') {
      return description.substring(0, 500); // Limit length
    }

    // Handle Atlassian Document Format (ADF)
    if (description.type === 'doc' && description.content) {
      return this.extractTextFromADF(description).substring(0, 500);
    }

    return 'Complex description format';
  }

  /**
   * Recursively extracts text from ADF content
   * @param {Object} adfNode - ADF node object
   * @returns {string} - Extracted text
   */
  extractTextFromADF(adfNode) {
    if (!adfNode) return '';
    
    if (adfNode.type === 'text' && adfNode.text) {
      return adfNode.text;
    }

    if (adfNode.content && Array.isArray(adfNode.content)) {
      return adfNode.content
        .map(child => this.extractTextFromADF(child))
        .join(' ')
        .trim();
    }

    return '';
  }

  /**
   * Extracts recent comments from ticket
   * @param {Object} commentsObj - JIRA comments object
   * @returns {string} - Formatted comments string
   */
  extractComments(commentsObj) {
    if (!commentsObj || !commentsObj.comments) return '';

    const recentComments = commentsObj.comments
      .slice(-3) // Get last 3 comments
      .map(comment => {
        const author = comment.author?.displayName || 'Unknown';
        const body = this.extractTextFromADF(comment.body) || comment.body || '';
        return `${author}: ${body.substring(0, 200)}`;
      });

    return recentComments.join(' | ');
  }

  /**
   * Parses natural language date ranges into JIRA format
   * @param {string} input - User input like "last week", "this month"
   * @returns {string} - JIRA date range format
   */
  static parseDateRange(input) {
    const lowercaseInput = input.toLowerCase();
    
    if (lowercaseInput.includes('week') || lowercaseInput.includes('7')) {
      return '1w';
    }
    if (lowercaseInput.includes('month') || lowercaseInput.includes('30')) {
      return '1m';
    }
    if (lowercaseInput.includes('quarter') || lowercaseInput.includes('90')) {
      return '3m';
    }
    if (lowercaseInput.includes('year') || lowercaseInput.includes('365')) {
      return '1y';
    }
    
    // Default to 1 month for most requests
    return '1m';
  }

  /**
   * Parses natural language status filters
   * @param {string} input - User input
   * @returns {string} - JIRA status filter
   */
  static parseStatusFilter(input) {
    const lowercaseInput = input.toLowerCase();
    
    if (lowercaseInput.includes('closed') || lowercaseInput.includes('completed') || lowercaseInput.includes('done')) {
      return 'Done,Resolved,Closed';
    }
    if (lowercaseInput.includes('progress') || lowercaseInput.includes('working')) {
      return 'In Progress';
    }
    if (lowercaseInput.includes('open') || lowercaseInput.includes('todo')) {
      return 'To Do';
    }
    
    // Default to completed tickets for storytelling
    return 'Done,Resolved,Closed';
  }

  /**
   * Health check for JIRA API connectivity
   * @returns {Promise<Object>} - Health check result
   */
  async healthCheck() {
    try {
      if (!this.baseUrl || !this.token || !this.email) {
        return {
          healthy: false,
          error: 'Missing JIRA configuration'
        };
      }

      const response = await this.httpClient.get('/rest/api/2/serverInfo');

      return {
        healthy: true,
        serverInfo: {
          version: response.data.version,
          buildNumber: response.data.buildNumber,
          serverTitle: response.data.serverTitle
        }
      };

    } catch (error) {
      console.error('JIRA health check failed:', error.message);
      return {
        healthy: false,
        error: error.response ? 
          `HTTP ${error.response.status}: ${error.response.statusText}` : 
          error.message
      };
    }
  }
}

// Default export
const jiraClient = new JiraClient();
export default jiraClient;
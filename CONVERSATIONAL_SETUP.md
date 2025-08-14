# Conversational JIRA Storytelling Setup Guide

## Overview
This feature enables users to DM the bot with natural language requests about their JIRA work and receive epic storytelling responses about their coding accomplishments.

## Architecture

### Components Created
1. **`/api/slack-events.js`** - Slack Events API handler for DM messages
2. **`/lib/jira-client.js`** - JIRA REST API client for ticket fetching
3. **`/lib/conversation-service.js`** - Orchestrates the conversation flow
4. **`ConversationalModelfile`** - Specialized Ollama model for chat interactions
5. **`/scripts/test-conversational.sh`** - Testing script for the feature

## Setup Instructions

### 1. Environment Configuration
Add these variables to your `.env` file:
```bash
# JIRA API Configuration
JIRA_API_URL=https://yourcompany.atlassian.net
JIRA_API_EMAIL=your-bot-email@company.com
JIRA_API_TOKEN=your_jira_api_token_here
JIRA_PROJECT_KEYS=PROJ1,PROJ2,PROJ3
```

### 2. JIRA API Token Setup
1. Go to your Atlassian account settings
2. Navigate to Security → API tokens
3. Create a new API token
4. Use this token with your email for Basic auth

### 3. Build the Conversational Model
```bash
# Build the specialized conversational model
ollama create jira-conversational -f ConversationalModelfile

# Verify the model was created
ollama list | grep jira-conversational
```

### 4. Slack App Configuration
In your Slack app settings:

1. **Enable Event Subscriptions**
   - Go to Event Subscriptions in your app settings
   - Toggle "Enable Events" to On
   - Set Request URL to: `https://your-app.vercel.app/api/slack-events`

2. **Subscribe to Bot Events**
   - Add the following bot event: `message.im`
   - This allows your bot to receive direct messages

3. **OAuth Scopes**
   - Ensure your bot has these scopes:
     - `chat:write` (to send messages)
     - `im:read` (to read direct messages)
     - `users:read` (to get user info)

4. **Reinstall App**
   - After adding new scopes, reinstall the app to your workspace

### 5. Testing

Run the test script:
```bash
./scripts/test-conversational.sh
```

Or test individual components:
```bash
# Test JIRA health
node -e "import('./lib/jira-client.js').then(m => m.default.healthCheck().then(console.log))"

# Test conversation service
node -e "import('./lib/conversation-service.js').then(m => m.conversationHealthCheck().then(console.log))"
```

## Usage Examples

Users can now DM the bot with natural language requests:

### Ticket Queries
- "Tell me what I did last month"
- "Show me my last 5 completed tickets"  
- "What work did I finish this week?"
- "I need the last 3 JIRA tickets I closed"

### General Conversation
- "Hi there!"
- "What can you tell me?"
- "Help me understand my work"

## Response Format

The bot will respond with:
- **Epic storytelling** about their coding accomplishments
- **Fantasy RPG language** and metaphors
- **Specific ticket details** when available
- **Encouraging and celebratory** tone
- **Helpful suggestions** when no tickets are found

## Troubleshooting

### Common Issues

1. **"User not registered" messages**
   - User needs to run `/rpg-register email@company.com` first

2. **JIRA connection errors**
   - Verify JIRA_API_URL, JIRA_API_TOKEN, and JIRA_API_EMAIL
   - Check API token permissions

3. **Model not responding**
   - Ensure `jira-conversational` model is built: `ollama list`
   - Verify Ollama is running and accessible

4. **No tickets found**
   - Check if user has completed tickets in the specified timeframe
   - Verify user's JIRA email matches their registration

### Debug Logs

Check Vercel Function logs for:
```
Processing conversational request: { userId, userEmail, messageLength }
Parsed intent: { needsTicketData, filters }
Fetched X tickets for storytelling
```

## Data Flow

```
User DM → Slack Events API → slack-events.js
    ↓
conversation-service.js → Parse Intent
    ↓
jira-client.js → Fetch Tickets
    ↓  
Ollama Model → Generate Story
    ↓
Slack API → Send Response
```

## Security Notes

- All JIRA API calls use Basic authentication with email + token
- Slack requests are verified using signing secret
- User data is filtered through existing registration system
- API responses are limited and sanitized for model consumption
# JIRA RPG Project Context

## Project Overview
Gamified JIRA system using fantasy stories, XP progression, and Slack bot interactions for a one-week hackathon MVP.

## Tech Stack
- **Backend**: Vercel Functions (Node.js)
- **Database**: Firebase Firestore
- **AI**: Ollama API for story generation
- **Integration**: Slack Bot + JIRA Webhooks
- **Deployment**: Vercel (auto-deploy from GitHub)

## Project Structure
```
jira-rpg/
├── api/
│   ├── webhook.js              # JIRA webhook receiver
│   ├── slack-commands.js       # Slack slash commands
│   ├── slack-events.js         # Slack Events API for DM conversations
│   └── team-management.js      # Team creation/joining
├── lib/
│   ├── firebase.js            # Firebase connection
│   ├── story-generator.js     # Ollama AI integration
│   ├── user-service.js        # User XP/level operations
│   ├── slack-service.js       # Slack API helpers
│   ├── xp-calculator.js       # XP rules and leveling
│   ├── jira-client.js         # JIRA REST API client
│   └── conversation-service.js # Conversational storytelling orchestration
├── ConversationalModelfile     # Specialized Ollama model for DM conversations
```

## Key Slack Commands
- `/rpg-help` - Show all commands
- `/rpg-status` - Current level/XP
- `/rpg-register <jira-username>` - Link Slack to JIRA
- `/rpg-leaderboard` - Top 10 players
- `/rpg-join <team>` - Join team
- `/rpg-teams` - List teams

## XP System
- Ticket Assigned: +10 XP
- Ticket In Progress: +15 XP
- Ticket Completed: +50 XP + (Story Points × 10)
- Bug Fixed: +25 bonus XP
- Quick Completion (<24h): +20 bonus XP

## Firestore Collections
### Users
```javascript
{
  slackUserId: "U123456",
  jiraUsername: "sarah.dev", 
  xp: 1250,
  level: 8,
  teams: ["frontend-warriors"],
  achievements: ["first-ticket", "bug-slayer"]
}
```

### Teams
```javascript
{
  name: "frontend-warriors",
  slackChannelId: "C123456",
  jiraComponents: ["UI", "Frontend", "React"],
  members: ["sarah@company.com"]
}
```

## Environment Variables Needed
- Firebase config (API_KEY, PROJECT_ID, etc.)
- OLLAMA_API_URL, OLLAMA_MODEL
- SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET
- JIRA_WEBHOOK_SECRET
- JIRA_API_URL, JIRA_API_EMAIL, JIRA_API_TOKEN (for conversational feature)

## Implementation Status

### ✅ Completed Features

#### Test Endpoint with Story Generation (`/api/test`)
- **Purpose**: Development testing endpoint for webhook processing and story generation
- **Location**: `api/test.js`
- **Key Features**:
  - Mock JIRA webhook payloads for testing scenarios
  - Real webhook payload processing with XP calculation
  - AI story generation integration using Ollama API
  - Dual RequestBin logging for debugging

#### RequestBin Integration
- **Purpose**: Debug webhook responses during development (no Vercel access needed)
- **Configuration**: Constant `REQUEST_BIN_URL` in `api/test.js`
- **Dual Logging**:
  1. **Webhook Processing**: Complete response with XP, user stats, issue details
     - Header: `X-Source: jira-rpg-webhook-processing`
  2. **Story Generation**: AI-generated narratives and guild info
     - Header: `X-Source: jira-rpg-story-generation`

#### Ollama Story Generation Pipeline
- **Integration**: `lib/story-generator.js` functions imported into test endpoint
- **Process Flow**:
  1. Transform JIRA webhook payload → story generator format
  2. Parallel execution: `checkOllamaHealth()`, `extractGuildInfo()`, `testStoryGeneration()`
  3. Generate fantasy narrative based on real ticket data
  4. Include guild assignment from JIRA components
- **Data Transformation**:
  ```javascript
  // JIRA webhook → Story generator format
  {
    assignee: fields.assignee?.displayName || 'Unknown Hero',
    title: fields.summary || 'Mysterious Quest',
    description: extractDescription(fields.description),
    status: fields.status?.name,
    ticketKey: issue?.key,
    project: fields.project?.key,
    components: fields.components?.map(c => c.name) || []
  }
  ```

#### Enhanced Response Format
- **Complete workflow testing** in single endpoint
- **Response includes**:
  - Standard webhook processing (XP, user stats)
  - Story generation results (narrative, guild info, health status)
  - Original payload for debugging
  - Transformed ticket data for verification

### 🔧 Development Tools Created
- **JIRA Testing Directory**: `jira-testing/` with API scripts
- **Test Scripts**: `test-webhook.sh` for endpoint testing
- **Documentation**: `test.md` with testing instructions
- **Planning**: `plan.md` with implementation details

#### Guild System (Session: 2025-08-13)
- **Purpose**: Complete guild management system with Slack integration and JIRA component/label mapping
- **Location**: `lib/guild-service.js`, enhanced `api/slack-commands.js`, `lib/slack-service.js`, `lib/story-generator.js`
- **Key Features**:
  - Modal-based guild creation with channel validation
  - JIRA component/label mapping for automatic story routing
  - Multiple guild membership support with leadership management
  - Story routing with duplicate prevention to guild channels
  - Interactive Slack modal forms replacing complex command parsing

#### Guild Slack Commands
```
/rpg-guild-create          # Opens modal form for guild creation
/rpg-guild-list           # List all available guilds
/rpg-guild-join <name>    # Join existing guild
/rpg-guild-leave [name]   # Leave guild
/rpg-guild-info [name]    # View guild details
/rpg-guild-rename <name>  # Rename guild (leader only)
/rpg-guild-kick <@user>   # Remove member (leader only)
/rpg-guild-transfer <@user> # Transfer leadership (leader only)
```

#### Guild Data Structure
```javascript
// Guilds Collection
{
  name: "Frontend Warriors",
  slackChannelId: "C123456",
  slackChannelName: "dev-frontend", 
  leaderId: "user@company.com",
  jiraComponents: ["UI", "React", "Frontend"],
  jiraLabels: ["frontend", "ui-bug"],
  members: [
    {
      email: "user@company.com",
      slackUserId: "U123456",
      displayName: "John Dev",
      role: "leader" | "member",
      joinedAt: Date
    }
  ],
  totalXp: 5000,
  averageLevel: 8.5,
  isActive: true
}
```

#### Channel Routing for Guild Stories (Session: 2025-08-14)
- **Purpose**: Automated story delivery to guild channels based on JIRA ticket metadata
- **Location**: Enhanced `api/webhook.js`, `lib/story-generator.js`
- **Key Features**:
  - Smart guild matching using JIRA components and labels
  - Multi-guild routing with duplicate prevention
  - Robust fallback system ensuring DM delivery
  - Guild-contextualized stories with enhanced formatting
  - Comprehensive error handling and logging

#### Channel Routing Flow
```javascript
// Enhanced webhook processing flow:
1. Webhook Received → Process User & XP
2. Extract Components/Labels → Find Matching Guilds
3. Generate Stories → Route to Guild Channels  
4. Fallback to DM → Ensure User Notification
5. Debug Logging → Track Routing Results
```

#### Story Routing Logic
- **Guild Matching**: `guild.jiraComponents ∩ ticket.components` OR `guild.jiraLabels ∩ ticket.labels`
- **Channel Deduplication**: Same story not sent twice to same channel ID
- **Error Resilience**: Multiple fallback layers prevent webhook failures
- **Guild Context**: Stories enhanced with guild branding and member context

#### Enhanced Webhook Response
```javascript
{
  "guildRouting": {
    "success": true,
    "routedChannels": 2,        // Unique channels messaged
    "matchingGuilds": 3,        // Total guilds matched
    "results": [                // Per-guild results
      {
        "guild": "Frontend Warriors",
        "channelId": "C123456",
        "success": true
      }
    ]
  },
  "dmNotification": {           // User DM fallback
    "success": true,
    "slackUserId": "U123456"
  }
}
```

#### Status Display Improvements
- Fixed `/rpg-status` to show guild names instead of IDs
- Display @username format for recognition
- Proper Slack markdown formatting
- Enhanced quest statistics display

#### Conversational JIRA Storytelling (Session: 2025-08-14)
- **Purpose**: Natural language DM conversations about user's JIRA accomplishments
- **Location**: `api/slack-events.js`, `lib/jira-client.js`, `lib/conversation-service.js`, `ConversationalModelfile`
- **Key Features**:
  - Direct message handling for non-slash command conversations
  - JIRA REST API integration for fetching user's completed tickets
  - Natural language processing for requests like "what did I do last month"
  - Specialized conversational Ollama model for epic storytelling responses
  - Smart ticket filtering and batching (max 10 tickets per request)

#### Conversational Features
- **Natural Language Queries**: "Tell me what I did last week", "Show me my last 5 tickets"
- **JIRA Integration**: Fetches user tickets with date ranges, status filters, and project filtering
- **Epic Storytelling**: Transforms dry ticket data into engaging fantasy narratives
- **Smart Intent Parsing**: Extracts ticket count, date ranges, and status preferences from user messages
- **Fallback Handling**: Graceful responses when no tickets found or errors occur

#### Conversational Data Flow
```javascript
// DM conversation flow:
1. User DM → Slack Events API → slack-events.js
2. Parse Intent → Extract filters (date, count, status)
3. JIRA API → Fetch relevant tickets
4. Ollama Model → Generate epic story response
5. Slack API → Send conversational response
```

#### Conversational Model Features
- **Personality**: Enthusiastic coding companion using RPG/fantasy language
- **Response Format**: JSON with message and ticket summary
- **Adaptive**: Handles both ticket queries and general conversation
- **Celebratory**: Turns coding work into heroic adventures and accomplishments

### 🔧 Development Tools Created
- **JIRA Testing Directory**: `jira-testing/` with API scripts
- **Test Scripts**: `test-webhook.sh`, `test-guild-routing.sh`, `test-conversational.sh` for comprehensive testing
- **Mock Data**: `mock-guild-tickets.json` with 5 routing scenarios
- **Documentation**: `test.md`, `guild-routing-tests.md`, `slack-commands.md`, `CONVERSATIONAL_SETUP.md` for testing and configuration
- **Planning**: `plan.md` with implementation details

### 🎯 Next Steps
- Deploy conversational feature to production with JIRA API configuration
- Build and deploy ConversationalModelfile to Ollama
- Set up Slack Events API endpoint for DM message handling
- Test conversational storytelling with real registered users
- Monitor JIRA API usage and conversation engagement
- Implement guild achievements and competitions
- Add guild statistics and analytics dashboard

- Always create a plan.md when we start a feature request
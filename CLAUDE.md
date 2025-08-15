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
│   ├── story-service.js       # Story persistence and retrieval
│   ├── user-service.js        # User XP/level operations
│   ├── slack-service.js       # Slack API helpers
│   ├── xp-calculator.js       # XP rules and leveling
│   ├── jira-client.js         # JIRA REST API client
│   ├── home-tab-service.js    # Slack App Home tab management
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

### Stories
```javascript
{
  userJiraUsername: "sarah.dev",
  ticketKey: "PROJ-123",
  narrative: "🗡️ Sarah the Developer bravely conquered the Login Bug of Doom...",
  ticketData: {
    title: "Fix login validation",
    project: "PROJ",
    components: ["Frontend", "Auth"],
    timeSpent: "2h 30m"
  },
  xpAward: {
    xp: 75,
    reason: "Ticket completed (+50 XP), Bug fix bonus (+25 XP)"
  },
  guilds: ["Frontend Warriors", "Auth Guild"],
  createdAt: Date,
  timestamp: "2025-08-15T10:30:00.000Z"
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

#### Slack App Home Tab (Session: 2025-08-15)
- **Purpose**: Interactive dashboard interface replacing empty Home tab with personalized RPG experience
- **Location**: `api/slack-events.js`, `lib/home-tab-service.js`, enhanced `api/slack-commands.js`, `api/webhook.js`
- **Key Features**:
  - Dynamic player dashboard with level, XP, and visual progress bars
  - Guild membership display with leadership indicators (👑 for leaders, ⚔️ for members)
  - Interactive quick action buttons for common commands
  - Welcome screen for unregistered users with registration guidance
  - Auto-refresh functionality after XP gains and user registration
  - Block Kit compliant UI structure for Slack compatibility

#### Home Tab Features
- **For Registered Users**:
  - Player stats: Level badge, total XP, visual progress bar to next level
  - Guild info: List of joined guilds with role indicators
  - Quick actions: Interactive buttons for status, leaderboard, guild management
  - Recent activity: Placeholder for future story/activity feed
- **For Unregistered Users**:
  - Welcome screen with friendly onboarding message
  - Registration instructions with interactive button
  - Context and help links for getting started

#### Home Tab Data Flow
```javascript
// App Home workflow:
1. User Opens Home Tab → app_home_opened event → slack-events.js
2. Check User Registration → getUserBySlackId()
3. Build Dynamic View → home-tab-service.js (registered/unregistered)
4. Publish to Slack → views.publish API
5. Handle Button Clicks → block_actions → slack-commands.js
6. Auto-refresh on Changes → webhook.js, registration commands
```

#### Home Tab Integration
- **Event Handling**: Extended slack-events.js to handle `app_home_opened` events
- **Block Kit UI**: Complete implementation using Slack's visual component framework
- **Interactive Elements**: Button handlers for register, status, leaderboard, guild actions
- **Auto-refresh**: Home tab updates automatically when users gain XP or register
- **Error Resilience**: Graceful fallbacks for both registered and unregistered users

#### Required Slack Permissions (Additional)
- **OAuth Scopes**: `app_home_read` (new requirement)
- **Events**: `app_home_opened` (new subscription needed)
- **App Home**: Enable Home Tab in Slack app settings
- **Reinstall**: App must be reinstalled after adding new permissions

#### Epic Story Persistence System (Session: 2025-08-15)
- **Purpose**: Comprehensive story storage and retrieval system for maintaining epic quest narratives
- **Location**: `lib/story-service.js`, enhanced `api/webhook.js`, `lib/home-tab-service.js`, `lib/conversation-service.js`
- **Key Features**:
  - Automatic story saving in all webhook processing paths
  - Firebase 'stories' collection with proper indexing
  - Home tab "Recent Adventures" section with real epic tales
  - Enhanced DM conversations using saved narratives
  - Story analytics and user quest history

#### Story Persistence Features
- **Automatic Saving**: All generated stories saved during webhook processing
- **Multiple Entry Points**: Guild routing, DM fallback, and error scenarios covered
- **Rich Data Structure**: Narrative, ticket data, XP awards, guild associations, timestamps
- **Smart Retrieval**: Recent stories for Home tab, story lookup by ticket key
- **Fallback Strategy**: DM conversations prioritize saved stories, fall back to JIRA API

#### Story Data Flow
```javascript
// Complete story lifecycle:
1. JIRA Webhook → Generate Epic Story → Save to Firebase 'stories'
2. Home Tab → Retrieve Recent Stories → Display Adventures
3. DM Query → Check Saved Stories → Return Epic Narratives
4. Fallback → JIRA API → Generate New Story (if no saved stories)
```

#### Story Service Functions
- **`saveStory(storyData)`**: Persist generated stories with full metadata
- **`getRecentStories(userJiraUsername, limit)`**: Retrieve user's latest adventures
- **`getStoryByTicket(userJiraUsername, ticketKey)`**: Find specific story by ticket
- **`getStoryStats(userJiraUsername)`**: Get story analytics and user statistics

#### Home Tab Recent Adventures
- **Real Epic Tales**: Displays last 3 completed quest stories
- **Rich Display**: Ticket key, XP gained, time stamps, narrative previews
- **Time Formatting**: Human-readable "2h ago", "3d ago" format
- **Progress Bar Fix**: Consistent XP calculation using DRY principle
- **Graceful Fallbacks**: Handles users with no stories yet

#### Enhanced DM Conversations
- **Saved Story Priority**: Uses pre-generated epic narratives when available
- **Faster Responses**: No need to generate new stories for existing tickets
- **Rich Context**: Includes XP totals and quest counts in responses
- **JIRA API Fallback**: Generates new stories when no saved data exists
- **Consistent Experience**: Same stories appear in Home tab and DM conversations

#### Story Persistence Data Structure
```javascript
// Stories Collection Document
{
  userJiraUsername: "user@company.com",    // User identification (consistent with other collections)
  ticketKey: "PROJ-123",                   // JIRA ticket identifier
  narrative: "🗡️ Epic fantasy story...",   // Generated story narrative
  ticketData: {                            // Original ticket metadata
    title: "Bug fix title",
    project: "PROJ",
    components: ["Frontend"],
    timeSpent: "2h 30m"
  },
  xpAward: {                               // XP calculation results
    xp: 75,
    reason: "Detailed XP breakdown"
  },
  guilds: ["Guild1", "Guild2"],           // Associated guild names
  createdAt: Date,                         // Firestore timestamp
  timestamp: "ISO string"                  // Backup timestamp
}
```

#### DM System Improvements
- **Fixed Duplicate Prevention**: Serverless-compatible cache cleanup
- **Reduced Cache Time**: 5 minutes instead of 10 minutes for faster expiration
- **Better Logging**: Cache size tracking and duplicate detection debugging
- **On-Demand Cleanup**: Cache cleanup runs on each request (serverless-friendly)
- **Reliable Processing**: Prevents legitimate messages from being blocked

### 🔧 Development Tools Created
- **JIRA Testing Directory**: `jira-testing/` with API scripts
- **Test Scripts**: `test-webhook.sh`, `test-guild-routing.sh`, `test-conversational.sh`, `test-home-tab.js`, `test-dm-functionality.js` for comprehensive testing
- **Mock Data**: `mock-guild-tickets.json` with 5 routing scenarios
- **Documentation**: `test.md`, `guild-routing-tests.md`, `slack-commands.md`, `CONVERSATIONAL_SETUP.md` for testing and configuration
- **Planning**: `plan.md` with implementation details

### 🎯 Next Steps
- ✅ ~~Implement recent activity feed in Home tab using story/XP history~~ (COMPLETED: Recent Adventures section)
- ✅ ~~Fix DM conversation system~~ (COMPLETED: Enhanced with saved stories and duplicate prevention fix)
- Monitor story persistence system performance and storage usage
- Implement story search and filtering capabilities
- Add story analytics dashboard for users and admins
- Create story export functionality (CSV, JSON)
- Implement guild story competitions and leaderboards
- Add story categorization and tagging system
- Deploy conversational feature to production with JIRA API configuration
- Build and deploy ConversationalModelfile to Ollama
- Implement guild achievements and competitions
- Add guild statistics and analytics dashboard
- Monitor Home tab usage and user engagement metrics

## 🔑 Critical ID Usage Patterns

**IMPORTANT: Consistent identifier usage to prevent Firebase query errors**

### User Identification Fields
```javascript
// Users Collection Document Structure
{
  slackUserId: "U123456",           // Slack user ID (primary key for Slack lookups)
  jiraUsername: "user.email@com",   // JIRA username/email (primary key for JIRA lookups) 
  jiraAccountId: "abc123",          // JIRA account ID (secondary JIRA identifier)
  email: "user@company.com",        // User's email address
  displayName: "User Name"          // Display name for UI
}
```

### Function Parameter Conventions

#### ✅ CORRECT Usage Patterns

**Slack-based Functions (expect Slack user IDs):**
```javascript
getUserBySlackId(slackUserId)           // ✅ Pass: "U123456"
getGuildsByUser(slackUserId)            // ✅ Pass: "U123456" 
publishHomeTab(slackUserId, userData)   // ✅ Pass: "U123456"
refreshHomeTab(slackUserId, userData)   // ✅ Pass: "U123456"
```

**Guild Leadership Comparisons:**
```javascript
guild.leaderId === userData.jiraUsername  // ✅ Both are JIRA usernames/emails
guild.leaderId === user.jiraUsername      // ✅ leaderId stored as jiraUsername
```

**User Creation Functions:**
```javascript
createUser(slackUserId, userName, jiraUsername)    // ✅ Distinct parameters
createUserWithEmail(slackUserId, userName, email)  // ✅ Legacy function
```

#### ❌ COMMON MISTAKES to Avoid

**Parameter Mismatches:**
```javascript
getGuildsByUser(userData.email)           // ❌ Expects slackUserId, not email
getGuildsByUser(userData.jiraUsername)    // ❌ Expects slackUserId, not jiraUsername
guild.leaderId === userData.email         // ❌ leaderId is jiraUsername, not email
guild.leaderId === userData.slackUserId   // ❌ leaderId is jiraUsername, not slackUserId
```

### Document ID Conventions

**Users Collection:**
- Document ID: `jiraUsername` (user's JIRA username/email)
- Lookup field: `slackUserId` for Slack-based queries

**Guilds Collection:**
- Document ID: Auto-generated 
- Leadership field: `leaderId` (stores user's `jiraUsername`)
- Member identification: `email` field in members array (matches `jiraUsername`)

**Stories Collection:**
- Document ID: Auto-generated
- User identification: `userJiraUsername` (matches user's `jiraUsername`)
- Indexing: Optimized for queries by `userJiraUsername` + `createdAt` for recent stories

### Query Pattern Examples

**Find user by Slack ID:**
```javascript
const user = await getUserBySlackId(slackUserId);
// Returns: { id: "jira.username", slackUserId: "U123456", jiraUsername: "jira.username", ... }
```

**Find user's guilds:**
```javascript
const guilds = await getGuildsByUser(slackUserId);  // Pass Slack ID, function handles lookup
```

**Check guild leadership:**
```javascript
const isLeader = guild.leaderId === userData.jiraUsername;  // Compare JIRA identifiers
```

**Get user's recent stories:**
```javascript
const stories = await getRecentStories(userData.jiraUsername, 5);  // Get last 5 stories
// Returns: [{ id: "doc1", ticketKey: "PROJ-123", narrative: "...", xpAward: {...}, ... }]
```

**Find story by ticket:**
```javascript
const story = await getStoryByTicket(userData.jiraUsername, "PROJ-123");
// Returns: { id: "doc1", narrative: "Epic tale...", guilds: ["Guild1"], ... } or null
```

### Testing & Debugging

When debugging ID-related issues:
1. Check parameter types: Slack IDs start with "U", JIRA usernames are emails
2. Verify function signatures match expected parameter types
3. Use detailed logging to trace ID transformations
4. Test with both registered and unregistered users

**Debug Logging Example:**
```javascript
console.log('Function called with:', {
  slackUserId: slackUserId,           // Should be "U123456" format
  userDataType: userData?.jiraUsername ? 'registered' : 'unregistered',
  jiraUsername: userData?.jiraUsername // Should be email format
});
```

- Always create a plan.md when we start a feature request
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
│   └── team-management.js      # Team creation/joining
├── lib/
│   ├── firebase.js            # Firebase connection
│   ├── story-generator.js     # Ollama AI integration
│   ├── user-service.js        # User XP/level operations
│   ├── slack-service.js       # Slack API helpers
│   └── xp-calculator.js       # XP rules and leveling
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

#### Story Routing Enhancement
- Automatic routing to guild channels based on JIRA ticket components/labels
- Duplicate prevention when multiple guilds match same channel
- Enhanced stories with guild context and branding

#### Status Display Improvements
- Fixed `/rpg-status` to show guild names instead of IDs
- Display @username format for recognition
- Proper Slack markdown formatting
- Enhanced quest statistics display

### 🔧 Development Tools Created
- **JIRA Testing Directory**: `jira-testing/` with API scripts
- **Test Scripts**: `test-webhook.sh` for endpoint testing
- **Documentation**: `test.md` with testing instructions, `slack-commands.md` for bot configuration
- **Planning**: `plan.md` with implementation details

### 🎯 Next Steps
- Deploy guild system features to production
- Test story routing with real JIRA webhooks
- Implement achievement system
- Add guild statistics and leaderboards

- Always create a plan.md when we start a feature request
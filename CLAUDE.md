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

## Current Status
- Repository initialized
- Basic structure from PLAN.md
- Need to implement all core functionality
# JIRA Gamification Hackathon MVP - Final Plan
## One Week Sprint (3 Developers) - Vercel + Firebase + Ollama

### MVP Scope
**Goal**: Gamified JIRA system using fantasy stories, XP progression, and Slack bot interactions

**Tech Stack**:
- **Backend**: Vercel Functions (Node.js)
- **Database**: Firebase Firestore
- **AI**: Ollama API for story generation
- **Integration**: Slack Bot + JIRA Webhooks
- **Deployment**: Vercel (auto-deploy from GitHub)

### Team Roles
- **Dev 1 (Backend/Integration)**: JIRA webhooks, XP system, Ollama integration
- **Dev 2 (Slack Bot)**: All Slack commands, team management, bot interactions
- **Dev 3 (Database/AI)**: Firestore schema, story generation, user progression

### Project Structure
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
├── package.json
├── .env.example
├── .gitignore
└── vercel.json (optional)
```

### Daily Breakdown

#### Day 1 (Monday) - Foundation Setup
**All Devs (Morning 2 hours)**:
- Set up GitHub repo with project structure
- Create Firebase project and Firestore database
- Set up Vercel deployment from GitHub
- Create Slack app and get bot tokens

**Dev 1 (Backend/Integration)**:
- Create basic `/api/webhook.js` endpoint
- Set up Firebase connection in `lib/firebase.js`
- Test webhook receiving with curl/Postman
- Basic JIRA payload parsing and logging

**Dev 2 (Slack Bot)**:
- Set up Slack Bot app and permissions
- Create `/api/slack-commands.js` with basic command router
- Implement `/rpg-help` command with command list
- Test basic Slack message posting

**Dev 3 (Database/AI)**:
- Design Firestore collections schema (users, teams)
- Set up Ollama API connection in `lib/story-generator.js`
- Create `lib/user-service.js` with basic CRUD operations
- Test story generation with sample JIRA data

**End of Day 1 Goals**:
- ✅ Webhook receives POST requests (returns 200)
- ✅ Slack bot responds to `/rpg-help`
- ✅ Firestore creates/reads user documents
- ✅ Ollama generates basic fantasy stories

#### Day 2 (Tuesday) - Core Integration
**Dev 1 (Backend/Integration)**:
- Complete JIRA webhook processing with real payload parsing
- Implement XP calculation rules in `lib/xp-calculator.js`
- Connect webhook → user XP update → story generation
- Add webhook validation and error handling

**Dev 2 (Slack Bot)**:
- Implement `/rpg-status` command (show user XP/level)
- Implement `/rpg-leaderboard` command (top users)
- Create user registration flow (link Slack ID to JIRA username)
- Add rich message formatting with emojis

**Dev 3 (Database/AI)**:
- Complete user progression system (levels 1-20)
- Enhance story generation with user context (level, name, achievements)
- Build team data models and operations
- Create helper functions for common queries

**End of Day 2 Goals**:
- ✅ JIRA ticket completion awards XP and generates story
- ✅ Users can check status and see leaderboard in Slack
- ✅ Stories include user names and context
- ✅ Database handles user creation and XP updates

#### Day 3 (Wednesday) - Team Features & Polish
**All Devs**: Integration testing and debugging

**Dev 1 (Backend/Integration)**:
- Add team filtering based on JIRA components/labels
- Implement different XP rules for different ticket types
- Route stories to correct Slack channels based on team
- Add webhook security validation

**Dev 2 (Slack Bot)**:
- Implement `/rpg-join <team>` and `/rpg-leave <team>` commands
- Implement `/rpg-teams` command (list available teams)
- Add `/rpg-config` for admins to set up team mappings
- Error handling and user-friendly error messages

**Dev 3 (Database/AI)**:
- Complete team management system
- Add story variety based on ticket types (bug vs feature vs task)
- Implement achievement tracking (first ticket, level ups, etc.)
- Performance optimization for database queries

**End of Day 3 Goals**:
- ✅ Users can join teams and receive relevant notifications
- ✅ Stories posted to correct Slack channels
- ✅ Different story types for different ticket types
- ✅ Admin can configure team-channel mappings

#### Day 4 (Thursday) - Advanced Features & Demo Prep
**Dev 1 (Backend/Integration)**:
- Add bonus XP rules (quick completion, bug fixes, story points)
- Implement level-up notifications with special fanfare
- Add support for multiple JIRA projects/boards
- Create manual testing endpoints for demo

**Dev 2 (Slack Bot)**:
- Add `/rpg-level-up` celebration messages
- Implement `/rpg-team-stats` for team performance
- Add direct message responses for private queries
- Polish all command responses and help text

**Dev 3 (Database/AI)**:
- Fine-tune story generation prompts for consistency
- Add story templates for different scenarios
- Implement user title progression (Novice → Debugging God)
- Create demo data population scripts

**End of Day 4 Goals**:
- ✅ Level-up celebrations and bonus XP working
- ✅ All Slack commands polished and user-friendly
- ✅ Consistent, entertaining story generation
- ✅ Demo environment ready with test data

#### Day 5 (Friday) - Final Testing & Demo
**All Devs**:
- End-to-end testing with realistic JIRA workflows
- Load testing with multiple simultaneous users
- Demo script preparation and rehearsal
- Final bug fixes and error handling

**Demo Preparation**:
- Pre-populate demo environment with users and teams
- Prepare JIRA tickets for live demo progression
- Test all Slack commands work reliably
- Ensure stories generate consistently and entertainingly

### Slack Commands Design

#### User Commands
- **`/rpg-help`** - Show all available commands and quick start guide
- **`/rpg-status`** - Display your current level, XP, title, and recent achievements
- **`/rpg-register <jira-username>`** - Link your Slack account to JIRA username
- **`/rpg-leaderboard`** - Show top 10 players in current channel/team
- **`/rpg-teams`** - List all available teams you can join
- **`/rpg-join <team-name>`** - Join a team to receive their quest notifications
- **`/rpg-leave <team-name>`** - Leave a team (stop receiving notifications)
- **`/rpg-achievements`** - Show your unlocked achievements and progress

#### Team/Admin Commands
- **`/rpg-team-stats`** - Show team performance, member levels, recent activity
- **`/rpg-config create-team <name> <jira-component> <channel>`** - Create new team
- **`/rpg-config map-component <team> <component>`** - Map JIRA component to team
- **`/rpg-admin award-xp <user> <amount> <reason>`** - Manually award XP (emergencies)

#### Fun/Social Commands
- **`/rpg-story <ticket-key>`** - Regenerate story for a specific JIRA ticket
- **`/rpg-duel <@user>`** - Compare your stats with another user (fun format)
- **`/rpg-quest-log`** - Show your recent ticket completions as quest history

### XP System & Leveling

#### XP Awards
- **Ticket Assigned**: +10 XP
- **Ticket In Progress**: +15 XP
- **Ticket Completed**: +50 XP + (Story Points × 10)
- **Bug Fixed**: +25 bonus XP
- **Quick Completion** (<24h): +20 bonus XP
- **Code Review**: +15 XP
- **Comment/Collaboration**: +5 XP

#### Level Progression (1-20)
- **Levels 1-5**: 160-400 XP gaps (Novice → Elite)
- **Levels 6-10**: +400 XP per level (Master tier)
- **Levels 11-15**: +600 XP per level (Legendary tier)
- **Levels 16-20**: +800 XP per level (Mythic tier)
- **Level 20 Total**: ~10,400 XP (4-6 months active development)

### Firestore Collections

#### Users Collection
```javascript
{
  slackUserId: "U123456",
  jiraUsername: "sarah.dev", 
  displayName: "Sarah Johnson",
  xp: 1250,
  level: 8,
  currentTitle: "Master Craftsperson",
  achievements: ["first-ticket", "bug-slayer", "speed-demon"],
  teams: ["frontend-warriors", "mobile-guild"],
  joinedAt: "2024-01-15T10:00:00Z",
  lastActivity: "2024-01-20T14:30:00Z",
  totalTickets: 45,
  totalBugs: 12
}
```

#### Teams Collection
```javascript
{
  name: "frontend-warriors",
  displayName: "Frontend Warriors",
  slackChannelId: "C123456",
  jiraComponents: ["UI", "Frontend", "React"],
  jiraLabels: ["frontend", "ui-ux"],
  jiraProject: "PROJ",
  members: ["sarah@company.com", "john@company.com"],
  admins: ["tech-lead@company.com"],
  createdAt: "2024-01-15T10:00:00Z",
  totalXP: 5000,
  averageLevel: 6.2
}
```

### Environment Variables
```bash
# Firebase
FIREBASE_API_KEY=AIzaSyC...
FIREBASE_AUTH_DOMAIN=jira-rpg.firebaseapp.com
FIREBASE_PROJECT_ID=jira-rpg-12345
FIREBASE_STORAGE_BUCKET=jira-rpg-12345.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef123456

# Ollama AI
OLLAMA_API_URL=http://your-ollama-server:11434/api/generate
OLLAMA_MODEL=llama3.1
OLLAMA_API_KEY=optional_if_needed

# Slack
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_SIGNING_SECRET=your-slack-signing-secret

# JIRA (for validation)
JIRA_WEBHOOK_SECRET=your-webhook-secret
```

### Demo Flow
1. **Setup Demo**: Show pre-configured teams and users with some XP
2. **Live Ticket**: Move JIRA ticket from "To Do" → "In Progress" → "Done"
3. **Watch Magic**: Fantasy story appears in appropriate Slack channel
4. **Check Progress**: User runs `/rpg-status` to see XP gain and level
5. **Social Features**: Show `/rpg-leaderboard` and team competition
6. **Admin Features**: Demo team creation and component mapping

### Success Metrics
- ✅ End-to-end: JIRA webhook → XP update → story generation → Slack post
- ✅ Multiple users can join teams and compete on leaderboards  
- ✅ All Slack commands work reliably and feel intuitive
- ✅ Stories are consistently entertaining and contextually relevant
- ✅ System handles realistic team workflows and ticket volumes
- ✅ Demo shows clear business value and team engagement potential

### Stretch Goals (If Time Permits)
- **Party System**: Track collaborators on tickets
- **Quest Browser**: Show available tickets as quests to claim
- **Loot System**: Award virtual items for major achievements
- **Detailed Analytics**: Team performance dashboards
- **Custom Story Themes**: Different fantasy themes per team

This plan leverages the serverless architecture for rapid development while building a genuinely engaging gamification system that teams will want to keep using after the hackathon!
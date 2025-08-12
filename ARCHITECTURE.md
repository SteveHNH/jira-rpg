# JIRA RPG Architecture Documentation

## System Overview

The JIRA RPG system is a gamified hackathon project that transforms JIRA ticket management into a fantasy RPG experience. Built on Vercel Functions with Firebase backend, it processes JIRA webhooks to award XP, generate AI-powered stories, and manage team guilds through Slack integration.

## Architecture Diagram

```
JIRA System          Vercel Functions         Firebase            External APIs
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐   ┌─────────────┐
│   Ticket    │────▶│                 │────▶│   Firestore  │   │   Ollama    │
│  Updates    │     │  /api/webhook   │     │   Database   │◀──│     API     │
│ (webhooks)  │     │                 │     │              │   │             │
└─────────────┘     └─────────────────┘     └──────────────┘   └─────────────┘
                             │                        │
┌─────────────┐     ┌─────────────────┐              │         ┌─────────────┐
│    Slack    │◀────│ Slack Commands  │              │         │  Story Gen  │
│    Bot      │     │  (Planned)      │              │         │   Service   │
│             │     │                 │              │         │             │
└─────────────┘     └─────────────────┘              │         └─────────────┘
                             │                        │
                    ┌─────────────────┐              │
                    │  Test Endpoints │              │
                    │  /api/test      │              │
                    │  /api/other-test│              │
                    └─────────────────┘              │
                             │                        │
                    ┌─────────────────┐              │
                    │   Team Mgmt     │              │
                    │   (Planned)     │              │
                    └─────────────────┘              │
```

## Core Components

### 1. JIRA Webhook Handler (`/api/webhook.js`)
**Purpose**: Processes JIRA ticket updates and awards XP to users

**Data Flow**:
```
JIRA Ticket Update → POST /api/webhook → Extract User Info → Update Firebase → Award XP
```

**Key Functions**:
- Validates webhook payload structure
- Creates new users automatically from JIRA user data
- Awards 50 XP for any ticket event (simplified for hackathon)
- Updates user activity timestamps

**Endpoints**:
- `POST /api/webhook` - Receives JIRA webhook events

### 2. Firebase Database Layer (`lib/firebase.js`)
**Purpose**: Persistent storage for user stats, teams, and game data

**Collections**:

#### Users Collection
```javascript
{
  slackUserId: "U123456" | null,
  jiraUsername: "user.name",
  displayName: "Display Name",
  xp: 1250,
  level: 8,
  currentTitle: "Novice Adventurer",
  joinedAt: Timestamp,
  lastActivity: Timestamp
}
```

#### Teams Collection (Planned)
```javascript
{
  name: "frontend-warriors",
  slackChannelId: "C123456",
  jiraComponents: ["UI", "Frontend", "React"],
  members: ["user@company.com"]
}
```

### 3. Story Generation System (`lib/story-generator.js`)
**Purpose**: Converts JIRA tickets into fantasy RPG narratives using AI

**Data Flow**:
```
Ticket Data → Extract Guild Info → Generate Prompt → Ollama API → Fantasy Story → Slack Channel
```

**Key Features**:
- AI-powered story generation using custom Ollama model `jira-storyteller:latest`
- Guild system based on JIRA projects and components
- Fallback stories when AI fails
- Story validation and cleanup
- Channel targeting based on team mappings

**Guild System**:
- `guildId`: Combination of project and primary component (e.g., "frontend-ui")
- `guildName`: Human-readable name (e.g., "Frontend UI Guild")
- Component-based team organization

### 4. Test Infrastructure
#### `/api/test.js` - Webhook Testing
- Mock JIRA payloads for "inProgress" and "done" scenarios
- Custom payload testing
- User creation and XP awarding simulation
- Issue detail extraction

#### `/api/other-test.js` - Story Generation Testing
- Ollama health checks (`?test=health`)
- Story generation testing (`?test=story`)
- Guild extraction testing (`?test=guild`)
- Full test suite (`?test=full`)

## Data Flow Patterns

### 1. JIRA Webhook Processing
```
1. JIRA sends webhook POST to /api/webhook
2. Extract user info (email, name, displayName)
3. Check if user exists in Firebase
4. Create user if new, otherwise get existing data
5. Award XP (currently flat 50 XP)
6. Update user's lastActivity timestamp
7. Return success response to JIRA
```

### 2. Story Generation Flow (Planned Integration)
```
1. JIRA webhook triggers story generation
2. Extract guild info from ticket (project + components)
3. Build structured prompt with ticket details
4. Send to Ollama API (jira-storyteller model)
5. Process and validate AI response
6. Apply fallback story if AI fails
7. Determine target Slack channel from team mappings
8. Post story to appropriate channel
```

### 3. User XP and Leveling (Planned Enhancement)
```
Current: Flat 50 XP per event
Planned:
- Ticket Assigned: +10 XP
- Ticket In Progress: +15 XP
- Ticket Completed: +50 XP + (Story Points × 10)
- Bug Fixed: +25 bonus XP
- Quick Completion (<24h): +20 bonus XP
```

## API Endpoints

### Production Endpoints
| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/webhook` | POST | Process JIRA webhooks | ✅ Implemented |
| `/api/slack-commands` | POST | Handle Slack commands | 🔄 Planned |
| `/api/team-management` | POST | Team creation/joining | 🔄 Planned |

### Development/Testing Endpoints
| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/test` | GET | List test scenarios | ✅ Implemented |
| `/api/test?scenario={name}` | POST | Test webhook scenarios | ✅ Implemented |
| `/api/other-test?test={type}` | GET | Test story generation | ✅ Implemented |

### Planned Slack Commands
| Command | Purpose | Endpoint |
|---------|---------|----------|
| `/rpg-help` | Show all commands | `/api/slack-commands` |
| `/rpg-status` | Current level/XP | `/api/slack-commands` |
| `/rpg-register <jira-user>` | Link Slack to JIRA | `/api/slack-commands` |
| `/rpg-leaderboard` | Top 10 players | `/api/slack-commands` |
| `/rpg-join <team>` | Join team | `/api/team-management` |
| `/rpg-teams` | List teams | `/api/team-management` |

## Environment Configuration

### Required Variables
```bash
# Firebase Configuration
FIREBASE_API_KEY=your_firebase_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id

# Ollama AI Configuration
OLLAMA_API_URL=your_ollama_api_url
OLLAMA_API_KEY=your_ollama_key

# Slack Configuration (Planned)
SLACK_BOT_TOKEN=xoxb-your-slack-token
SLACK_SIGNING_SECRET=your_signing_secret

# JIRA Configuration (Planned)
JIRA_WEBHOOK_SECRET=your_webhook_secret
```

## Security Considerations

### Current Implementation
- Basic payload validation in webhook handler
- Firebase security rules (default)
- Error handling with sanitized responses

### Planned Security Features
- JIRA webhook signature verification
- Slack request signature validation
- Rate limiting on API endpoints
- Input sanitization for all user inputs
- Firebase security rules for user data access

## Deployment Architecture

### Vercel Functions
- Serverless function deployment
- Auto-scaling based on traffic
- Git-based deployment workflow
- Environment variable management

### Firebase Integration
- Firestore for persistent data
- Real-time updates capability
- Offline support for Slack bot

## Testing Strategy

### Development Testing
1. **Webhook Testing**: Use `/api/test` with mock JIRA payloads
2. **Story Generation**: Use `/api/other-test` to validate AI integration
3. **Health Checks**: Verify Ollama connectivity before deployment

### Production Testing
1. **JIRA Integration**: Test with actual JIRA webhook events
2. **Slack Bot**: Test commands in dedicated Slack channel
3. **End-to-End**: Complete workflow from JIRA ticket to Slack story

## Future Enhancements

### Short Term (Hackathon MVP)
- [ ] Complete Slack bot command integration
- [ ] Team management system
- [ ] Enhanced XP calculation rules
- [ ] Leaderboard functionality

### Long Term (Post-Hackathon)
- [ ] Achievement system
- [ ] Quest mechanics
- [ ] Multi-project support
- [ ] Advanced story templates
- [ ] Analytics dashboard
- [ ] Mobile app companion

## Performance Considerations

### Current Limitations
- Synchronous webhook processing
- Single Firebase instance
- No caching layer

### Optimization Opportunities
- Async story generation with queues
- Redis caching for frequent queries
- CDN for static assets
- Database indexing optimization

## Monitoring and Observability

### Current Logging
- Console logging in all endpoints
- Error stack traces in development
- Request/response logging

### Recommended Additions
- Structured logging with timestamps
- Performance metrics collection
- Error tracking service integration
- Health check endpoints
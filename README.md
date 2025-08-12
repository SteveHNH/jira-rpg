# JIRA RPG 🗡️⚔️

A gamified JIRA system that transforms mundane ticket management into an epic fantasy adventure! Built for a one-week hackathon, this project awards XP for JIRA activities, generates AI-powered fantasy stories, and creates team guilds through Slack integration.

## 🌟 Features

- **XP System**: Earn experience points for JIRA ticket activities
- **Fantasy Stories**: AI-generated RPG narratives for each ticket update
- **Guild System**: Team organization based on JIRA projects and components  
- **Slack Integration**: Bot commands and channel notifications (planned)
- **Leaderboards**: Track top performers and team standings (planned)

## 🏗️ Tech Stack

- **Backend**: Vercel Functions (Node.js)
- **Database**: Firebase Firestore
- **AI**: Ollama API with custom `jira-storyteller` model
- **Integration**: JIRA Webhooks + Slack Bot
- **Deployment**: Vercel (auto-deploy from GitHub)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Firebase account and project
- Ollama API access with `jira-storyteller:latest` model
- JIRA admin access for webhook setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd jira-rpg
npm install
```

### 2. Environment Setup

Copy the example environment file and configure your values:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```bash
# Firebase Configuration
FIREBASE_API_KEY=your_firebase_api_key_here
FIREBASE_PROJECT_ID=your_project_id_here

# Ollama AI Configuration  
OLLAMA_API_URL=your_ollama_api_url_here
OLLAMA_API_KEY=your_ollama_api_key_here

# Slack Configuration (for future integration)
SLACK_BOT_TOKEN=xoxb-your-slack-token-here
SLACK_SIGNING_SECRET=your_slack_signing_secret_here
```

### 3. Development Server

```bash
vercel dev
```

The development server will start at `http://localhost:3000`

### 4. Test the Setup

**⚠️ Important: Ensure `vercel dev` is running first!**

```bash
# Quick health check (recommended first test)
npm run test:health

# Full test suite
npm test

# Individual component tests
npm run webhook:progress
npm run story:generate
```

**Manual testing (if npm scripts aren't working):**
```bash
# Test webhook processing
curl http://localhost:3000/api/test

# Test story generation
curl http://localhost:3000/api/other-test?test=health
curl http://localhost:3000/api/other-test?test=story
```

## 📋 Common Workflows

### Development Testing

**Prerequisites**: Start the development server first:
```bash
npm run dev  # or vercel dev
```

#### Automated Testing Scripts

**Quick Testing:**
```bash
# System health check
npm run test:health

# Fast test suite (skips performance tests)
npm test:fast

# Full comprehensive test suite
npm test
```

**Webhook Testing:**
```bash
# List available test scenarios
npm run webhook:list

# Test specific webhook scenarios
npm run webhook:progress    # Test "In Progress" scenario
npm run webhook:done        # Test "Done" scenario

# Test all webhook scenarios
npm run test:webhook
```

**Story Generation Testing:**
```bash
# Check Ollama AI health
npm run story:health

# Generate sample fantasy story
npm run story:generate

# Test guild extraction from JIRA data
npm run story:guild

# Performance benchmark (5 story requests)
npm run story:benchmark

# Full story generation test suite
npm run test:story
```

#### Manual Testing (Advanced)

**1. JIRA Webhook Processing**
```bash
# View available test scenarios
curl http://localhost:3000/api/test

# Test "In Progress" scenario
curl -X POST http://localhost:3000/api/test?scenario=inProgress

# Test "Done" scenario  
curl -X POST http://localhost:3000/api/test?scenario=done

# Test with custom payload
curl -X POST http://localhost:3000/api/test \
  -H "Content-Type: application/json" \
  -d '{"issue": {...}, "user": {...}}'
```

**2. Story Generation**
```bash
# Check Ollama health
curl http://localhost:3000/api/other-test?test=health

# Generate sample story
curl http://localhost:3000/api/other-test?test=story

# Test guild extraction
curl http://localhost:3000/api/other-test?test=guild

# Run full test suite
curl http://localhost:3000/api/other-test?test=full
```

**3. Pretty Print JSON Output**
All automated scripts support `--pretty` flag (requires `jq`):
```bash
# Automated scripts with pretty output
./scripts/test-webhook.sh inProgress --pretty
./scripts/test-story.sh story --pretty

# Manual curl with jq
curl -s http://localhost:3000/api/test | jq
curl -s -X POST http://localhost:3000/api/test?scenario=inProgress | jq
```

### JIRA Integration Setup

#### 1. Create Webhook in JIRA
1. Go to JIRA Settings → System → WebHooks
2. Add new webhook with URL: `https://your-vercel-app.vercel.app/api/webhook`
3. Select events: `Issue Created`, `Issue Updated`, `Issue Deleted`
4. Save webhook

#### 2. Test Real JIRA Integration
1. Create or update a JIRA ticket
2. Check Vercel function logs for webhook processing
3. Verify user creation/XP award in Firebase console

### Firebase Database Management

#### View User Data
```javascript
// In Firebase Console → Firestore
// Collection: users
// Document structure:
{
  slackUserId: "U123456",
  jiraUsername: "user.name", 
  displayName: "Display Name",
  xp: 1250,
  level: 8,
  currentTitle: "Novice Adventurer",
  joinedAt: Timestamp,
  lastActivity: Timestamp
}
```

#### Manual Data Operations
```bash
# Connect to Firebase (requires Firebase CLI)
firebase firestore:delete --recursive users/test-user
firebase firestore:get users
```

### Debugging Common Issues

#### 1. Webhook Not Receiving Data
```bash
# Check Vercel function logs
vercel logs --follow

# Test webhook locally
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"user": {"emailAddress": "test@example.com"}, "issue": {"key": "TEST-1"}}'
```

#### 2. Story Generation Failing
```bash
# Verify Ollama health
curl http://localhost:3000/api/other-test?test=health

# Check if model exists
curl ${OLLAMA_API_URL}/api/tags \
  -H "X-API-Key: ${OLLAMA_API_KEY}"

# Test with minimal payload
curl http://localhost:3000/api/other-test?test=story
```

#### 3. Firebase Connection Issues
```bash
# Verify Firebase config
node -e "console.log(process.env.FIREBASE_PROJECT_ID)"

# Test connection
curl -X POST http://localhost:3000/api/test?scenario=inProgress
```

## 🏗️ Project Structure

```
jira-rpg/
├── api/
│   ├── webhook.js              # JIRA webhook receiver
│   ├── test.js                 # Development webhook testing
│   ├── other-test.js           # Story generation testing  
│   ├── slack-commands.js       # Slack bot commands (planned)
│   └── team-management.js      # Team operations (planned)
├── lib/
│   ├── firebase.js            # Firebase Firestore connection
│   ├── story-generator.js     # Ollama AI integration
│   ├── user-service.js        # User XP/level operations (planned)
│   ├── slack.js               # Slack API helpers (planned)
│   └── openai.js              # OpenAI integration (legacy)
├── scripts/
│   ├── test-all.sh            # Comprehensive test runner
│   ├── test-webhook.sh        # Webhook testing scenarios
│   ├── test-story.sh          # Story generation testing
│   ├── health-check.sh        # System health validation
│   └── README.md              # Testing scripts documentation
├── .env.example               # Environment template
├── CLAUDE.md                  # Project context for AI
├── ARCHITECTURE.md            # Technical documentation
└── package.json               # Dependencies and NPM scripts
```

## 🎮 Game Mechanics

### XP System (Current)
- **Any JIRA Event**: +50 XP (simplified for hackathon)

### XP System (Planned)
- **Ticket Assigned**: +10 XP
- **Ticket In Progress**: +15 XP  
- **Ticket Completed**: +50 XP + (Story Points × 10)
- **Bug Fixed**: +25 bonus XP
- **Quick Completion** (<24h): +20 bonus XP

### Guild System
- **Guild ID**: `project-component` (e.g., "frontend-ui")
- **Guild Name**: Human-readable (e.g., "Frontend UI Guild")
- **Team Channels**: Slack channels mapped to JIRA components

## 🤖 Slack Integration (Planned)

### Available Commands
```
/rpg-help                     # Show all commands
/rpg-status                   # Current level/XP
/rpg-register <jira-username> # Link Slack to JIRA
/rpg-leaderboard             # Top 10 players
/rpg-join <team>             # Join team
/rpg-teams                   # List teams
```

### Story Notifications
- Fantasy stories posted to relevant team channels
- Guild-based targeting using project/component mapping
- Emoji reactions for engagement

## 🚀 Deployment

### Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel

# Set environment variables
vercel env add FIREBASE_API_KEY
vercel env add FIREBASE_PROJECT_ID
# ... add all required env vars

# Deploy with custom domain
vercel --prod
```

### Environment Variables Setup
In Vercel dashboard, add all variables from `.env.example`:
- Firebase configuration
- Ollama API credentials  
- Slack bot tokens (when ready)

## 📊 Monitoring

### Development Monitoring
```bash
# Watch Vercel function logs
vercel logs --follow

# Monitor specific function
vercel logs api/webhook --follow

# Check deployment status
vercel ls
```

### Production Health Checks
```bash
# Test webhook endpoint
curl https://your-app.vercel.app/api/test

# Verify story generation
curl https://your-app.vercel.app/api/other-test?test=health
```

## 🧪 Testing Strategy

**⚠️ Prerequisites**: Always start development server first with `npm run dev`

### Automated Testing Infrastructure

**Quick Testing Commands:**
```bash
# System health check (recommended first)
npm run test:health

# Fast test suite (2-3 minutes)
npm test:fast

# Full comprehensive test suite (5-10 minutes)
npm test
```

**Individual Component Testing:**
```bash
# Webhook functionality
npm run test:webhook         # All webhook scenarios
npm run webhook:progress     # Just "In Progress" scenario
npm run webhook:done         # Just "Done" scenario

# Story generation
npm run test:story          # Full story generation suite
npm run story:health        # Just Ollama health check
npm run story:generate      # Just story generation
npm run story:benchmark     # Performance testing
```

### Testing Scripts Documentation

All testing scripts are located in `./scripts/` directory:

- **`test-all.sh`** - Orchestrates comprehensive testing with colored output
- **`test-webhook.sh`** - JIRA webhook testing with multiple scenarios
- **`test-story.sh`** - AI story generation testing and benchmarking
- **`health-check.sh`** - System health validation (APIs, database, configuration)

**Script Features:**
- ✅ Colored output for easy reading
- 🔧 Automatic server connectivity checks
- 📊 Performance benchmarking
- 🛠️ Detailed error reporting
- 📋 JSON formatting with `--pretty` flag

### Development Workflow Testing

**1. Initial Setup Validation:**
```bash
# After cloning and configuring environment
npm run test:health
```

**2. Feature Development Testing:**
```bash
# Quick validation during development
npm test:fast

# Test specific component you're working on
npm run webhook:progress  # for webhook changes
npm run story:generate    # for story generation changes
```

**3. Pre-deployment Testing:**
```bash
# Full test suite before committing
npm test

# Verify performance hasn't degraded
npm run story:benchmark
```

### Manual Testing (Advanced Users)

**Direct Script Execution:**
```bash
# Run scripts directly with options
./scripts/test-webhook.sh all --pretty
./scripts/test-story.sh full --pretty
./scripts/health-check.sh --verbose

# Test with custom base URL
BASE_URL=https://your-app.vercel.app ./scripts/test-all.sh
```

### Environment Testing

**Local Development:**
```bash
# Default localhost testing
npm test

# Ensure vercel dev is running first
npm run dev  # in one terminal
npm test     # in another terminal
```

**Production Testing:**
```bash
# Test deployed application
BASE_URL=https://your-app.vercel.app npm run test:health
BASE_URL=https://your-app.vercel.app npm run story:health
```

### Continuous Integration Ready

All scripts are designed to work in CI/CD environments:
```yaml
# Example GitHub Actions workflow
- name: Install dependencies
  run: npm install

- name: Start development server
  run: npm run dev &

- name: Wait for server
  run: sleep 10

- name: Run health check
  run: npm run test:health

- name: Run full test suite
  run: npm test
```

## 🤝 Contributing

### Development Workflow
1. Create feature branch from `main`
2. Implement changes with tests
3. Test locally with `vercel dev`
4. Submit PR with deployment preview
5. Merge after review and testing

### Code Style
- ES6+ JavaScript
- Async/await for promises
- Error handling in all API endpoints
- Console logging for debugging

## 📈 Roadmap

### Hackathon MVP (Week 1)
- [x] JIRA webhook processing
- [x] Firebase user management  
- [x] AI story generation
- [ ] Slack bot commands
- [ ] Team management system
- [ ] Basic leaderboards

### Post-Hackathon Features
- [ ] Achievement system
- [ ] Quest mechanics
- [ ] Advanced XP rules
- [ ] Multi-project support
- [ ] Analytics dashboard
- [ ] Mobile companion app

## 🐛 Troubleshooting

### Common Issues

**"Module not found" errors**
```bash
# Ensure Node.js 18+
node --version

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Firebase permission denied**
```bash
# Check Firebase project ID
echo $FIREBASE_PROJECT_ID

# Verify Firestore rules allow writes
# In Firebase Console → Firestore → Rules
```

**Ollama API not responding**
```bash
# Test API connection
curl ${OLLAMA_API_URL}/api/tags

# Verify model exists
curl ${OLLAMA_API_URL}/api/show -d '{"name":"jira-storyteller:latest"}'
```

**JIRA webhook not triggering**
- Check webhook URL is correct and accessible
- Verify webhook events are configured
- Check JIRA admin permissions
- Review Vercel function logs for errors

## 📞 Support

For issues and questions:
1. Check this README and `ARCHITECTURE.md`
2. Review Vercel function logs
3. Test with development endpoints
4. Create GitHub issue with reproduction steps

---

**Built with ⚔️ for the JIRA hackathon** - Transform your tickets into epic adventures!
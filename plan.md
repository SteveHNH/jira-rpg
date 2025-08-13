# Guild System Implementation Plan

## Overview
Implementing a comprehensive guild system for the JIRA RPG that allows users to create guilds tied to Slack channels with JIRA component/label mapping for automated story routing.

## Requirements Summary
- Manual guild creation with channel + vanity name
- JIRA component/label mapping for story routing
- Multiple guild membership allowed
- Channel validation (exists + bot membership)
- Guild commands only work in guild channel or DM
- Leadership management with permissions
- Story routing with duplicate prevention
- Leadership succession to be handled later

## Data Structure

### Guild Collection Schema
```javascript
// Collection: 'guilds' 
// Document ID: auto-generated
{
  id: "guild-123",
  name: "Epic Frontend Warriors",        // Vanity name
  slackChannelId: "C1234567890",        // Slack channel ID  
  slackChannelName: "dev-frontend",     // Channel name for reference
  leaderId: "user@company.com",         // Guild leader (user email)
  createdAt: new Date(),
  createdBy: "user@company.com",
  description: "Frontend development guild",
  
  // JIRA Integration
  jiraComponents: ["UI", "Frontend", "React"],  // Components this guild handles
  jiraLabels: ["frontend", "ui-bug"],          // Labels this guild handles
  project: "PROJ",                             // Optional: specific project
  
  // Member management
  members: [
    {
      email: "user@company.com",
      slackUserId: "U123456", 
      displayName: "John Dev",
      joinedAt: new Date(),
      role: "leader" | "member"
    }
  ],
  
  // Guild stats
  totalXp: 5000,
  averageLevel: 8.5,
  totalTickets: 150,
  activeMembers: 5,
  
  // Settings
  isActive: true,
  maxMembers: 50,
  allowAutoJoin: true
}
```

### User Guild References (Existing)
```javascript
// Users collection - keep existing structure
guilds: ["guild-123", "guild-456"]  // Array of guild IDs
```

## Guild Commands Design

### Core Commands
```
/rpg-guild-create <#channel> "<vanity-name>" <components> [labels]
  Example: /rpg-guild-create #dev-frontend "Frontend Warriors" UI,React frontend,ui-bug

/rpg-guild-join <guild-name>
  Join existing guild by vanity name

/rpg-guild-leave [guild-name] 
  Leave guild (if no name provided, show list to choose from)

/rpg-guild-list
  List all available guilds (replaces /rpg-teams)

/rpg-guild-info [guild-name]
  Show guild details (members, stats, components/labels)
```

### Leadership Commands (Guild Channel or DM Only)
```
/rpg-guild-rename <new-name>     (leader only)
/rpg-guild-kick <@user>          (leader only)  
/rpg-guild-transfer <@user>      (leader only)
/rpg-guild-settings              (leader only) - future feature
```

## Implementation Tasks

### Phase 1: Core Infrastructure
1. **lib/guild-service.js** - Guild CRUD operations
   - createGuild()
   - joinGuild() 
   - leaveGuild()
   - getGuildsByUser()
   - getGuildByName()
   - validateGuildOwnership()

2. **lib/slack-service.js** - Slack integration helpers
   - validateChannel() - check exists + bot membership
   - getChannelInfo()
   - validateCommandContext() - guild channel or DM only

### Phase 2: Command Handlers
3. **api/slack-commands.js** - Update command handlers
   - handleGuildCreateCommand()
   - handleGuildJoinCommand() 
   - handleGuildLeaveCommand()
   - Update handleTeamsCommand() to use guild service
   - Add command context validation

### Phase 3: Story Routing
4. **lib/story-generator.js** - Add guild routing
   - findGuildsForTicket() - match components/labels
   - routeStoryToGuilds() - send to appropriate channels
   - preventDuplicateRouting() - same story to same channel

### Phase 4: Leadership Management
5. **Guild Leadership Features**
   - handleGuildRenameCommand()
   - handleGuildKickCommand()
   - handleGuildTransferCommand()
   - Permission validation for leader-only commands

## Validation Requirements

### Channel Validation
- Channel exists in workspace
- Bot is member of channel
- Bot has permission to post messages
- Channel not already assigned to another guild

### Command Context Validation
- Guild management commands only allowed in:
  - Guild's designated channel
  - Direct message to bot
- Block execution in other channels

### Permission Validation
- Only guild leaders can rename, kick, transfer
- Only guild members can use member commands
- Validate user is registered in RPG system

## Story Routing Logic

### Routing Algorithm
```javascript
function routeStoryToGuilds(webhookPayload) {
  1. Extract components/labels from JIRA ticket
  2. Query guilds where:
     - jiraComponents matches any ticket component OR
     - jiraLabels matches any ticket label
  3. Remove duplicate channels (if multiple guilds share channel)
  4. Generate story for each unique channel
  5. Post to channels with guild context
}
```

### Duplicate Prevention
- Track channel IDs that stories are sent to
- Skip if same story would go to same channel multiple times
- Combine guild context if multiple guilds match same channel

## Future Considerations (Later Phases)

### Leadership Succession
- Auto-promote longest member when leader leaves without replacement
- Grace period for leader to return
- Guild dissolution if inactive too long

### Advanced Features  
- Guild descriptions and settings
- Member role hierarchy beyond leader/member
- Guild achievements and competitions
- Cross-guild challenges

## File Structure
```
lib/
├── guild-service.js        (NEW)
├── slack-service.js        (ENHANCED)
├── user-service.js         (MINOR UPDATES)
├── story-generator.js      (ENHANCED)
└── firebase.js            (NO CHANGES)

api/
├── slack-commands.js       (MAJOR UPDATES)
├── webhook.js             (ENHANCED for routing)
└── test.js                (TEST UPDATES)
```

## Testing Strategy
- Unit tests for guild service operations
- Integration tests for Slack command flows
- Test channel validation edge cases
- Test story routing with multiple guild scenarios
- Test permission validation for leadership commands

## Deployment Notes
- Requires Slack bot permissions for channel info
- Environment variables for Slack API access
- Database indexes for guild component/label queries
- Monitor for rate limits on Slack API calls

---

## Next Steps
1. Start with lib/guild-service.js implementation
2. Add Slack channel validation helpers
3. Update command handlers one by one
4. Test each component before moving to next
5. Integrate story routing last after core features work
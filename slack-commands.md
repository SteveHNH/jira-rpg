# Slack Bot Slash Commands Configuration

This document contains all the slash command configurations needed to set up the JIRA RPG Slack bot.

## How to Configure

1. Go to your Slack app settings at https://api.slack.com/apps
2. Navigate to "Slash Commands" in the left sidebar
3. Click "Create New Command" for each command below
4. Copy the exact configuration for each command

## Required Bot Permissions

Make sure your bot has these OAuth scopes:
- `chat:write` - Send messages
- `channels:read` - Read channel information
- `conversations.info` - Get channel details
- `conversations.members` - Check channel membership
- `users:read` - Read user information
- `views:open` - Open modals (required for guild creation form)

---

## Player Commands

### /rpg-help
**Command:** `/rpg-help`  
**Request URL:** `https://your-domain.vercel.app/api/slack-commands`  
**Short Description:** Show all available RPG commands  
**Usage Hint:** `/rpg-help`  
**Escape channels, users, and links sent to your app:** ☑️ Checked

---

### /rpg-status
**Command:** `/rpg-status`  
**Request URL:** `https://your-domain.vercel.app/api/slack-commands`  
**Short Description:** Check your current level, XP, and achievements  
**Usage Hint:** `/rpg-status`  
**Escape channels, users, and links sent to your app:** ☑️ Checked

---

### /rpg-register
**Command:** `/rpg-register`  
**Request URL:** `https://your-domain.vercel.app/api/slack-commands`  
**Short Description:** Link your Slack account to JIRA  
**Usage Hint:** `/rpg-register your.email@company.com`  
**Escape channels, users, and links sent to your app:** ☑️ Checked

---

### /rpg-achievements
**Command:** `/rpg-achievements`  
**Request URL:** `https://your-domain.vercel.app/api/slack-commands`  
**Short Description:** View your unlocked achievements  
**Usage Hint:** `/rpg-achievements`  
**Escape channels, users, and links sent to your app:** ☑️ Checked

---

### /rpg-leaderboard
**Command:** `/rpg-leaderboard`  
**Request URL:** `https://your-domain.vercel.app/api/slack-commands`  
**Short Description:** Show top players in current channel  
**Usage Hint:** `/rpg-leaderboard`  
**Escape channels, users, and links sent to your app:** ☑️ Checked

---

## Guild Commands

### /rpg-guild-create
**Command:** `/rpg-guild-create`  
**Request URL:** `https://your-domain.vercel.app/api/slack-commands`  
**Short Description:** Create a new guild with JIRA mapping (opens form)  
**Usage Hint:** `/rpg-guild-create`  
**Escape channels, users, and links sent to your app:** ☑️ Checked

---

### /rpg-guild-list
**Command:** `/rpg-guild-list`  
**Request URL:** `https://your-domain.vercel.app/api/slack-commands`  
**Short Description:** List all available guilds  
**Usage Hint:** `/rpg-guild-list`  
**Escape channels, users, and links sent to your app:** ☑️ Checked

---

### /rpg-guild-join
**Command:** `/rpg-guild-join`  
**Request URL:** `https://your-domain.vercel.app/api/slack-commands`  
**Short Description:** Join an existing guild  
**Usage Hint:** `/rpg-guild-join "Frontend Warriors"`  
**Escape channels, users, and links sent to your app:** ☑️ Checked

---

### /rpg-guild-leave
**Command:** `/rpg-guild-leave`  
**Request URL:** `https://your-domain.vercel.app/api/slack-commands`  
**Short Description:** Leave a guild you belong to  
**Usage Hint:** `/rpg-guild-leave "Frontend Warriors"`  
**Escape channels, users, and links sent to your app:** ☑️ Checked

---

### /rpg-guild-info
**Command:** `/rpg-guild-info`  
**Request URL:** `https://your-domain.vercel.app/api/slack-commands`  
**Short Description:** View detailed information about a guild  
**Usage Hint:** `/rpg-guild-info "Frontend Warriors"`  
**Escape channels, users, and links sent to your app:** ☑️ Checked

---

## Guild Leadership Commands

### /rpg-guild-rename
**Command:** `/rpg-guild-rename`  
**Request URL:** `https://your-domain.vercel.app/api/slack-commands`  
**Short Description:** Rename your guild (leaders only)  
**Usage Hint:** `/rpg-guild-rename "New Guild Name"`  
**Escape channels, users, and links sent to your app:** ☑️ Checked

---

### /rpg-guild-kick
**Command:** `/rpg-guild-kick`  
**Request URL:** `https://your-domain.vercel.app/api/slack-commands`  
**Short Description:** Remove a member from your guild (leaders only)  
**Usage Hint:** `/rpg-guild-kick @username`  
**Escape channels, users, and links sent to your app:** ☐ Unchecked (need raw user IDs)

---

### /rpg-guild-transfer
**Command:** `/rpg-guild-transfer`  
**Request URL:** `https://your-domain.vercel.app/api/slack-commands`  
**Short Description:** Transfer guild leadership to another member  
**Usage Hint:** `/rpg-guild-transfer @username`  
**Escape channels, users, and links sent to your app:** ☐ Unchecked (need raw user IDs)

---

## Legacy Commands (Optional - for backward compatibility)

### /rpg-teams
**Command:** `/rpg-teams`  
**Request URL:** `https://your-domain.vercel.app/api/slack-commands`  
**Short Description:** List guilds (deprecated - use /rpg-guild-list)  
**Usage Hint:** `/rpg-teams`  
**Escape channels, users, and links sent to your app:** ☑️ Checked

---

### /rpg-join
**Command:** `/rpg-join`  
**Request URL:** `https://your-domain.vercel.app/api/slack-commands`  
**Short Description:** Join guild (deprecated - use /rpg-guild-join)  
**Usage Hint:** `/rpg-join guild-name`  
**Escape channels, users, and links sent to your app:** ☑️ Checked

---

### /rpg-leave
**Command:** `/rpg-leave`  
**Request URL:** `https://your-domain.vercel.app/api/slack-commands`  
**Short Description:** Leave guild (deprecated - use /rpg-guild-leave)  
**Usage Hint:** `/rpg-leave guild-name`  
**Escape channels, users, and links sent to your app:** ☑️ Checked

---

### /rpg-config
**Command:** `/rpg-config`  
**Request URL:** `https://your-domain.vercel.app/api/slack-commands`  
**Short Description:** Admin configuration (future feature)  
**Usage Hint:** `/rpg-config create-team <name> <component> #channel`  
**Escape channels, users, and links sent to your app:** ☐ Unchecked

---

### /rpg-guild-stats
**Command:** `/rpg-guild-stats`  
**Request URL:** `https://your-domain.vercel.app/api/slack-commands`  
**Short Description:** View guild performance statistics (future feature)  
**Usage Hint:** `/rpg-guild-stats "Guild Name"`  
**Escape channels, users, and links sent to your app:** ☑️ Checked

---

## Important Configuration Notes

### Request URL
Replace `https://your-domain.vercel.app` with your actual Vercel deployment URL.

### Escape Settings
- **Checked (☑️):** For commands that work with escaped mentions like `<@U123456|username>`
- **Unchecked (☐):** For commands that need raw IDs like `/rpg-guild-kick` and `/rpg-guild-transfer`

### Guild Creation Modal
The `/rpg-guild-create` command opens a user-friendly modal form where users can:
- Select a channel from a dropdown
- Enter guild name, components, and labels in separate fields
- Get validation feedback before creation
- Specify components OR labels OR both (at least one required)

## Environment Variables Required

Make sure these are set in your Vercel deployment:

```bash
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
FIREBASE_API_KEY=your-firebase-key
FIREBASE_PROJECT_ID=your-project-id
# ... other Firebase config
OLLAMA_API_URL=your-ollama-url
OLLAMA_MODEL=jira-storyteller:latest
```

## Testing Commands

After configuring, test each command in this order:

1. `/rpg-help` - Verify basic connectivity
2. `/rpg-register your.email@company.com` - Create user account
3. `/rpg-status` - Check user data
4. `/rpg-guild-create` - Create guild (opens form)
5. `/rpg-guild-list` - Verify guild creation
6. `/rpg-guild-join "Test Guild"` - Test joining
7. `/rpg-guild-info "Test Guild"` - Check guild details

## Troubleshooting

- If commands return "Unknown command", check the Request URL
- If you get permission errors, verify bot OAuth scopes
- If channel validation fails, make sure bot is added to channels
- Check Vercel logs for detailed error information
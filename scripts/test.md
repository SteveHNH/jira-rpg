# Webhook Testing Guide

## Overview

The `/api/test` endpoint allows you to test JIRA webhook event handling for hackathon project status changes. This endpoint is essential for development and debugging the XP award system.

## Endpoint URL

- **Production**: `https://your-domain.vercel.app/api/test`
- **Local Development**: `http://localhost:3000/api/test`

## JIRA Webhook Configuration

The endpoint is configured to receive webhooks for:
- **Events**: Issue Updated (status changes to "In Progress" or "Done")
- **Component**: hackathon-test
- **Filters**: Status transitions for project issues

## Testing Methods

### 1. View Available Scenarios (GET)

```bash
curl https://your-domain.vercel.app/api/test
```

**Response:**
```json
{
  "message": "JIRA RPG Webhook Test Endpoint",
  "availableScenarios": ["inProgress", "done"],
  "usage": {
    "testScenario": "POST /api/test?scenario=<scenarioName>",
    "customPayload": "POST /api/test (with custom payload in body)"
  },
  "scenarios": [
    {
      "name": "inProgress",
      "description": "jira:issue_updated",
      "issueKey": "PROJECT-123"
    },
    {
      "name": "done",
      "description": "jira:issue_updated", 
      "issueKey": "PROJECT-124"
    }
  ]
}
```

### 2. Test Predefined Scenarios (POST)

#### Issue moved to In Progress
```bash
curl -X POST "https://your-domain.vercel.app/api/test?scenario=inProgress"
```

#### Issue completed (Done)
```bash
curl -X POST "https://your-domain.vercel.app/api/test?scenario=done"
```

### 3. Test Custom Payloads (POST)

```bash
curl -X POST https://your-domain.vercel.app/api/test \
  -H "Content-Type: application/json" \
  -d '{
    "webhookEvent": "jira:issue_updated",
    "issue": {
      "key": "PROJECT-999",
      "fields": {
        "summary": "Custom hackathon test issue",
        "issuetype": { "name": "Story" },
        "status": { "name": "Done" },
        "priority": { "name": "High" },
        "project": { "key": "PROJECT", "name": "Your Project" },
        "components": [
          { "name": "hackathon-test" }
        ],
        "customfield_10016": 8,
        "assignee": {
          "name": "your.username",
          "emailAddress": "your.email@company.com",
          "displayName": "Your Name"
        }
      }
    },
    "user": {
      "name": "your.username",
      "emailAddress": "your.email@company.com",
      "displayName": "Your Name"
    },
    "changelog": {
      "items": [
        {
          "field": "status",
          "fromString": "In Progress",
          "toString": "Done"
        }
      ]
    }
  }'
```

## Response Format

### Successful Response
```json
{
  "success": true,
  "message": "Test webhook processed successfully",
  "processingDetails": {
    "userAffected": "hackathon.user@company.com",
    "eventType": "jira:issue_updated",
    "issueKey": "PROJECT-124",
    "xpAwarded": 50,
    "userStats": {
      "totalXp": 150,
      "level": 1,
      "title": "Novice Adventurer"
    }
  },
  "issueDetails": {
    "eventType": "jira:issue_updated",
    "issueKey": "PROJECT-124",
    "project": "PROJECT",
    "component": "hackathon-test",
    "storyPoints": 5,
    "assignee": {
      "name": "hackathon.user",
      "displayName": "Hackathon User",
      "emailAddress": "hackathon.user@company.com"
    },
    "description": "Hackathon test issue completed",
    "status": "Done",
    "issueType": "Story",
    "priority": "High"
  },
  "payload": {
    // The complete payload that was processed
  }
}
```

### Error Response
```json
{
  "error": "No payload provided. Use ?scenario=<name> or send payload in body",
  "availableScenarios": ["inProgress", "done"]
}
```

## Available Test Scenarios

| Scenario | Event Type | Description | Issue Key | Status Change |
|----------|------------|-------------|-----------|---------------|
| `inProgress` | `jira:issue_updated` | Issue moved to In Progress | PROJECT-123 | To Do → In Progress |
| `done` | `jira:issue_updated` | Issue completed | PROJECT-124 | In Progress → Done |

## Issue Details Extraction

The endpoint now extracts comprehensive JIRA issue information from webhook payloads:

| Field | Source | Description |
|-------|--------|-------------|
| `eventType` | `webhookEvent` | Type of JIRA event (e.g., `jira:issue_updated`) |
| `issueKey` | `issue.key` | JIRA issue identifier (e.g., `PROJ-123`) |
| `project` | `issue.fields.project.key` or `.name` | Project identifier |
| `component` | `issue.fields.components[].name` | Components (comma-separated if multiple) |
| `storyPoints` | `issue.fields.customfield_10016` or `.story_points` | Story points value |
| `assignee` | `issue.fields.assignee` | Assignee details (name, displayName, emailAddress) |
| `description` | `issue.fields.summary` or `.description` | Issue summary/description |
| `status` | `issue.fields.status.name` | Current issue status |
| `issueType` | `issue.fields.issuetype.name` | Issue type (Story, Task, Bug, etc.) |
| `priority` | `issue.fields.priority.name` | Priority level |

## Testing User Creation

The first time you test with a specific user email, a new user will be created in Firestore:

```json
{
  "slackUserId": null,
  "jiraUsername": "test.user",
  "displayName": "Test User",
  "xp": 50,
  "level": 1,
  "currentTitle": "Novice Adventurer",
  "joinedAt": "2024-01-15T10:30:00.000Z",
  "lastActivity": "2024-01-15T10:30:00.000Z"
}
```

Subsequent tests with the same user will increment their XP.

## Browser Testing

You can also test in a browser by visiting:
```
https://your-domain.vercel.app/api/test?scenario=done
```

## Local Development Testing

1. Start local development server:
   ```bash
   vercel dev
   ```

2. Test locally:
   ```bash
   curl -X POST "http://localhost:3000/api/test?scenario=inProgress"
   ```

## Troubleshooting

### Common Issues

1. **500 Error**: Check Firebase configuration and environment variables
2. **400 Error**: Invalid payload structure or missing required fields
3. **405 Error**: Using wrong HTTP method (use GET to view scenarios, POST to test)

### Debug Information

The endpoint logs detailed information to the console:
- Request method and query parameters
- Payload being processed
- User creation/updates
- XP awards

### Verification

After testing, you can verify the results by:
1. Checking the console logs in Vercel Functions
2. Querying Firestore directly to see user records
3. Using the response data to confirm XP awards and user stats
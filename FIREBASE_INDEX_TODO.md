# Firebase Index Requirements

## Stories Collection Composite Index

**URGENT**: Create this composite index in Firebase Console for optimal story queries:

### Index Configuration:
- **Collection**: `stories`
- **Fields**:
  1. `userJiraUsername` (Ascending)
  2. `createdAt` (Descending)
  3. `__name__` (Descending) - Auto-added by Firebase

### Firebase Console URL:
https://console.firebase.google.com/v1/r/project/jira-rpg-hackathon/firestore/indexes?create_composite=ClJwcm9qZWN0cy9qaXJhLXJwZy1oYWNrYXRob24vZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3N0b3JpZXMvaW5kZXhlcy9fEAEaFAoQdXNlckppcmFVc2VybmFtZRABGg0KCWNyZWF0ZWRBdBACGgwKCF9fbmFtZV9fEAI

### Why This Index is Needed:
- `getRecentStories()` queries by `userJiraUsername` and orders by `createdAt`
- Firebase requires composite indexes for queries with WHERE + ORDER BY on different fields
- Currently using client-side sorting as temporary workaround (less efficient)

### After Creating Index:
1. Update `lib/story-service.js` to restore server-side ordering
2. Remove client-side sorting workaround
3. Remove TODO comments about index requirement

### Alternative Manual Creation:
1. Go to Firebase Console → Firestore → Indexes
2. Click "Create Index"
3. Collection ID: `stories`
4. Add fields:
   - `userJiraUsername` (Ascending)
   - `createdAt` (Descending)
5. Index will take a few minutes to build
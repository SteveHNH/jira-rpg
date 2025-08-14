#!/bin/bash

# test-conversational.sh - Test the conversational JIRA storytelling feature

echo "🎮 Testing Conversational JIRA Storytelling Feature"
echo "=================================================="

# Test configuration
API_BASE_URL="http://localhost:3000"
if [ "$1" = "prod" ]; then
    API_BASE_URL="https://your-vercel-app.vercel.app"
fi

echo "API Base URL: $API_BASE_URL"
echo ""

# Test 1: Mock Slack Events API message
echo "Test 1: Mock DM Message Event"
echo "------------------------------"

curl -X POST "$API_BASE_URL/api/slack-events" \
  -H "Content-Type: application/json" \
  -H "X-Slack-Request-Timestamp: $(date +%s)" \
  -H "X-Slack-Signature: v0=mock-signature-for-testing" \
  -d '{
    "token": "mock-token",
    "team_id": "T12345",
    "api_app_id": "A12345",
    "event": {
      "type": "message",
      "channel_type": "im",
      "user": "U12345",
      "text": "tell me what I did last 3 months",
      "ts": "1692123456.789"
    },
    "type": "event_callback",
    "event_id": "Ev12345",
    "event_time": 1692123456
  }' | jq '.' || echo "Response received"

echo -e "\n"

# Test 2: JIRA Client Health Check
echo "Test 2: JIRA Client Health Check"
echo "--------------------------------"

node -e "
import('./lib/jira-client.js').then(async (module) => {
  const client = module.default;
  const health = await client.healthCheck();
  console.log('JIRA Health:', JSON.stringify(health, null, 2));
}).catch(console.error);
"

echo -e "\n"

# Test 3: Conversation Service Health Check  
echo "Test 3: Conversation Service Health Check"
echo "----------------------------------------"

node -e "
import('./lib/conversation-service.js').then(async (module) => {
  const health = await module.conversationHealthCheck();
  console.log('Conversation Service Health:', JSON.stringify(health, null, 2));
}).catch(console.error);
"

echo -e "\n"

# Test 4: Test JIRA Ticket Fetching (with real user)
echo "Test 4: JIRA Ticket Fetching"
echo "----------------------------"

node -e "
import('./lib/jira-client.js').then(async (module) => {
  const client = module.default;
  try {
    console.log('Testing ticket fetch for thatstephenadams@gmail.com...');
    const tickets = await client.fetchUserTickets('thatstephenadams@gmail.com', {
      limit: 5,
      dateRange: '3m',
      status: 'closed,done,resolved'
    });
    console.log('Fetched tickets:', tickets.length);
    if (tickets.length > 0) {
      console.log('Sample ticket keys:', tickets.map(t => t.ticketKey).join(', '));
      console.log('First ticket details:');
      const first = tickets[0];
      console.log('  Key:', first.ticketKey);
      console.log('  Title:', first.title);
      console.log('  Status:', first.status);
      console.log('  Resolved:', first.resolved);
      console.log('  Project:', first.project.key);
    } else {
      console.log('No tickets found - check date range or user email');
    }
  } catch (error) {
    console.log('Error fetching tickets:', error.message);
    console.log('Make sure JIRA_API_URL, JIRA_API_EMAIL, and JIRA_API_TOKEN are configured');
  }
}).catch(console.error);
"

echo -e "\n"

# Test 5: Test Ollama Model
echo "Test 5: Conversational Model Test"
echo "---------------------------------"

if command -v ollama &> /dev/null; then
    echo "Checking if conversational model exists..."
    ollama list | grep jira-conversational || echo "Model not found - needs to be built"
    
    echo "Testing model response..."
    echo "USER_REQUEST: hi there!" | ollama run jira-conversational 2>/dev/null || echo "Model test failed - build model first"
else
    echo "Ollama not installed locally - skipping model test"
fi

echo -e "\n"

# Test 6: URL Verification Challenge
echo "Test 6: Slack URL Verification"
echo "------------------------------"

curl -X POST "$API_BASE_URL/api/slack-events" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "mock-token",
    "challenge": "test-challenge-123",
    "type": "url_verification"
  }' | jq '.' || echo "Response received"

echo -e "\n"

echo "🏁 Testing Complete!"
echo ""
echo "Next Steps:"
echo "1. Configure JIRA API credentials in .env"
echo "2. Build the conversational model: ollama create jira-conversational -f ConversationalModelfile"
echo "3. Set up Slack Events API endpoint in your Slack app configuration"
echo "4. Subscribe to 'message.im' events for direct messages"
echo "5. Test with real Slack DMs to registered users"
#!/usr/bin/env node

// Test script for Slack Commands API endpoint
// Usage: node scripts/test-slack-commands.js [command] [args]

const crypto = require('crypto');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || 'test-signing-secret-for-development';

// Mock Slack user and channel data
const MOCK_DATA = {
  user_id: 'U1234567890',
  user_name: 'test.user',
  channel_id: 'C1234567890',
  channel_name: 'dev-testing',
  team_id: 'T1234567890',
  response_url: 'https://hooks.slack.com/commands/1234/5678'
};

/**
 * Creates a valid Slack signature for request verification
 */
function createSlackSignature(timestamp, body) {
  const baseString = `v0:${timestamp}:${body}`;
  const signature = 'v0=' + crypto
    .createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(baseString)
    .digest('hex');
  return signature;
}

/**
 * Sends a test request to the Slack commands endpoint
 */
async function sendSlackCommand(command, text = '') {
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Create request body (URL encoded form data)
  const formData = new URLSearchParams({
    token: 'test-token',
    team_id: MOCK_DATA.team_id,
    team_domain: 'test-team',
    channel_id: MOCK_DATA.channel_id,
    channel_name: MOCK_DATA.channel_name,
    user_id: MOCK_DATA.user_id,
    user_name: MOCK_DATA.user_name,
    command: command,
    text: text,
    response_url: MOCK_DATA.response_url,
    trigger_id: 'test-trigger-id'
  });
  
  const body = formData.toString();
  const signature = createSlackSignature(timestamp, body);
  
  console.log(`\n🚀 Testing command: ${command} ${text}`);
  console.log(`📤 Request body: ${body.substring(0, 100)}...`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/slack-commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Slack-Signature': signature,
        'X-Slack-Request-Timestamp': timestamp.toString()
      },
      body: body
    });
    
    const result = await response.json();
    
    console.log(`📊 Status: ${response.status}`);
    console.log(`📋 Response:`, JSON.stringify(result, null, 2));
    
    return { status: response.status, data: result };
    
  } catch (error) {
    console.error(`❌ Request failed:`, error.message);
    return { error: error.message };
  }
}

/**
 * Test invalid signature
 */
async function testInvalidSignature() {
  const timestamp = Math.floor(Date.now() / 1000);
  const formData = new URLSearchParams({
    command: '/rpg-help',
    user_id: MOCK_DATA.user_id,
    user_name: MOCK_DATA.user_name,
    channel_id: MOCK_DATA.channel_id,
    text: ''
  });
  
  const body = formData.toString();
  const invalidSignature = 'v0=invalid-signature';
  
  console.log(`\n🔒 Testing invalid signature`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/slack-commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Slack-Signature': invalidSignature,
        'X-Slack-Request-Timestamp': timestamp.toString()
      },
      body: body
    });
    
    const result = await response.json();
    
    console.log(`📊 Status: ${response.status} (should be 401)`);
    console.log(`📋 Response:`, JSON.stringify(result, null, 2));
    
    if (response.status === 401) {
      console.log(`✅ Signature verification working correctly`);
    } else {
      console.log(`❌ Expected 401 status for invalid signature`);
    }
    
  } catch (error) {
    console.error(`❌ Request failed:`, error.message);
  }
}

/**
 * Test old timestamp (replay attack protection)
 */
async function testOldTimestamp() {
  const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 6+ minutes ago
  const formData = new URLSearchParams({
    command: '/rpg-help',
    user_id: MOCK_DATA.user_id,
    user_name: MOCK_DATA.user_name,
    channel_id: MOCK_DATA.channel_id,
    text: ''
  });
  
  const body = formData.toString();
  const signature = createSlackSignature(oldTimestamp, body);
  
  console.log(`\n⏰ Testing old timestamp (replay attack protection)`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/slack-commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Slack-Signature': signature,
        'X-Slack-Request-Timestamp': oldTimestamp.toString()
      },
      body: body
    });
    
    const result = await response.json();
    
    console.log(`📊 Status: ${response.status} (should be 401)`);
    console.log(`📋 Response:`, JSON.stringify(result, null, 2));
    
    if (response.status === 401) {
      console.log(`✅ Timestamp validation working correctly`);
    } else {
      console.log(`❌ Expected 401 status for old timestamp`);
    }
    
  } catch (error) {
    console.error(`❌ Request failed:`, error.message);
  }
}

/**
 * Run test suite
 */
async function runTests() {
  console.log(`🧪 Slack Commands Test Suite`);
  console.log(`🌐 Testing against: ${BASE_URL}/api/slack-commands`);
  console.log(`🔐 Using signing secret: ${SLACK_SIGNING_SECRET.substring(0, 10)}...`);
  
  // Test basic commands
  const commands = [
    ['/rpg-help', ''],
    ['/rpg-status', ''],
    ['/rpg-register', 'john.doe'],
    ['/rpg-leaderboard', ''],
    ['/rpg-teams', ''],
    ['/rpg-join', 'frontend-warriors'],
    ['/rpg-leave', 'frontend-warriors'],
    ['/rpg-achievements', ''],
    ['/rpg-guild-stats', 'frontend-warriors'],
    ['/rpg-config', 'create-team frontend-ui UI #frontend'],
    ['/unknown-command', 'test']
  ];
  
  // Test valid commands
  for (const [command, text] of commands) {
    await sendSlackCommand(command, text);
    await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay
  }
  
  // Test security features
  await testInvalidSignature();
  await testOldTimestamp();
  
  console.log(`\n✅ Test suite completed!`);
  console.log(`\n💡 Tips:`);
  console.log(`   • Check server logs for detailed processing info`);
  console.log(`   • Verify Firebase connection for database-dependent commands`);
  console.log(`   • Test with real Slack workspace for full integration`);
}

/**
 * Main function - handle command line arguments
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Run full test suite
    await runTests();
  } else {
    // Run specific command test
    const command = args[0];
    const text = args.slice(1).join(' ');
    await sendSlackCommand(command, text);
  }
}

// Handle script execution
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { sendSlackCommand, createSlackSignature };
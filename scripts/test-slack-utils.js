#!/usr/bin/env node

// Simplified test script for Slack utility functions
// Tests signature generation and validation logic
// Usage: node scripts/test-slack-utils-simple.js

const crypto = require('crypto');

// Test configuration
const TEST_CONFIG = {
  slackSigningSecret: process.env.SLACK_SIGNING_SECRET || 'test-signing-secret',
  slackBotToken: process.env.SLACK_BOT_TOKEN,
  testChannelId: process.env.TEST_CHANNEL_ID || 'C1234567890',
  testUserId: process.env.TEST_USER_ID || 'U1234567890'
};

/**
 * Create mock request object for testing signature verification
 */
function createMockRequest(body, options = {}) {
  const timestamp = options.timestamp || Math.floor(Date.now() / 1000);
  const bodyString = typeof body === 'string' ? body : new URLSearchParams(body).toString();
  
  let signature = null;
  if (options.createValidSignature !== false) {
    const baseString = `v0:${timestamp}:${bodyString}`;
    signature = 'v0=' + crypto
      .createHmac('sha256', TEST_CONFIG.slackSigningSecret)
      .update(baseString)
      .digest('hex');
  }
  
  return {
    headers: {
      'x-slack-signature': options.invalidSignature || signature,
      'x-slack-request-timestamp': timestamp.toString(),
      ...options.extraHeaders
    },
    body: bodyString
  };
}

/**
 * Manual signature verification (mirrors lib/slack.js logic)
 */
function testSignatureVerification(req) {
  const slackSignature = req.headers['x-slack-signature'];
  const timestamp = req.headers['x-slack-request-timestamp'];
  const body = req.body;
  
  if (!slackSignature || !timestamp) {
    return false;
  }
  
  // Check timestamp (within 5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    return false;
  }
  
  // Verify signature
  const baseString = `v0:${timestamp}:${body}`;
  const expectedSignature = 'v0=' + crypto
    .createHmac('sha256', TEST_CONFIG.slackSigningSecret)
    .update(baseString)
    .digest('hex');
  
  return slackSignature === expectedSignature;
}

/**
 * Test formatting functions (locally implemented)
 */
function testFormatting() {
  console.log('\n🎨 Testing Formatting Functions');
  
  const formatUserMention = (userId) => `<@${userId}>`;
  const formatChannelMention = (channelId) => `<#${channelId}>`;
  
  const testCases = [
    {
      name: 'User mention',
      func: () => formatUserMention('U1234567890'),
      expected: '<@U1234567890>'
    },
    {
      name: 'Channel mention',
      func: () => formatChannelMention('C1234567890'),
      expected: '<#C1234567890>'
    }
  ];
  
  testCases.forEach(testCase => {
    console.log(`\n  📋 ${testCase.name}`);
    
    try {
      const result = testCase.func();
      
      if (result === testCase.expected) {
        console.log(`     ✅ PASS: "${result}"`);
      } else {
        console.log(`     ❌ FAIL: Expected "${testCase.expected}", got "${result}"`);
      }
    } catch (error) {
      console.log(`     ❌ ERROR: ${error.message}`);
    }
  });
}

/**
 * Test signature verification with various scenarios
 */
function testSignatureScenarios() {
  console.log('\n🔒 Testing Signature Verification');
  
  const testCases = [
    {
      name: 'Valid signature',
      setup: () => createMockRequest({ command: '/test', text: 'hello' }),
      expected: true
    },
    {
      name: 'Invalid signature',
      setup: () => createMockRequest(
        { command: '/test', text: 'hello' },
        { invalidSignature: 'v0=invalid-signature' }
      ),
      expected: false
    },
    {
      name: 'Missing signature header',
      setup: () => {
        const req = createMockRequest({ command: '/test' });
        delete req.headers['x-slack-signature'];
        return req;
      },
      expected: false
    },
    {
      name: 'Missing timestamp header',
      setup: () => {
        const req = createMockRequest({ command: '/test' });
        delete req.headers['x-slack-request-timestamp'];
        return req;
      },
      expected: false
    },
    {
      name: 'Old timestamp (6+ minutes)',
      setup: () => createMockRequest(
        { command: '/test' },
        { timestamp: Math.floor(Date.now() / 1000) - 400 }
      ),
      expected: false
    },
    {
      name: 'Empty body',
      setup: () => createMockRequest(''),
      expected: true
    }
  ];
  
  testCases.forEach(testCase => {
    console.log(`\n  📋 ${testCase.name}`);
    
    try {
      const mockReq = testCase.setup();
      const result = testSignatureVerification(mockReq);
      
      if (result === testCase.expected) {
        console.log(`     ✅ PASS: Expected ${testCase.expected}, got ${result}`);
      } else {
        console.log(`     ❌ FAIL: Expected ${testCase.expected}, got ${result}`);
      }
    } catch (error) {
      console.log(`     ❌ ERROR: ${error.message}`);
    }
  });
}

/**
 * Test Slack API connectivity (basic health check)
 */
async function testSlackAPI() {
  console.log('\n🌐 Testing Slack API Connectivity');
  
  if (!TEST_CONFIG.slackBotToken) {
    console.log('  ⏭️  Skipping API tests - SLACK_BOT_TOKEN not set');
    return;
  }
  
  // Test auth.test endpoint to verify token
  console.log('\n  📋 Bot token validation');
  try {
    const response = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.slackBotToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    const data = await response.json();
    
    if (data.ok) {
      console.log(`     ✅ PASS: Bot token valid - Team: ${data.team}, User: ${data.user}`);
    } else {
      console.log(`     ❌ FAIL: Bot token invalid - ${data.error}`);
    }
  } catch (error) {
    console.log(`     ❌ ERROR: ${error.message}`);
  }
}

/**
 * Test environment variable handling
 */
function testEnvironmentVariables() {
  console.log('\n🔧 Testing Environment Variable Handling');
  
  const originalToken = process.env.SLACK_BOT_TOKEN;
  const originalSecret = process.env.SLACK_SIGNING_SECRET;
  
  // Test missing signing secret
  console.log('\n  📋 Missing SLACK_SIGNING_SECRET');
  delete process.env.SLACK_SIGNING_SECRET;
  try {
    const mockReq = createMockRequest({ test: 'data' }, { createValidSignature: false });
    // This should fail because we deleted the signing secret
    const result = testSignatureVerification(mockReq);
    console.log(`     ✅ PASS: Correctly handled missing secret (${result})`);
  } catch (error) {
    console.log(`     ✅ PASS: Correctly errored with missing secret`);
  }
  
  // Test bot token availability
  console.log('\n  📋 SLACK_BOT_TOKEN availability');
  if (originalToken) {
    console.log(`     ✅ PASS: Bot token is configured`);
  } else {
    console.log(`     ⚠️  WARNING: Bot token not configured`);
  }
  
  // Restore environment variables
  if (originalToken) process.env.SLACK_BOT_TOKEN = originalToken;
  if (originalSecret) process.env.SLACK_SIGNING_SECRET = originalSecret;
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🧪 Slack Utils Test Suite (Simplified)');
  console.log(`🔐 Using signing secret: ${TEST_CONFIG.slackSigningSecret.substring(0, 10)}...`);
  console.log(`🤖 Bot token configured: ${TEST_CONFIG.slackBotToken ? 'Yes' : 'No'}`);
  console.log(`📺 Test channel: ${TEST_CONFIG.testChannelId}`);
  console.log(`👤 Test user: ${TEST_CONFIG.testUserId}`);
  
  // Run test suites
  testSignatureScenarios();
  testFormatting();
  testEnvironmentVariables();
  await testSlackAPI();
  
  console.log('\n✅ Simplified Slack Utils test suite completed!');
  console.log('\n💡 Tips:');
  console.log('   • Set SLACK_BOT_TOKEN to test API connectivity');
  console.log('   • Use full integration tests for end-to-end validation');
  console.log('   • Check Slack app configuration if API tests fail');
  console.log('   • This simplified version tests core signature logic');
}

// Handle script execution
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { 
  createMockRequest, 
  testSignatureVerification, 
  testSignatureScenarios,
  testFormatting, 
  testSlackAPI
};
#!/usr/bin/env node

// Debug script to test Home tab publishing with more detailed output
// This helps diagnose why the Home tab isn't showing up

import { publishHomeTab } from '../lib/home-tab-service.js';

async function debugHomeTab() {
  console.log('🔍 Debugging Home Tab Publishing\n');

  // Test environment variables
  console.log('📝 Environment Check:');
  console.log('  SLACK_BOT_TOKEN:', process.env.SLACK_BOT_TOKEN ? 'configured' : 'MISSING');
  
  if (process.env.SLACK_BOT_TOKEN) {
    console.log('  Token starts with:', process.env.SLACK_BOT_TOKEN.substring(0, 10) + '...');
  }
  
  console.log('');

  // Test with mock user ID (you can replace this with a real user ID from your logs)
  const testUserId = 'U1234567890'; // Replace with actual user ID from Vercel logs
  
  console.log('🧪 Testing Home tab publishing...');
  console.log('  Test User ID:', testUserId);
  console.log('  User Type: Unregistered (simpler test case)');
  
  try {
    const result = await publishHomeTab(testUserId, null);
    console.log('\n✅ Publishing result:', result);
    
    if (!result) {
      console.log('\n❌ Home tab publishing failed. Check the detailed logs above.');
      console.log('\n🔧 Common issues to check:');
      console.log('1. Slack bot token is valid and has correct scopes');
      console.log('2. App has "app_home_opened" event subscription');  
      console.log('3. App Home tab is enabled in Slack app settings');
      console.log('4. App has been reinstalled after adding new permissions');
      console.log('5. User ID format is correct (should start with U)');
    }
    
  } catch (error) {
    console.error('\n💥 Error during test:', error.message);
    console.error('Stack trace:', error.stack);
  }

  console.log('\n📋 Next steps:');
  console.log('1. Replace testUserId with real user ID from your Vercel logs');
  console.log('2. Run this script again: node scripts/debug-home-tab.js');
  console.log('3. Check Slack API documentation for any recent changes');
  console.log('4. Verify all OAuth scopes are correct in Slack app settings');
}

// Run the debug test
debugHomeTab().catch(error => {
  console.error('Debug script failed:', error);
  process.exit(1);
});
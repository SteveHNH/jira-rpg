// Test conversational storytelling with real JIRA data
import { handleConversationalRequest } from '../lib/conversation-service.js';

async function testConversation() {
  console.log('🎮 Testing Conversational JIRA Storytelling');
  console.log('============================================\n');
  
  // Mock user data (would normally come from getUserBySlackId)
  const mockUserData = {
    slackUserId: 'U12345',
    jiraUsername: 'thatstephenadams@gmail.com',
    displayName: 'Stephen Adams',
    xp: 1250,
    level: 8
  };
  
  console.log('Testing conversation: "tell me what I accomplished last week"');
  console.log('User:', JSON.stringify(mockUserData, null, 2));
  console.log('');
  
  try {
    // This would normally be called from the slack-events handler
    await handleConversationalRequest(
      'U12345', 
      'tell me what I accomplished last week',
      'D12345', // Mock DM channel ID
      mockUserData
    );
    
    console.log('✅ Conversation completed successfully!');
    console.log('Check your console for the full conversation flow.');
    
  } catch (error) {
    console.error('❌ Conversation failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testConversation().catch(console.error);
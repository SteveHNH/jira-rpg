// test-dm-functionality.js - Test script for DM functionality

// Simulate a DM event payload
const mockDmEvent = {
  type: 'event_callback',
  event: {
    type: 'message',
    channel_type: 'im',
    user: 'U123456789', // Your Slack user ID
    text: 'what did I do last week',
    ts: Date.now() / 1000, // Current timestamp
    channel: 'D123456789' // DM channel ID
  }
};

// Mock Slack headers
const mockHeaders = {
  'x-slack-request-timestamp': Math.floor(Date.now() / 1000),
  'x-slack-signature': 'v0=mock-signature-for-testing',
  'content-type': 'application/json'
};

async function testDmFunctionality() {
  try {
    console.log('🧪 Testing DM functionality...');
    
    const response = await fetch('http://localhost:3000/api/slack-events', {
      method: 'POST',
      headers: {
        ...mockHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mockDmEvent)
    });

    const result = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', result);

    if (response.ok) {
      console.log('✅ DM test completed successfully');
    } else {
      console.log('❌ DM test failed');
    }

  } catch (error) {
    console.error('❌ DM test error:', error.message);
  }
}

async function testDuplicateHandling() {
  try {
    console.log('🧪 Testing duplicate message handling...');
    
    // Send the same message twice
    const duplicateEvent = {
      ...mockDmEvent,
      event: {
        ...mockDmEvent.event,
        text: 'duplicate test message',
        ts: '1699999999.123456' // Fixed timestamp for testing
      }
    };

    console.log('Sending first message...');
    const response1 = await fetch('http://localhost:3000/api/slack-events', {
      method: 'POST',
      headers: {
        ...mockHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(duplicateEvent)
    });

    console.log('Sending duplicate message...');
    const response2 = await fetch('http://localhost:3000/api/slack-events', {
      method: 'POST',
      headers: {
        ...mockHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(duplicateEvent)
    });

    console.log('First response status:', response1.status);
    console.log('Second response status:', response2.status);

    if (response1.ok && response2.ok) {
      console.log('✅ Duplicate handling test completed (check logs for duplicate detection)');
    } else {
      console.log('❌ Duplicate handling test failed');
    }

  } catch (error) {
    console.error('❌ Duplicate handling test error:', error.message);
  }
}

// Run tests
console.log('Starting DM functionality tests...\n');

testDmFunctionality()
  .then(() => {
    console.log('\n' + '='.repeat(50) + '\n');
    return testDuplicateHandling();
  })
  .then(() => {
    console.log('\n✅ All DM tests completed');
  })
  .catch(error => {
    console.error('\n❌ Test suite failed:', error);
  });
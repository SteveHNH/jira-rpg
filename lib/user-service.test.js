// Integration tests for user-service.js XP functions
// Tests database operations, XP awards, and level progression

import { 
  awardXP, 
  awardXpFromWebhook, 
  getUserBySlackId 
} from './user-service.js';
import { calculateLevel, getTitleForLevel } from './xp-calculator.js';

// Mock Firebase for testing
const mockDb = {
  users: new Map(),
  nextId: 1
};

// Mock Firebase functions
const mockFirestore = {
  doc: (collection, id) => ({
    id,
    collection,
    get: async () => ({
      exists: () => mockDb.users.has(id),
      data: () => mockDb.users.get(id),
      id
    }),
    set: async (data) => {
      mockDb.users.set(id, { ...data, id });
    },
    update: async (updates) => {
      const existing = mockDb.users.get(id) || {};
      mockDb.users.set(id, { ...existing, ...updates });
    }
  }),
  getDoc: async (docRef) => docRef.get(),
  setDoc: async (docRef, data) => docRef.set(data),
  updateDoc: async (docRef, data) => docRef.update(data)
};

// Test utilities
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: Expected ${expected}, got ${actual}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual, null, 2);
  const expectedStr = JSON.stringify(expected, null, 2);
  if (actualStr !== expectedStr) {
    throw new Error(`${message}:\nExpected: ${expectedStr}\nActual: ${actualStr}`);
  }
}

function runTest(testName, testFunction) {
  try {
    // Clear mock database before each test
    mockDb.users.clear();
    testFunction();
    console.log(`✅ ${testName}`);
    return true;
  } catch (error) {
    console.error(`❌ ${testName}: ${error.message}`);
    return false;
  }
}

// Test data generators
function createMockWebhookPayload(options = {}) {
  const defaults = {
    webhookEvent: 'jira:issue_updated',
    issue: {
      key: 'TEST-123',
      fields: {
        summary: 'Test Issue',
        issuetype: { name: 'Story' },
        status: { name: 'Done' },
        assignee: {
          name: 'test.user',
          emailAddress: 'test.user@company.com',
          displayName: 'Test User'
        }
      }
    },
    user: {
      name: 'test.user',
      emailAddress: 'test.user@company.com',
      displayName: 'Test User'
    },
    changelog: {
      items: [{
        field: 'status',
        fromString: 'In Progress',
        toString: 'Done'
      }]
    }
  };
  
  return { ...defaults, ...options };
}

// Test suite runner
function runUserServiceTestSuite() {
  console.log('🗡️  JIRA RPG User Service Integration Test Suite');
  console.log('==============================================\n');
  
  let passed = 0;
  let failed = 0;
  
  const tests = [
    // Basic XP award tests
    ['Award XP to new user', testAwardXpNewUser],
    ['Award XP to existing user', testAwardXpExistingUser],
    ['Award XP with level up', testAwardXpWithLevelUp],
    ['Award XP with multi-level up', testAwardXpMultiLevelUp],
    
    // Webhook XP tests
    ['Award XP from webhook - ticket completed', testWebhookTicketCompleted],
    ['Award XP from webhook - with story points', testWebhookWithStoryPoints],
    ['Award XP from webhook - bug fix', testWebhookBugFix],
    ['Award XP from webhook - invalid payload', testWebhookInvalidPayload],
    
    // Database consistency tests
    ['Database consistency after XP award', testDatabaseConsistency],
    ['Concurrent XP awards', testConcurrentXpAwards],
    
    // User progression tests
    ['Complete user progression simulation', testCompleteUserProgression],
    ['Level cap enforcement', testLevelCapEnforcement]
  ];
  
  console.log('Running integration tests...\n');
  
  for (const [testName, testFunction] of tests) {
    if (runTest(testName, testFunction)) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log(`\n📊 Integration Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All integration tests passed! User service is working correctly.');
    return true;
  } else {
    console.log('❌ Some integration tests failed. Please review the implementation.');
    return false;
  }
}

// Basic XP award tests
async function testAwardXpNewUser() {
  // Mock the database call to simulate Firebase behavior
  const originalDoc = mockFirestore.doc;
  let userCreated = false;
  
  mockFirestore.doc = (collection, id) => ({
    ...originalDoc(collection, id),
    get: async () => ({
      exists: () => userCreated,
      data: () => userCreated ? mockDb.users.get(id) : null,
      id
    }),
    set: async (data) => {
      mockDb.users.set(id, { ...data, id });
      userCreated = true;
    }
  });
  
  const userEmail = 'newuser@company.com';
  const result = await awardXP(userEmail, 100, 'Test XP award');
  
  assertEqual(result.xpAwarded, 100, 'XP awarded amount');
  assertEqual(result.totalXp, 100, 'Total XP after award');
  assertEqual(result.newLevel, calculateLevel(100), 'Calculated level');
  assertEqual(result.newTitle, getTitleForLevel(calculateLevel(100)), 'Calculated title');
  
  // Restore original function
  mockFirestore.doc = originalDoc;
}

async function testAwardXpExistingUser() {
  const userEmail = 'existing@company.com';
  
  // Create existing user with some XP
  mockDb.users.set(userEmail, {
    xp: 200,
    level: calculateLevel(200),
    currentTitle: getTitleForLevel(calculateLevel(200))
  });
  
  const result = await awardXP(userEmail, 50, 'Additional XP');
  
  assertEqual(result.xpAwarded, 50, 'XP awarded amount');
  assertEqual(result.totalXp, 250, 'Total XP after award');
  assertEqual(result.newLevel, calculateLevel(250), 'Updated level');
}

async function testAwardXpWithLevelUp() {
  const userEmail = 'levelup@company.com';
  
  // Create user just below level 2 threshold (160 XP)
  mockDb.users.set(userEmail, {
    xp: 150,
    level: 1,
    currentTitle: 'Novice Adventurer'
  });
  
  const result = await awardXP(userEmail, 50, 'Level up XP'); // Total: 200 XP (Level 2)
  
  assertEqual(result.leveledUp, true, 'Level up detected');
  assertEqual(result.oldLevel, 1, 'Old level');
  assertEqual(result.newLevel, 2, 'New level');
  assertEqual(result.oldTitle, 'Novice Adventurer', 'Old title');
  assertEqual(result.newTitle, getTitleForLevel(2), 'New title');
}

async function testAwardXpMultiLevelUp() {
  const userEmail = 'multilevel@company.com';
  
  // Create user at level 1
  mockDb.users.set(userEmail, {
    xp: 100,
    level: 1,
    currentTitle: 'Novice Adventurer'
  });
  
  const result = await awardXP(userEmail, 1000, 'Massive XP award'); // Total: 1100 XP (Level 6)
  
  assertEqual(result.leveledUp, true, 'Multi-level up detected');
  assertEqual(result.oldLevel, 1, 'Old level');
  assertEqual(result.newLevel, calculateLevel(1100), 'New level after multi-level up');
  assertEqual(result.levelsGained > 1, true, 'Multiple levels gained');
}

// Webhook XP tests
async function testWebhookTicketCompleted() {
  const userEmail = 'webhook@company.com';
  const payload = createMockWebhookPayload();
  
  const result = await awardXpFromWebhook(userEmail, payload);
  
  assertEqual(result.xpAwarded, 50, 'Ticket completion XP (50)'); // Base completion XP
  assertEqual(result.reason.includes('Ticket completed'), true, 'Completion reason mentioned');
}

async function testWebhookWithStoryPoints() {
  const userEmail = 'storypoints@company.com';
  const payload = createMockWebhookPayload({
    issue: {
      ...createMockWebhookPayload().issue,
      fields: {
        ...createMockWebhookPayload().issue.fields,
        customfield_10016: 3 // 3 story points
      }
    }
  });
  
  const result = await awardXpFromWebhook(userEmail, payload);
  
  assertEqual(result.xpAwarded, 80, 'Completion + story points XP (50 + 30)');
  assertEqual(result.reason.includes('Story points bonus'), true, 'Story points bonus mentioned');
}

async function testWebhookBugFix() {
  const userEmail = 'bugfix@company.com';
  const payload = createMockWebhookPayload({
    issue: {
      ...createMockWebhookPayload().issue,
      fields: {
        ...createMockWebhookPayload().issue.fields,
        issuetype: { name: 'Bug' }
      }
    }
  });
  
  const result = await awardXpFromWebhook(userEmail, payload);
  
  assertEqual(result.xpAwarded, 75, 'Bug fix XP (50 + 25 bonus)');
  assertEqual(result.reason.includes('Bug fix bonus'), true, 'Bug fix bonus mentioned');
}

async function testWebhookInvalidPayload() {
  const userEmail = 'invalid@company.com';
  const invalidPayload = { invalid: 'payload' };
  
  const result = await awardXpFromWebhook(userEmail, invalidPayload);
  
  assertEqual(result.xpAwarded, 0, 'No XP for invalid payload');
  assertEqual(result.leveledUp, false, 'No level up for invalid payload');
}

// Database consistency tests
async function testDatabaseConsistency() {
  const userEmail = 'consistency@company.com';
  
  // Award XP multiple times
  await awardXP(userEmail, 100, 'First award');
  await awardXP(userEmail, 200, 'Second award');
  await awardXP(userEmail, 50, 'Third award');
  
  const userData = mockDb.users.get(userEmail);
  const expectedXp = 350;
  const expectedLevel = calculateLevel(expectedXp);
  const expectedTitle = getTitleForLevel(expectedLevel);
  
  assertEqual(userData.xp, expectedXp, 'Total XP consistency');
  assertEqual(userData.level, expectedLevel, 'Level consistency');
  assertEqual(userData.currentTitle, expectedTitle, 'Title consistency');
}

async function testConcurrentXpAwards() {
  const userEmail = 'concurrent@company.com';
  
  // Simulate concurrent XP awards (though mock is synchronous)
  const awards = [
    awardXP(userEmail, 50, 'Award 1'),
    awardXP(userEmail, 75, 'Award 2'),
    awardXP(userEmail, 100, 'Award 3')
  ];
  
  const results = await Promise.all(awards);
  
  // All awards should be processed (in mock environment)
  assertEqual(results.length, 3, 'All concurrent awards processed');
  assertEqual(results.every(r => r.xpAwarded > 0), true, 'All awards had positive XP');
}

// User progression tests
async function testCompleteUserProgression() {
  const userEmail = 'progression@company.com';
  let currentLevel = 1;
  
  // Simulate completing 20 tickets with various XP amounts
  for (let i = 0; i < 20; i++) {
    const xpAmount = 80 + (i * 10); // Increasing XP amounts
    const result = await awardXP(userEmail, xpAmount, `Ticket ${i + 1}`);
    
    if (result.leveledUp) {
      console.log(`  Ticket ${i + 1}: Leveled up from ${result.oldLevel} to ${result.newLevel}`);
      currentLevel = result.newLevel;
    }
  }
  
  const finalUser = mockDb.users.get(userEmail);
  const expectedLevel = calculateLevel(finalUser.xp);
  
  assertEqual(finalUser.level, expectedLevel, 'Final level matches XP');
  assertEqual(finalUser.currentTitle, getTitleForLevel(expectedLevel), 'Final title matches level');
  assertEqual(currentLevel > 1, true, 'User progressed beyond level 1');
}

async function testLevelCapEnforcement() {
  const userEmail = 'levelcap@company.com';
  
  // Award massive XP to exceed level cap
  const result = await awardXP(userEmail, 20000, 'Massive XP award');
  
  assertEqual(result.newLevel, 20, 'Level capped at 20');
  assertEqual(result.newTitle, getTitleForLevel(20), 'Title capped at max level');
}

// Export for Node.js usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runUserServiceTestSuite };
} else {
  // Browser usage
  runUserServiceTestSuite();
}
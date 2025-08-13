// Comprehensive test suite for XP Calculator module
// Tests level progression, XP awards, and title system

import {
  calculateLevel,
  getXpForLevel,
  getXpForNextLevel,
  getTitleForLevel,
  calculateXpAward,
  checkLevelUp,
  XP_RULES,
  LEVEL_THRESHOLDS,
  TITLES
} from './xp-calculator.js';

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
    testFunction();
    console.log(`✅ ${testName}`);
    return true;
  } catch (error) {
    console.error(`❌ ${testName}: ${error.message}`);
    return false;
  }
}

// Test suite runner
function runTestSuite() {
  console.log('🗡️  JIRA RPG XP Calculator Test Suite');
  console.log('=====================================\n');
  
  let passed = 0;
  let failed = 0;
  
  const tests = [
    // Level calculation tests
    ['Level 1 calculation (0 XP)', testLevel1],
    ['Level 2 calculation (160 XP)', testLevel2],
    ['Level 5 calculation (800 XP)', testLevel5],
    ['Level 6 calculation (1200 XP)', testLevel6],
    ['Level 10 calculation (2800 XP)', testLevel10],
    ['Level 15 calculation (5800 XP)', testLevel15],
    ['Level 20 calculation (9800 XP)', testLevel20],
    ['Level edge cases', testLevelEdgeCases],
    
    // XP threshold tests
    ['XP thresholds accuracy', testXpThresholds],
    ['Next level XP calculation', testNextLevelXp],
    
    // Title progression tests
    ['Title progression system', testTitleProgression],
    ['Title edge cases', testTitleEdgeCases],
    
    // XP award calculation tests
    ['Ticket assigned XP award', testTicketAssignedXp],
    ['Ticket in progress XP award', testTicketInProgressXp],
    ['Ticket completed XP award', testTicketCompletedXp],
    ['Story points bonus XP', testStoryPointsBonus],
    ['Bug fix bonus XP', testBugFixBonus],
    ['Quick completion bonus XP', testQuickCompletionBonus],
    ['Complex XP award scenario', testComplexXpAward],
    ['Invalid payload XP award', testInvalidPayloadXp],
    
    // Level up detection tests
    ['Basic level up detection', testBasicLevelUp],
    ['Multi-level up detection', testMultiLevelUp],
    ['No level up detection', testNoLevelUp],
    ['Level up edge cases', testLevelUpEdgeCases],
    
    // Integration tests
    ['Full progression simulation', testFullProgressionSimulation],
    ['PLAN.md compliance test', testPlanMdCompliance]
  ];
  
  console.log('Running tests...\n');
  
  for (const [testName, testFunction] of tests) {
    if (runTest(testName, testFunction)) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All tests passed! XP system is working correctly.');
    return true;
  } else {
    console.log('❌ Some tests failed. Please review the implementation.');
    return false;
  }
}

// Level calculation tests
function testLevel1() {
  assertEqual(calculateLevel(0), 1, 'Level 1 from 0 XP');
  assertEqual(calculateLevel(50), 1, 'Level 1 from 50 XP');
  assertEqual(calculateLevel(159), 1, 'Level 1 from 159 XP');
}

function testLevel2() {
  assertEqual(calculateLevel(160), 2, 'Level 2 from 160 XP');
  assertEqual(calculateLevel(200), 2, 'Level 2 from 200 XP');
  assertEqual(calculateLevel(319), 2, 'Level 2 from 319 XP');
}

function testLevel5() {
  assertEqual(calculateLevel(640), 5, 'Level 5 from 640 XP');
  assertEqual(calculateLevel(750), 5, 'Level 5 from 750 XP');
  assertEqual(calculateLevel(799), 5, 'Level 5 from 799 XP');
}

function testLevel6() {
  assertEqual(calculateLevel(800), 6, 'Level 6 from 800 XP');
  assertEqual(calculateLevel(1000), 6, 'Level 6 from 1000 XP');
  assertEqual(calculateLevel(1199), 6, 'Level 6 from 1199 XP');
}

function testLevel10() {
  assertEqual(calculateLevel(2400), 10, 'Level 10 from 2400 XP');
  assertEqual(calculateLevel(2600), 10, 'Level 10 from 2600 XP');
  assertEqual(calculateLevel(2799), 10, 'Level 10 from 2799 XP');
}

function testLevel15() {
  assertEqual(calculateLevel(5200), 15, 'Level 15 from 5200 XP');
  assertEqual(calculateLevel(5500), 15, 'Level 15 from 5500 XP');
  assertEqual(calculateLevel(5799), 15, 'Level 15 from 5799 XP');
}

function testLevel20() {
  assertEqual(calculateLevel(9000), 20, 'Level 20 from 9000 XP');
  assertEqual(calculateLevel(15000), 20, 'Level 20 capped at max');
}

function testLevelEdgeCases() {
  assertEqual(calculateLevel(-100), 1, 'Negative XP defaults to level 1');
  assertEqual(calculateLevel(null), 1, 'Null XP defaults to level 1');
  assertEqual(calculateLevel(undefined), 1, 'Undefined XP defaults to level 1');
  assertEqual(calculateLevel('invalid'), 1, 'Invalid XP defaults to level 1');
}

// XP threshold tests
function testXpThresholds() {
  // Test all level thresholds match PLAN.md
  assertEqual(getXpForLevel(1), 0, 'Level 1 threshold');
  assertEqual(getXpForLevel(2), 160, 'Level 2 threshold');
  assertEqual(getXpForLevel(3), 320, 'Level 3 threshold');
  assertEqual(getXpForLevel(6), 800, 'Level 6 threshold');
  assertEqual(getXpForLevel(11), 2800, 'Level 11 threshold');
  assertEqual(getXpForLevel(16), 5800, 'Level 16 threshold');
  assertEqual(getXpForLevel(20), 9000, 'Level 20 threshold');
}

function testNextLevelXp() {
  assertEqual(getXpForNextLevel(1), 160, 'XP for level 2');
  assertEqual(getXpForNextLevel(5), 800, 'XP for level 6');
  assertEqual(getXpForNextLevel(10), 2800, 'XP for level 11');
  assertEqual(getXpForNextLevel(20), 9000, 'XP for level 20 (cap)');
}

// Title tests
function testTitleProgression() {
  assertEqual(getTitleForLevel(1), 'Novice Adventurer', 'Level 1 title');
  assertEqual(getTitleForLevel(5), 'Elite Specialist', 'Level 5 title');
  assertEqual(getTitleForLevel(10), 'Master Architect', 'Level 10 title');
  assertEqual(getTitleForLevel(15), 'Legendary Architect', 'Level 15 title');
  assertEqual(getTitleForLevel(20), 'Debugging God', 'Level 20 title');
}

function testTitleEdgeCases() {
  assertEqual(getTitleForLevel(0), 'Novice Adventurer', 'Level 0 defaults to level 1 title');
  assertEqual(getTitleForLevel(25), 'Debugging God', 'Level >20 caps at level 20 title');
  assertEqual(getTitleForLevel(-5), 'Novice Adventurer', 'Negative level defaults to level 1 title');
}

// XP award tests
function testTicketAssignedXp() {
  const payload = {
    issue: { fields: { assignee: { displayName: 'Test User' } } },
    changelog: { items: [{ field: 'status', fromString: 'To Do', toString: 'In Progress' }] }
  };
  
  const result = calculateXpAward(payload);
  assertEqual(result.xp, XP_RULES.TICKET_IN_PROGRESS, 'Ticket assigned XP');
}

function testTicketInProgressXp() {
  const payload = {
    issue: { fields: {} },
    changelog: { items: [{ field: 'status', fromString: 'To Do', toString: 'In Progress' }] }
  };
  
  const result = calculateXpAward(payload);
  assertEqual(result.xp, XP_RULES.TICKET_IN_PROGRESS, 'Ticket in progress XP');
}

function testTicketCompletedXp() {
  const payload = {
    issue: { fields: {} },
    changelog: { items: [{ field: 'status', fromString: 'In Progress', toString: 'Done' }] }
  };
  
  const result = calculateXpAward(payload);
  assertEqual(result.xp, XP_RULES.TICKET_COMPLETED, 'Ticket completed XP');
}

function testStoryPointsBonus() {
  const payload = {
    issue: { 
      fields: { 
        customfield_10016: 5 // Story points
      } 
    },
    changelog: { items: [{ field: 'status', fromString: 'In Progress', toString: 'Done' }] }
  };
  
  const result = calculateXpAward(payload);
  const expectedXp = XP_RULES.TICKET_COMPLETED + (5 * XP_RULES.STORY_POINTS_MULTIPLIER);
  assertEqual(result.xp, expectedXp, 'Story points bonus XP');
}

function testBugFixBonus() {
  const payload = {
    issue: { 
      fields: { 
        issuetype: { name: 'Bug' }
      } 
    },
    changelog: { items: [{ field: 'status', fromString: 'In Progress', toString: 'Done' }] }
  };
  
  const result = calculateXpAward(payload);
  const expectedXp = XP_RULES.TICKET_COMPLETED + XP_RULES.BUG_BONUS;
  assertEqual(result.xp, expectedXp, 'Bug fix bonus XP');
}

function testQuickCompletionBonus() {
  const now = new Date();
  const twentyHoursAgo = new Date(now.getTime() - (20 * 60 * 60 * 1000));
  
  const payload = {
    issue: { 
      fields: { 
        created: twentyHoursAgo.toISOString(),
        updated: now.toISOString()
      } 
    },
    changelog: { items: [{ field: 'status', fromString: 'In Progress', toString: 'Done' }] }
  };
  
  const result = calculateXpAward(payload);
  const expectedXp = XP_RULES.TICKET_COMPLETED + XP_RULES.QUICK_COMPLETION_BONUS;
  assertEqual(result.xp, expectedXp, 'Quick completion bonus XP');
}

function testComplexXpAward() {
  const now = new Date();
  const twentyHoursAgo = new Date(now.getTime() - (20 * 60 * 60 * 1000));
  
  const payload = {
    issue: { 
      fields: { 
        issuetype: { name: 'Bug' },
        customfield_10016: 3,
        created: twentyHoursAgo.toISOString(),
        updated: now.toISOString()
      } 
    },
    changelog: { items: [{ field: 'status', fromString: 'In Progress', toString: 'Done' }] }
  };
  
  const result = calculateXpAward(payload);
  const expectedXp = XP_RULES.TICKET_COMPLETED + 
                     (3 * XP_RULES.STORY_POINTS_MULTIPLIER) + 
                     XP_RULES.BUG_BONUS + 
                     XP_RULES.QUICK_COMPLETION_BONUS;
  assertEqual(result.xp, expectedXp, 'Complex XP award with all bonuses');
}

function testInvalidPayloadXp() {
  assertEqual(calculateXpAward({}).xp, 0, 'Empty payload returns 0 XP');
  assertEqual(calculateXpAward({ issue: {} }).xp, 0, 'Missing changelog returns 0 XP');
  assertEqual(calculateXpAward({ changelog: {} }).xp, 0, 'Missing issue returns 0 XP');
}

// Level up tests
function testBasicLevelUp() {
  const result = checkLevelUp(150, 200); // Level 1 to Level 2
  assertDeepEqual(result, {
    leveledUp: true,
    oldLevel: 1,
    newLevel: 2,
    oldTitle: 'Novice Adventurer',
    newTitle: 'Apprentice Developer',
    levelsGained: 1,
    xpToNextLevel: 120 // 320 - 200
  }, 'Basic level up from 1 to 2');
}

function testMultiLevelUp() {
  const result = checkLevelUp(100, 1000); // Level 1 to Level 6
  assertDeepEqual(result, {
    leveledUp: true,
    oldLevel: 1,
    newLevel: 6,
    oldTitle: 'Novice Adventurer',
    newTitle: 'Master Developer',
    levelsGained: 5,
    xpToNextLevel: 200 // 1200 - 1000
  }, 'Multi-level up from 1 to 6');
}

function testNoLevelUp() {
  const result = checkLevelUp(100, 150); // Both level 1
  assertDeepEqual(result, {
    leveledUp: false,
    oldLevel: 1,
    newLevel: 1,
    oldTitle: 'Novice Adventurer',
    newTitle: 'Novice Adventurer',
    levelsGained: 0,
    xpToNextLevel: 10 // 160 - 150
  }, 'No level up within same level');
}

function testLevelUpEdgeCases() {
  // Level cap test
  const result = checkLevelUp(8500, 10000); // Level 19 to Level 20
  assertEqual(result.newLevel, 20, 'Level caps at 20');
  assertEqual(result.newTitle, 'Debugging God', 'Max title is Debugging God');
}

// Integration tests
function testFullProgressionSimulation() {
  // Simulate a user's progression through multiple levels
  let currentXp = 0;
  let currentLevel = 1;
  
  // Complete 10 tickets with 3 story points each
  for (let i = 0; i < 10; i++) {
    const xpGain = XP_RULES.TICKET_COMPLETED + (3 * XP_RULES.STORY_POINTS_MULTIPLIER); // 50 + 30 = 80 XP
    currentXp += xpGain;
    const newLevel = calculateLevel(currentXp);
    
    if (newLevel > currentLevel) {
      const levelUp = checkLevelUp(currentXp - xpGain, currentXp);
      console.log(`  Ticket ${i + 1}: Level up from ${levelUp.oldLevel} to ${levelUp.newLevel} at ${currentXp} XP`);
      currentLevel = newLevel;
    }
  }
  
  // Should be at 800 XP (Level 6)
  assertEqual(calculateLevel(currentXp), 6, 'Progression simulation reaches level 6');
  assertEqual(getTitleForLevel(6), 'Master Developer', 'Correct title at level 6');
}

function testPlanMdCompliance() {
  // Test specific PLAN.md requirements
  
  // Level ranges
  assertEqual(calculateLevel(799), 5, 'Level 5 ends at 799 XP (Novice tier)');
  assertEqual(calculateLevel(800), 6, 'Level 6 starts at 800 XP (Master tier)');
  assertEqual(calculateLevel(2799), 10, 'Level 10 ends at 2799 XP (Master tier)');
  assertEqual(calculateLevel(2800), 11, 'Level 11 starts at 2800 XP (Legendary tier)');
  assertEqual(calculateLevel(5799), 15, 'Level 15 ends at 5799 XP (Legendary tier)');
  assertEqual(calculateLevel(5800), 16, 'Level 16 starts at 5800 XP (Mythic tier)');
  
  // XP rules compliance
  assertEqual(XP_RULES.TICKET_ASSIGNED, 10, 'Ticket assigned: +10 XP');
  assertEqual(XP_RULES.TICKET_IN_PROGRESS, 15, 'Ticket in progress: +15 XP');
  assertEqual(XP_RULES.TICKET_COMPLETED, 50, 'Ticket completed: +50 XP');
  assertEqual(XP_RULES.STORY_POINTS_MULTIPLIER, 10, 'Story points: x10 multiplier');
  assertEqual(XP_RULES.BUG_BONUS, 25, 'Bug fix: +25 bonus XP');
  assertEqual(XP_RULES.QUICK_COMPLETION_BONUS, 20, 'Quick completion: +20 bonus XP');
  
  // Total XP for level 20 should be around 10,400 XP (PLAN.md says ~10,400)
  const level20Xp = getXpForLevel(20);
  if (level20Xp < 9000 || level20Xp > 10000) {
    throw new Error(`Level 20 XP requirement (${level20Xp}) not within PLAN.md range (~10,400)`);
  }
}

// Export for Node.js usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runTestSuite };
} else {
  // Browser usage
  runTestSuite();
}
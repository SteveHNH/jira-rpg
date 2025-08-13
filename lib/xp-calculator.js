// XP and Level Progression System for JIRA RPG
// Based on PLAN.md specifications

// Level progression thresholds based on PLAN.md
// Index represents level number (1-based), value is minimum XP required
const LEVEL_THRESHOLDS = [
  0,     // Index 0 - unused
  0,     // Level 1: 0 XP
  160,   // Level 2: 160 XP  
  320,   // Level 3: 320 XP (160 + 160)
  480,   // Level 4: 480 XP (320 + 160) 
  640,   // Level 5: 640 XP (480 + 160)
  800,   // Level 6: 800 XP (640 + 160) - End of Novice tier
  1200,  // Level 7: 1200 XP (800 + 400) - Start of Master tier
  1600,  // Level 8: 1600 XP (1200 + 400)
  2000,  // Level 9: 2000 XP (1600 + 400)
  2400,  // Level 10: 2400 XP (2000 + 400)
  2800,  // Level 11: 2800 XP (2400 + 400) - End of Master tier
  3400,  // Level 12: 3400 XP (2800 + 600) - Start of Legendary tier
  4000,  // Level 13: 4000 XP (3400 + 600)
  4600,  // Level 14: 4600 XP (4000 + 600)
  5200,  // Level 15: 5200 XP (4600 + 600)
  5800,  // Level 16: 5800 XP (5200 + 600) - End of Legendary tier
  6600,  // Level 17: 6600 XP (5800 + 800) - Start of Mythic tier
  7400,  // Level 18: 7400 XP (6600 + 800)
  8200,  // Level 19: 8200 XP (7400 + 800)
  9000,  // Level 20: 9000 XP (8200 + 800)
];

// Title progression based on level tiers
const TITLES = {
  1: "Novice Adventurer",      // Level 1
  2: "Apprentice Developer",   // Level 2
  3: "Junior Craftsperson",    // Level 3
  4: "Skilled Artisan",        // Level 4
  5: "Elite Specialist",       // Level 5
  6: "Master Developer",       // Level 6
  7: "Senior Master",          // Level 7
  8: "Master Craftsperson",    // Level 8
  9: "Grand Master",           // Level 9
  10: "Master Architect",      // Level 10
  11: "Legendary Coder",       // Level 11
  12: "Legendary Artisan",     // Level 12
  13: "Legendary Master",      // Level 13
  14: "Grand Legendary",       // Level 14
  15: "Legendary Architect",   // Level 15
  16: "Mythic Developer",      // Level 16
  17: "Mythic Overlord",       // Level 17
  18: "Grand Mythic",          // Level 18
  19: "Mythic Legend",         // Level 19
  20: "Debugging God"          // Level 20 - Ultimate title
};

// XP award rules from PLAN.md
const XP_RULES = {
  TICKET_ASSIGNED: 10,
  TICKET_IN_PROGRESS: 15,
  TICKET_COMPLETED: 50,
  STORY_POINTS_MULTIPLIER: 10,
  BUG_BONUS: 25,
  QUICK_COMPLETION_BONUS: 20, // < 24 hours
  CODE_REVIEW: 15,
  COMMENT_COLLABORATION: 5
};

/**
 * Calculate user level from total XP
 * @param {number} xp - Total XP accumulated
 * @returns {number} - User level (1-20)
 */
export function calculateLevel(xp) {
  if (typeof xp !== 'number' || xp < 0) {
    return 1;
  }

  for (let level = LEVEL_THRESHOLDS.length - 1; level >= 1; level--) {
    if (xp >= LEVEL_THRESHOLDS[level]) {
      return Math.min(level, 20); // Cap at level 20
    }
  }
  
  return 1; // Default to level 1
}

/**
 * Get XP required for a specific level
 * @param {number} level - Target level (1-20)
 * @returns {number} - XP required for that level
 */
export function getXpForLevel(level) {
  if (level < 1) return 0;
  if (level > 20) level = 20;
  
  return LEVEL_THRESHOLDS[level] || 0;
}

/**
 * Get XP required for next level
 * @param {number} currentLevel - Current user level
 * @returns {number} - XP required for next level (or current max if at level 20)
 */
export function getXpForNextLevel(currentLevel) {
  if (currentLevel >= 20) {
    return getXpForLevel(20);
  }
  return getXpForLevel(currentLevel + 1);
}

/**
 * Get user title based on level
 * @param {number} level - User level (1-20)
 * @returns {string} - User title/rank
 */
export function getTitleForLevel(level) {
  if (level < 1) level = 1;
  if (level > 20) level = 20;
  
  return TITLES[level] || TITLES[1];
}

/**
 * Calculate XP award based on JIRA webhook payload
 * @param {Object} payload - JIRA webhook payload
 * @returns {Object} - XP award details
 */
export function calculateXpAward(payload) {
  const { issue, changelog, webhookEvent } = payload;
  if (!issue) {
    return { xp: 0, reason: 'Invalid payload - no issue data' };
  }

  const fields = issue.fields || {};
  const currentStatus = fields.status?.name;
  let fromStatus = null;
  let toStatus = currentStatus;

  // Try to get status change from changelog first
  const statusChange = changelog?.items?.find(item => item.field === 'status');
  if (statusChange) {
    fromStatus = statusChange.fromString;
    toStatus = statusChange.toString;
  } else {
    // Fallback: If no changelog, still award XP based on current status and webhook event
    console.log('No changelog found, using current status:', currentStatus, 'for event:', webhookEvent);
    
    if (webhookEvent === 'jira:issue_created' && fields.assignee) {
      // New issue with assignee
      toStatus = currentStatus || 'To Do';
    } else if (currentStatus) {
      // For other events, assume status transition based on current status
      toStatus = currentStatus;
      if (currentStatus === 'In Progress') fromStatus = 'To Do';
      if (currentStatus === 'Done' || currentStatus === 'Closed') fromStatus = 'In Progress';
    }
  }
  const issueType = fields.issuetype?.name?.toLowerCase() || '';
  const storyPoints = fields.customfield_10016 || fields.story_points || 0;
  
  let xpAwarded = 0;
  let reasons = [];

  // Base XP based on status transition
  if (toStatus === 'In Progress' && fromStatus !== 'In Progress') {
    xpAwarded += XP_RULES.TICKET_IN_PROGRESS;
    reasons.push(`Ticket moved to In Progress (+${XP_RULES.TICKET_IN_PROGRESS} XP)`);
  } else if ((toStatus === 'Done' || toStatus === 'Closed' || toStatus === 'Resolved') && 
             fromStatus !== toStatus) {
    xpAwarded += XP_RULES.TICKET_COMPLETED;
    reasons.push(`Ticket completed (+${XP_RULES.TICKET_COMPLETED} XP)`);
    
    // Story points bonus for completed tickets
    if (storyPoints > 0) {
      const storyPointBonus = storyPoints * XP_RULES.STORY_POINTS_MULTIPLIER;
      xpAwarded += storyPointBonus;
      reasons.push(`Story points bonus (+${storyPointBonus} XP for ${storyPoints} points)`);
    }
  } else if (fields.assignee && (fromStatus === 'To Do' || !fromStatus)) {
    xpAwarded += XP_RULES.TICKET_ASSIGNED;
    reasons.push(`Ticket assigned (+${XP_RULES.TICKET_ASSIGNED} XP)`);
  }

  // Fallback: Award minimal XP for any webhook activity if no specific XP was awarded
  if (xpAwarded === 0 && toStatus) {
    xpAwarded = 5; // Minimal XP for any activity
    reasons.push(`Webhook activity (+5 XP for ${webhookEvent || 'status update'})`);
  }

  // Bug fix bonus
  if (issueType.includes('bug') && (toStatus === 'Done' || toStatus === 'Closed' || toStatus === 'Resolved')) {
    xpAwarded += XP_RULES.BUG_BONUS;
    reasons.push(`Bug fix bonus (+${XP_RULES.BUG_BONUS} XP)`);
  }

  // Quick completion bonus (< 24 hours)
  if ((toStatus === 'Done' || toStatus === 'Closed' || toStatus === 'Resolved') && 
      fields.created && fields.updated) {
    const created = new Date(fields.created);
    const updated = new Date(fields.updated);
    const hoursElapsed = (updated - created) / (1000 * 60 * 60);
    
    if (hoursElapsed < 24) {
      xpAwarded += XP_RULES.QUICK_COMPLETION_BONUS;
      reasons.push(`Quick completion bonus (+${XP_RULES.QUICK_COMPLETION_BONUS} XP, completed in ${Math.round(hoursElapsed)} hours)`);
    }
  }

  return {
    xp: xpAwarded,
    reason: reasons.join(', ') || 'No XP awarded',
    breakdown: {
      baseXp: xpAwarded - (storyPoints * XP_RULES.STORY_POINTS_MULTIPLIER || 0) - 
              (issueType.includes('bug') && (toStatus === 'Done' || toStatus === 'Closed' || toStatus === 'Resolved') ? XP_RULES.BUG_BONUS : 0),
      storyPointsBonus: storyPoints * XP_RULES.STORY_POINTS_MULTIPLIER || 0,
      bugBonus: issueType.includes('bug') && (toStatus === 'Done' || toStatus === 'Closed' || toStatus === 'Resolved') ? XP_RULES.BUG_BONUS : 0,
      quickCompletionBonus: 0 // Will be calculated above if applicable
    },
    details: {
      fromStatus,
      toStatus,
      issueType,
      storyPoints,
      webhookEvent,
      hasChangelog: !!changelog,
      changelogItems: changelog?.items?.length || 0
    }
  };
}

/**
 * Check if user leveled up after XP gain
 * @param {number} oldXp - Previous XP total
 * @param {number} newXp - New XP total after gain
 * @returns {Object} - Level up information
 */
export function checkLevelUp(oldXp, newXp) {
  const oldLevel = calculateLevel(oldXp);
  const newLevel = calculateLevel(newXp);
  
  const leveledUp = newLevel > oldLevel;
  
  const currentLevelXp = getXpForLevel(newLevel);
  const nextLevelXp = getXpForNextLevel(newLevel);
  const progressInLevel = newXp - currentLevelXp;
  const xpNeededForNextLevel = nextLevelXp - newXp;
  
  return {
    leveledUp,
    oldLevel,
    newLevel,
    oldTitle: getTitleForLevel(oldLevel),
    newTitle: getTitleForLevel(newLevel),
    levelsGained: newLevel - oldLevel,
    xpToNextLevel: xpNeededForNextLevel,
    progressInLevel: progressInLevel,
    xpForCurrentLevel: currentLevelXp,
    xpForNextLevel: nextLevelXp
  };
}

export { XP_RULES, LEVEL_THRESHOLDS, TITLES };
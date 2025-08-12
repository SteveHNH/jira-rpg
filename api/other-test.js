// api/test.js - Test endpoint for development

import { testStoryGeneration, checkOllamaHealth, extractGuildInfo } from '../lib/story-generator.js';

export default async function handler(req, res) {
  const { test } = req.query;
  
  try {
    switch (test) {
      case 'health':
        console.log('Testing Ollama health...');
        const health = await checkOllamaHealth();
        return res.json({ test: 'health', result: health });
        
      case 'story':
        console.log('Testing story generation...');
        const story = await testStoryGeneration();
        return res.json({ test: 'story', result: story });
        
      case 'guild':
        console.log('Testing guild extraction...');
        const testIssue = {
          key: "FRONTEND-123",
          fields: {
            project: { key: "FRONTEND", name: "Frontend Project" },
            components: [{ name: "UI" }, { name: "Mobile" }],
            labels: ["urgent", "mobile"],
            assignee: { displayName: "Sarah Johnson" },
            summary: "Fix mobile login button"
          }
        };
        const guildInfo = extractGuildInfo(testIssue);
        return res.json({ test: 'guild', result: guildInfo });
        
      case 'full':
        console.log('Running full test suite...');
        const [healthResult, storyResult] = await Promise.all([
          checkOllamaHealth(),
          testStoryGeneration()
        ]);
        
        return res.json({
          test: 'full',
          results: {
            health: healthResult,
            story: storyResult,
            timestamp: new Date().toISOString()
          }
        });
        
      default:
        return res.json({
          message: 'Test endpoint - use ?test=health|story|guild|full',
          availableTests: ['health', 'story', 'guild', 'full']
        });
    }
    
  } catch (error) {
    console.error('Test error:', error);
    return res.status(500).json({
      error: 'Test failed',
      message: error.message,
      stack: error.stack
    });
  }
}

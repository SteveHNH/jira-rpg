// RequestBin debug utility for JIRA RPG system

const REQUEST_BIN_URL = 'https://eod4tmlsrs55sol.m.pipedream.net';

/**
 * Send data to RequestBin for debugging
 * @param {any} data - The data to send
 * @param {string} source - Source identifier (e.g., 'webhook-processing', 'story-generation')
 */
export async function debugLog(data, source = 'debug') {
  try {
    await fetch(REQUEST_BIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Source': `jira-rpg-${source}`
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        source,
        data
      })
    });
  } catch (error) {
    console.error('RequestBin debug failed:', error.message);
  }
}

export { REQUEST_BIN_URL };
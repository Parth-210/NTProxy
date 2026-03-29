const crypto = require('crypto');

/**
 * Generate an HMAC-based token for a session.
 * Tokens are tied to 5-second time windows for rotation.
 * 
 * token = HMAC(session_id + timestamp_window, secret_key)
 */
function generateToken(sessionId, secret) {
  const windowTimestamp = Math.floor(Date.now() / 5000); // 5-second windows
  const data = `${sessionId}:${windowTimestamp}`;
  const token = crypto.createHmac('sha256', secret).update(data).digest('hex').substring(0, 24);
  return token;
}

/**
 * Validate a token against the current and recent time windows.
 * Allows a grace period of 30 seconds (6 windows) to handle:
 * - Network delays
 * - Login redirect flow (student not logged in when scanning)
 */
function validateToken(sessionId, token, secret) {
  const now = Math.floor(Date.now() / 5000);
  
  // Check current window and last 6 windows (30 seconds grace)
  for (let i = 0; i <= 6; i++) {
    const windowTimestamp = now - i;
    const data = `${sessionId}:${windowTimestamp}`;
    const expectedToken = crypto.createHmac('sha256', secret).update(data).digest('hex').substring(0, 24);
    if (token === expectedToken) return true;
  }
  
  return false;
}

module.exports = { generateToken, validateToken };

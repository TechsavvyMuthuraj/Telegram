// =============================================================================
// techiemuthuraj Files - Rate Limiting Middleware
// Protects token verification and download endpoints against brute force
// =============================================================================

// In-memory bucket store for serverless instance lifetime
const ipBuckets = new Map();

/**
 * Check if a client IP has exceeded the allowed rate
 * @param {string} ipIdentifier - Client IP hash or identifier
 * @param {number} maxRequests - Maximum requests allowed in the window
 * @param {number} windowSeconds - Sliding window duration in seconds
 * @returns {{ allowed: boolean, remaining: number, resetSeconds: number }}
 */
function checkRateLimit(ipIdentifier, maxRequests = 10, windowSeconds = 60) {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  
  // Cleanup stale buckets periodically (every 5 minutes)
  if (Math.random() < 0.05) {
    for (const [key, data] of ipBuckets.entries()) {
      if (now - data.startTime > windowMs * 2) {
        ipBuckets.delete(key);
      }
    }
  }

  const clientData = ipBuckets.get(ipIdentifier) || { count: 0, startTime: now };

  if (now - clientData.startTime > windowMs) {
    // Window expired, reset
    clientData.count = 1;
    clientData.startTime = now;
    ipBuckets.set(ipIdentifier, clientData);
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetSeconds: windowSeconds
    };
  }

  clientData.count += 1;
  ipBuckets.set(ipIdentifier, clientData);

  const resetSeconds = Math.ceil((clientData.startTime + windowMs - now) / 1000);
  const remaining = Math.max(0, maxRequests - clientData.count);

  return {
    allowed: clientData.count <= maxRequests,
    remaining,
    resetSeconds
  };
}

module.exports = {
  checkRateLimit
};

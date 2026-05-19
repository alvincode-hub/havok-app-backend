const DASHBOARD_PAYLOAD_TTL_MS = 60 * 1000;

let cachedPayload = null;
let cachedAt = 0;

function getCachedDashboardPayload() {
  if (!cachedPayload) {
    return null;
  }

  if (Date.now() - cachedAt > DASHBOARD_PAYLOAD_TTL_MS) {
    cachedPayload = null;
    cachedAt = 0;
    return null;
  }

  return cachedPayload;
}

function setCachedDashboardPayload(payload) {
  cachedPayload = payload;
  cachedAt = Date.now();
  return payload;
}

function invalidateDashboardPayloadCache() {
  cachedPayload = null;
  cachedAt = 0;
}

module.exports = {
  DASHBOARD_PAYLOAD_TTL_MS,
  getCachedDashboardPayload,
  setCachedDashboardPayload,
  invalidateDashboardPayloadCache
};

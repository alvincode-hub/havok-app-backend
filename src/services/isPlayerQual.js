const { loadNormalizedData } = require("../storage/normalizedStore.js");
const { normalizedPlayerPath } = require("../storage/paths.js");

async function isPlayerQual(playerId, eventWindow) {
  if (!playerId || !eventWindow) {
    return false;
  }

  if (!requiresQualificationLookup(eventWindow)) {
    return true;
  }

  const playerData = await loadNormalizedData(normalizedPlayerPath(playerId));
  return doesPlayerQualifyForWindow(playerData?.tokens || [], eventWindow);
}

function doesPlayerQualifyForWindow(playerTokens = [], eventWindow = {}) {
  const normalizedPlayerTokens = Array.isArray(playerTokens) ? playerTokens : [];
  const requiredTokens = eventWindow.requiredTokens || [];
  const anyRequiredTokens = eventWindow.anyRequiredTokens || [];
  const blockedTokens = eventWindow.blockedTokens || [];

  const hasAllRequiredTokens = requiredTokens.every((token) => {
    return normalizedPlayerTokens.includes(token);
  });

  const hasAnyRequiredToken =
    anyRequiredTokens.length === 0 ||
    anyRequiredTokens.some((token) => {
      return normalizedPlayerTokens.includes(token);
    });

  const hasBlockedToken = blockedTokens.some((token) => {
    return normalizedPlayerTokens.includes(token);
  });

  return hasAllRequiredTokens && hasAnyRequiredToken && !hasBlockedToken;
}

function requiresQualificationLookup(eventWindow = {}) {
  const requiredTokens = eventWindow.requiredTokens || [];
  const anyRequiredTokens = eventWindow.anyRequiredTokens || [];
  const blockedTokens = eventWindow.blockedTokens || [];

  return (
    requiredTokens.length > 0 ||
    anyRequiredTokens.length > 0 ||
    blockedTokens.length > 0
  );
}

module.exports = {
  isPlayerQual,
  doesPlayerQualifyForWindow,
  requiresQualificationLookup
};

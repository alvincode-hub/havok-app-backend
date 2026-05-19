const { loadNormalizedData } = require("../storage/normalizedStore.js");
const { normalizedPlayerPath } = require("../storage/paths.js");

async function isPlayerQual(playerId, eventWindow) {
  const playerData = await loadNormalizedData(normalizedPlayerPath(playerId));

  const playerTokens = playerData?.tokens || [];

  const requiredTokens = eventWindow.requiredTokens || [];
  const anyRequiredTokens = eventWindow.anyRequiredTokens || [];
  const blockedTokens = eventWindow.blockedTokens || [];

  const hasAllRequiredTokens = requiredTokens.every((token) => {
    return playerTokens.includes(token);
  });

  const hasAnyRequiredToken =
    anyRequiredTokens.length === 0 ||
    anyRequiredTokens.some((token) => {
      return playerTokens.includes(token);
    });

  const hasBlockedToken = blockedTokens.some((token) => {
    return playerTokens.includes(token);
  });

  return hasAllRequiredTokens && hasAnyRequiredToken && !hasBlockedToken;
}

module.exports = { isPlayerQual };

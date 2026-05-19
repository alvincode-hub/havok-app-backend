const {
  findPlayerResultInLocation,
  loadTrackedPlayerIds
} = require("./leaderboardIndex.service.js");
const { isPlayerQual } = require("../services/isPlayerQual.js");

async function findPlayerTop(playerId, tournamentWindow) {
  if (!playerId || !tournamentWindow) {
    return null;
  }

  const trackedPlayerIds = await loadTrackedPlayerIds();

  if (!trackedPlayerIds.includes(playerId)) {
    return null;
  }

  if (!(await isPlayerQual(playerId, tournamentWindow))) {
    return null;
  }

  const resolvedLocation = getMainResolvedLocation(tournamentWindow);

  if (!resolvedLocation) {
    return null;
  }

  return findPlayerResultInLocation(resolvedLocation, playerId);
}

function getMainResolvedLocation(window) {
  if (window?.resolvedLocation) {
    return window.resolvedLocation;
  }

  const scoreLocations = window?.scoreLocations || [];
  const resolvedLocations = window?.resolvedLocations || [];
  const mainLeaderboardIndex = scoreLocations.findIndex((location) => {
    return location?.isMainWindowLeaderboard === true;
  });

  if (mainLeaderboardIndex !== -1 && resolvedLocations[mainLeaderboardIndex]) {
    return resolvedLocations[mainLeaderboardIndex];
  }

  return resolvedLocations[0] || null;
}

module.exports = { findPlayerTop };

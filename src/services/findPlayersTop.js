const {
  findPlayerResultInLocation
} = require("./leaderboardIndex.service.js");

async function findPlayerTop(playerId, tournamentWindow) {
  const resolvedLocation = getMainResolvedLocation(tournamentWindow);

  if (!resolvedLocation || !playerId) {
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

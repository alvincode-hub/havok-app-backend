const {
  findPlayersResultInLocation,
  loadTrackedPlayerIds
} = require("./leaderboardIndex.service.js");
const { loadNormalizedData } = require("../storage/normalizedStore.js");
const { normalizedPlayerPath } = require("../storage/paths.js");
const {
  doesPlayerQualifyForWindow,
  requiresQualificationLookup
} = require("./isPlayerQual.js");

async function findPlayerTop(playerId, tournamentWindow) {
  const [playerResult] = await findPlayersTop([playerId], tournamentWindow);

  return playerResult || null;
}

async function findPlayersTop(playerIds, tournamentWindow) {
  if (!Array.isArray(playerIds)) {
    return [];
  }

  if (playerIds.length === 0 || !tournamentWindow) {
    return playerIds.map(() => null);
  }

  const resolvedLocation = getMainResolvedLocation(tournamentWindow);

  if (!resolvedLocation) {
    return playerIds.map(() => null);
  }

  const uniqueRequestedPlayerIds = [...new Set(playerIds.filter(Boolean))];

  if (uniqueRequestedPlayerIds.length === 0) {
    return playerIds.map(() => null);
  }

  const trackedPlayerIdSet = new Set(await loadTrackedPlayerIds());
  const trackedRequestedPlayerIds = uniqueRequestedPlayerIds.filter((playerId) => {
    return trackedPlayerIdSet.has(playerId);
  });

  if (trackedRequestedPlayerIds.length === 0) {
    return playerIds.map(() => null);
  }

  const qualifiedPlayerIdSet = await resolveQualifiedPlayerIdSet(
    trackedRequestedPlayerIds,
    tournamentWindow
  );

  if (qualifiedPlayerIdSet.size === 0) {
    return playerIds.map(() => null);
  }

  const qualifiedPlayerIds = trackedRequestedPlayerIds.filter((playerId) => {
    return qualifiedPlayerIdSet.has(playerId);
  });
  const qualifiedResults = await findPlayersResultInLocation(
    resolvedLocation,
    qualifiedPlayerIds
  );
  const resultsByPlayerId = new Map();

  qualifiedPlayerIds.forEach((playerId, index) => {
    resultsByPlayerId.set(playerId, qualifiedResults[index] || null);
  });

  return playerIds.map((playerId) => {
    if (!playerId || !qualifiedPlayerIdSet.has(playerId)) {
      return null;
    }

    return resultsByPlayerId.get(playerId) || null;
  });
}

async function resolveQualifiedPlayerIdSet(playerIds, tournamentWindow) {
  if (playerIds.length === 0) {
    return new Set();
  }

  if (!requiresQualificationLookup(tournamentWindow)) {
    return new Set(playerIds);
  }

  const qualificationEntries = await Promise.all(playerIds.map(async (playerId) => {
    return [playerId, await isPlayerQualForWindow(playerId, tournamentWindow)];
  }));

  return new Set(
    qualificationEntries
      .filter(([, isQualified]) => isQualified)
      .map(([playerId]) => playerId)
  );
}

async function isPlayerQualForWindow(playerId, tournamentWindow) {
  if (!playerId || !tournamentWindow) {
    return false;
  }

  const playerData = await loadNormalizedData(normalizedPlayerPath(playerId));
  return doesPlayerQualifyForWindow(playerData?.tokens || [], tournamentWindow);
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

module.exports = { findPlayerTop, findPlayersTop };

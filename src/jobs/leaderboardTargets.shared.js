const LIVE_LEADERBOARD_TTL_MS = 60 * 1000;
const RECENT_FINISHED_LEADERBOARD_TTL_MS = 15 * 60 * 1000;
const ARCHIVED_FINISHED_LEADERBOARD_TTL_MS = 6 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function getUniqueResolvedLocations(window) {
  const resolvedLocations = [];

  if (window?.resolvedLocation) {
    resolvedLocations.push(window.resolvedLocation);
  }

  for (const resolvedLocation of window?.resolvedLocations || []) {
    if (resolvedLocation) {
      resolvedLocations.push(resolvedLocation);
    }
  }

  return [...new Set(resolvedLocations)];
}

function getFinishedLeaderboardTtlMs(windowEndDate) {
  const endTime = new Date(windowEndDate).getTime();

  if (Number.isNaN(endTime)) {
    return ARCHIVED_FINISHED_LEADERBOARD_TTL_MS;
  }

  return Date.now() - endTime <= ONE_DAY_MS
    ? RECENT_FINISHED_LEADERBOARD_TTL_MS
    : ARCHIVED_FINISHED_LEADERBOARD_TTL_MS;
}

function buildLeaderboardRequestOptions(window, mode) {
  if (mode === "live") {
    return {
      freshnessTtlMs: LIVE_LEADERBOARD_TTL_MS,
      cooldownKind: "live"
    };
  }

  return {
    freshnessTtlMs: getFinishedLeaderboardTtlMs(window?.end),
    cooldownKind: "finished"
  };
}

module.exports = {
  LIVE_LEADERBOARD_TTL_MS,
  RECENT_FINISHED_LEADERBOARD_TTL_MS,
  ARCHIVED_FINISHED_LEADERBOARD_TTL_MS,
  getUniqueResolvedLocations,
  buildLeaderboardRequestOptions
};

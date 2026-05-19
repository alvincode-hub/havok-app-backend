const { getLeaderboard } = require("../fnbr/tournaments.js");
const {
  loadNormalizedData,
  saveNormalizedData
} = require("../storage/normalizedStore.js");
const { saveRawData } = require("../storage/rawStore.js");
const {
  rawTournamentResultsPath,
  normalizedTournamentResultsPath
} = require("../storage/paths.js");
const { normalizeTournamentsResults } = require("../normalizers/normalize.tournaments.results.js");
const {
  rebuildLeaderboardPlayerIndex,
  invalidateLeaderboardPlayerIndex
} = require("../services/leaderboardIndex.service.js");
const {
  getRequestDecision,
  markRequestSuccess,
  markRequestForbidden
} = require("../services/requestState.service.js");
const { formatRequestLog } = require("../utils/requestLog.js");
const { logDebug, logInfo, logWarning } = require("../utils/logger.js");

const FORBIDDEN_LOG_TTL_MS = 60 * 60 * 1000;
const forbiddenWindowLogTimes = new Map();

async function updateLeaderboardWindow(resolvedLocation, source, options = {}) {
  const startedAt = Date.now();
  const cachedPage = await loadNormalizedData(
    normalizedTournamentResultsPath(resolvedLocation, 0)
  );
  const requestDecision = await getRequestDecision(resolvedLocation, options);

  if (requestDecision.blocked && (cachedPage || requestDecision.reason === "forbidden_cooldown")) {
    logInfo(
      formatRequestLog({
        service: "Epic",
        operation: "leaderboard.refresh",
        key: resolvedLocation,
        source,
        status: "cooldown",
        cacheHit: Boolean(cachedPage),
        cooldownApplied: true,
        durationMs: Date.now() - startedAt,
        reason: requestDecision.reason,
        cooldownUntil: requestDecision.cooldownUntil
      }),
      source
    );

    return {
      status: "cooldown",
      pagesSaved: 0,
      cacheUsed: Boolean(cachedPage),
      reason: requestDecision.reason
    };
  }

  const firstPage = await saveLeaderboardPageSafely(resolvedLocation, 0, source, startedAt);

  if (firstPage.status === "forbidden") {
    await markRequestForbidden(resolvedLocation, {
      source,
      reason: firstPage.reason,
      cooldownKind: options.cooldownKind,
      freshnessTtlMs: options.freshnessTtlMs
    });

    return {
      status: "forbidden",
      pagesSaved: 0,
      cacheUsed: Boolean(cachedPage),
      reason: firstPage.reason || "forbidden"
    };
  }

  if (firstPage.status === "failed") {
    return {
      status: "failed",
      pagesSaved: 0,
      cacheUsed: Boolean(cachedPage),
      reason: firstPage.error?.message || "failed"
    };
  }

  await markRequestSuccess(resolvedLocation, {
    source,
    freshnessTtlMs: options.freshnessTtlMs
  });
  await invalidateLeaderboardPlayerIndex(resolvedLocation);
  await rebuildLeaderboardPlayerIndex(resolvedLocation);

  return {
    status: "ok",
    pagesSaved: 1,
    cacheUsed: false,
    reason: null
  };
}

async function saveLeaderboardPageSafely(resolvedLocation, page, source, startedAt) {
  try {
    const rawResults = await getLeaderboard(resolvedLocation, page);
    const rawPath = rawTournamentResultsPath(resolvedLocation, page);
    const normalizedPath = normalizedTournamentResultsPath(resolvedLocation, page);

    await saveRawData(rawResults, rawPath);

    const cleanResults = await normalizeTournamentsResults(rawResults, rawResults);
    await saveNormalizedData(cleanResults, normalizedPath);

    logDebug(`Resultats normalises ${normalizedPath}`, source);
    logInfo(
      formatRequestLog({
        service: "Epic",
        operation: "leaderboard.refresh",
        key: `${resolvedLocation}:page_${page}`,
        source,
        status: "ok",
        cacheHit: false,
        cooldownApplied: false,
        durationMs: Date.now() - startedAt
      }),
      source
    );

    return {
      status: "ok",
      rawResults
    };
  } catch (error) {
    if (isHttpStatus(error, 403)) {
      maybeLogForbiddenWindow(resolvedLocation, page, source);
      logInfo(
        formatRequestLog({
          service: "Epic",
          operation: "leaderboard.refresh",
          key: `${resolvedLocation}:page_${page}`,
          source,
          status: "forbidden",
          cacheHit: false,
          cooldownApplied: true,
          durationMs: Date.now() - startedAt,
          reason: "http_403"
        }),
        source
      );
      return {
        status: "forbidden",
        error,
        reason: "http_403"
      };
    }

    logWarning(
      formatRequestLog({
        service: "Epic",
        operation: "leaderboard.refresh",
        key: `${resolvedLocation}:page_${page}`,
        source,
        status: "failed",
        cacheHit: false,
        cooldownApplied: false,
        durationMs: Date.now() - startedAt,
        reason: error?.message || "unknown"
      }),
      source
    );

    return {
      status: "failed",
      error
    };
  }
}

function maybeLogForbiddenWindow(resolvedLocation, page, source) {
  const now = Date.now();
  const key = `${source}:${resolvedLocation}`;
  const lastLogTime = forbiddenWindowLogTimes.get(key) || 0;

  if (now - lastLogTime < FORBIDDEN_LOG_TTL_MS) {
    return;
  }

  forbiddenWindowLogTimes.set(key, now);
  logWarning(`Leaderboard refuse (403) ${resolvedLocation} page=${page}`, source);
}

function isHttpStatus(error, statusCode) {
  return Number(error?.response?.status) === statusCode;
}

module.exports = {
  updateLeaderboardWindow
};

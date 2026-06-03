const fs = require("fs-extra");
const path = require("path");
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
  invalidateLeaderboardPlayerIndex,
  loadTrackedPlayerIds
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
    normalizedTournamentResultsPath(resolvedLocation, 0),
    { silentMissing: true }
  );
  const requestDecision = await getRequestDecision(resolvedLocation, options);
  const usedFreshCache = requestDecision.reason === "fresh_cache";

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
        usedFreshCache,
        durationMs: Date.now() - startedAt,
        reason: requestDecision.reason,
        cooldownUntil: requestDecision.cooldownUntil
      }),
      source
    );

    return {
      status: "cooldown",
      pagesSaved: 0,
      usedFreshCache,
      dataChanged: false,
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
      usedFreshCache: false,
      dataChanged: false,
      cacheUsed: Boolean(cachedPage),
      reason: firstPage.reason || "forbidden"
    };
  }

  if (firstPage.status === "failed") {
    return {
      status: "failed",
      pagesSaved: 0,
      usedFreshCache: false,
      dataChanged: false,
      cacheUsed: Boolean(cachedPage),
      reason: firstPage.error?.message || "failed"
    };
  }

  const trackedPlayerIds = await loadTrackedPlayerIds();
  const pageNumbersSaved = [0];
  const totalPages = getTotalPagesFromLeaderboard(firstPage);
  const foundTrackedPlayers = collectTrackedPlayerIds(firstPage.cleanResults, trackedPlayerIds);
  let dataChanged = Boolean(firstPage.dataChanged);

  for (
    let page = 1;
    page < totalPages && foundTrackedPlayers.size < trackedPlayerIds.length;
    page += 1
  ) {
    const nextPage = await saveLeaderboardPageSafely(resolvedLocation, page, source, startedAt);

    if (nextPage.status !== "ok") {
      break;
    }

    pageNumbersSaved.push(page);
    dataChanged = dataChanged || Boolean(nextPage.dataChanged);

    for (const accountId of collectTrackedPlayerIds(nextPage.cleanResults, trackedPlayerIds)) {
      foundTrackedPlayers.add(accountId);
    }
  }

  await markRequestSuccess(resolvedLocation, {
    source,
    freshnessTtlMs: options.freshnessTtlMs
  });
  await invalidateLeaderboardPlayerIndex(resolvedLocation);
  await rebuildLeaderboardPlayerIndex(resolvedLocation, {
    pageNumbers: pageNumbersSaved
  });

  return {
    status: "ok",
    pagesSaved: pageNumbersSaved.length,
    usedFreshCache: false,
    dataChanged,
    cacheUsed: false,
    reason: null
  };
}

async function saveLeaderboardPageSafely(resolvedLocation, page, source, startedAt) {
  try {
    const rawResults = await getLeaderboard(resolvedLocation, page);
    const rawPath = rawTournamentResultsPath(resolvedLocation, page);
    const normalizedPath = normalizedTournamentResultsPath(resolvedLocation, page);
    const previousResults = await loadStoredNormalizedPage(resolvedLocation, page);

    await saveRawData(rawResults, rawPath);

    const cleanResults = await normalizeTournamentsResults(rawResults, rawResults);
    const dataChanged = hasSerializedDataChanged(previousResults, cleanResults);
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
        dataChanged,
        durationMs: Date.now() - startedAt
      }),
      source
    );

    return {
      status: "ok",
      rawResults,
      cleanResults,
      dataChanged
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

function getTotalPagesFromLeaderboard(savedPage) {
  const rawTotalPages = Number(savedPage?.rawResults?.totalPages);
  const normalizedTotalPages = Number(savedPage?.cleanResults?.totalPages);

  if (Number.isInteger(rawTotalPages) && rawTotalPages > 0) {
    return rawTotalPages;
  }

  if (Number.isInteger(normalizedTotalPages) && normalizedTotalPages > 0) {
    return normalizedTotalPages;
  }

  return 1;
}

function collectTrackedPlayerIds(resultsPage, trackedPlayerIds) {
  if (!Array.isArray(resultsPage?.results) || trackedPlayerIds.length === 0) {
    return new Set();
  }

  const trackedPlayerIdSet = new Set(trackedPlayerIds);
  const foundTrackedPlayers = new Set();

  for (const entry of resultsPage.results) {
    for (const accountId of entry?.accountIds || []) {
      if (trackedPlayerIdSet.has(accountId)) {
        foundTrackedPlayers.add(accountId);
      }
    }
  }

  return foundTrackedPlayers;
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

function hasSerializedDataChanged(previousValue, nextValue) {
  return JSON.stringify(previousValue ?? null) !== JSON.stringify(nextValue ?? null);
}

async function loadStoredNormalizedPage(resolvedLocation, page) {
  const absoluteFilePath = toDataAbsolutePath(
    normalizedTournamentResultsPath(resolvedLocation, page)
  );

  if (!(await fs.pathExists(absoluteFilePath))) {
    return null;
  }

  return loadNormalizedData(normalizedTournamentResultsPath(resolvedLocation, page));
}

function toDataAbsolutePath(relativePath) {
  return path.join(__dirname, "../../data", relativePath);
}

module.exports = {
  updateLeaderboardWindow
};

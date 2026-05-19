const fs = require("fs-extra");
const path = require("path");

const {
  normalizedTournamentResultsDirPath,
  normalizedTournamentResultsPath,
  normalizedTournamentResultsPlayerIndexPath,
  normalizedTournamentResultsTrackedPlayerIndexPath
} = require("../storage/paths.js");
const {
  loadNormalizedData,
  saveNormalizedData
} = require("../storage/normalizedStore.js");
const { loadConfigData } = require("../storage/configStore.js");
const { logDebug } = require("../utils/logger.js");

const TEAM_CONFIG_PATH = "config/team.json";

async function findPlayerResultInLocation(resolvedLocation, playerId) {
  if (!resolvedLocation || !playerId) {
    return null;
  }

  const indexPath = normalizedTournamentResultsTrackedPlayerIndexPath(resolvedLocation);
  const indexAbsolutePath = toDataAbsolutePath(indexPath);

  if (!(await fs.pathExists(indexAbsolutePath))) {
    return null;
  }

  const cachedIndex = await loadNormalizedData(indexPath);

  if (!isObject(cachedIndex?.players)) {
    return null;
  }

  return cachedIndex.players[playerId] || null;
}

async function rebuildLeaderboardPlayerIndex(resolvedLocation, options = {}) {
  const pageNumbers = normalizePageNumbers(options.pageNumbers);

  return buildTrackedLeaderboardPlayerIndex(
    resolvedLocation,
    pageNumbers.length > 0 ? pageNumbers : null
  );
}

async function invalidateLeaderboardPlayerIndex(resolvedLocation) {
  const candidatePaths = [
    normalizedTournamentResultsTrackedPlayerIndexPath(resolvedLocation),
    normalizedTournamentResultsPlayerIndexPath(resolvedLocation)
  ];

  for (const candidatePath of candidatePaths) {
    const absolutePath = toDataAbsolutePath(candidatePath);

    if (await fs.pathExists(absolutePath)) {
      await fs.remove(absolutePath);
    }
  }
}

async function loadTrackedPlayerIds() {
  const playerConfig = await loadConfigData(TEAM_CONFIG_PATH);

  return [...new Set(
    (playerConfig?.players || [])
      .map((player) => player?.accountId)
      .filter(Boolean)
  )];
}

async function buildTrackedLeaderboardPlayerIndex(resolvedLocation, providedPageNumbers = null) {
  const pageNumbers = providedPageNumbers || await resolveLeaderboardPageNumbers(resolvedLocation);

  if (pageNumbers.length === 0) {
    return null;
  }

  const trackedPlayerIds = await loadTrackedPlayerIds();
  const trackedPlayerIdSet = new Set(trackedPlayerIds);
  const players = {};
  let pagesLoaded = 0;

  for (const pageNumber of pageNumbers) {
    const results = await loadNormalizedData(
      normalizedTournamentResultsPath(resolvedLocation, pageNumber)
    );

    if (!isObject(results) || !Array.isArray(results.results)) {
      continue;
    }

    pagesLoaded += 1;

    for (const entry of results.results) {
      const entryAccountIds = Array.isArray(entry.accountIds) ? entry.accountIds : [];
      const matchingAccountIds = entryAccountIds.filter((accountId) => {
        return accountId && trackedPlayerIdSet.has(accountId);
      });

      if (matchingAccountIds.length === 0) {
        continue;
      }

      const summary = summarizeTrackedPlayerEntry(entry);

      for (const accountId of matchingAccountIds) {
        if (!players[accountId]) {
          players[accountId] = summary;
        }
      }
    }
  }

  const payload = {
    resolvedLocation,
    pagesLoaded,
    trackedPlayersCount: trackedPlayerIds.length,
    trackedPlayersFound: Object.keys(players).length,
    players
  };

  await saveNormalizedData(
    payload,
    normalizedTournamentResultsTrackedPlayerIndexPath(resolvedLocation)
  );

  logDebug(
    `Index tracked reconstruit ${resolvedLocation} pages=${pagesLoaded} tracked=${payload.trackedPlayersFound}/${payload.trackedPlayersCount}`,
    "LeaderboardIndex"
  );

  return payload;
}

async function resolveLeaderboardPageNumbers(resolvedLocation) {
  const pageNumbers = new Set();
  const firstPagePath = normalizedTournamentResultsPath(resolvedLocation, 0);
  const firstPageAbsolutePath = toDataAbsolutePath(firstPagePath);

  if (!(await fs.pathExists(firstPageAbsolutePath))) {
    return [];
  }

  const firstPage = await loadNormalizedData(firstPagePath);

  if (
    isObject(firstPage) &&
    typeof firstPage.totalPages === "number" &&
    firstPage.totalPages > 0
  ) {
    for (let page = 0; page < firstPage.totalPages; page += 1) {
      const pagePath = toDataAbsolutePath(
        normalizedTournamentResultsPath(resolvedLocation, page)
      );

      if (await fs.pathExists(pagePath)) {
        pageNumbers.add(page);
      }
    }
  }

  const directoryPath = toDataAbsolutePath(
    normalizedTournamentResultsDirPath(resolvedLocation)
  );

  if (await fs.pathExists(directoryPath)) {
    const files = await fs.readdir(directoryPath);

    for (const fileName of files) {
      const match = fileName.match(/^page_(\d+)\.json$/);

      if (match) {
        pageNumbers.add(Number(match[1]));
      }
    }
  }

  return [...pageNumbers].sort((left, right) => left - right);
}

function summarizeTrackedPlayerEntry(entry) {
  return {
    rank: entry?.rank ?? null,
    points: entry?.points ?? 0,
    kills: entry?.kills ?? 0,
    top15s: entry?.top15s ?? 0,
    top5s: entry?.top5s ?? 0,
    wins: entry?.wins ?? 0,
    nbGamesPlayed: entry?.nbGamesPlayed ?? 0,
    teamAccountId: entry?.teamAccountId || null,
    accountIds: Array.isArray(entry?.accountIds) ? entry.accountIds : [],
    names: Array.isArray(entry?.names) ? entry.names : []
  };
}

function normalizePageNumbers(pageNumbers) {
  if (!Array.isArray(pageNumbers)) {
    return [];
  }

  return [...new Set(
    pageNumbers
      .map((pageNumber) => Number(pageNumber))
      .filter((pageNumber) => Number.isInteger(pageNumber) && pageNumber >= 0)
  )].sort((left, right) => left - right);
}

function toDataAbsolutePath(relativePath) {
  return path.join(__dirname, "../../data", relativePath);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
  findPlayerResultInLocation,
  rebuildLeaderboardPlayerIndex,
  invalidateLeaderboardPlayerIndex,
  loadTrackedPlayerIds
};

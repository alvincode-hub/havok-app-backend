const fs = require("fs-extra");
const path = require("path");

const {
  normalizedTournamentResultsDirPath,
  normalizedTournamentResultsPath,
  normalizedTournamentResultsPlayerIndexPath
} = require("../storage/paths.js");
const {
  loadNormalizedData,
  saveNormalizedData
} = require("../storage/normalizedStore.js");
const { logDebug } = require("../utils/logger.js");

async function findPlayerResultInLocation(resolvedLocation, playerId) {
  if (!resolvedLocation || !playerId) {
    return null;
  }

  const indexPath = normalizedTournamentResultsPlayerIndexPath(resolvedLocation);
  const indexAbsolutePath = toDataAbsolutePath(indexPath);
  const cachedIndex = (await fs.pathExists(indexAbsolutePath))
    ? await loadNormalizedData(indexPath)
    : null;

  if (isObject(cachedIndex?.players)) {
    return cachedIndex.players[playerId] || null;
  }

  const rebuiltIndex = await rebuildLeaderboardPlayerIndex(resolvedLocation);
  return rebuiltIndex?.players?.[playerId] || null;
}

async function rebuildLeaderboardPlayerIndex(resolvedLocation) {
  const pageNumbers = await resolveLeaderboardPageNumbers(resolvedLocation);

  if (pageNumbers.length === 0) {
    return null;
  }

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
      for (const accountId of entry.accountIds || []) {
        if (accountId && !players[accountId]) {
          players[accountId] = entry;
        }
      }
    }
  }

  if (pagesLoaded === 0) {
    return null;
  }

  const payload = {
    resolvedLocation,
    pagesLoaded,
    totalPlayers: Object.keys(players).length,
    players
  };

  await saveNormalizedData(
    payload,
    normalizedTournamentResultsPlayerIndexPath(resolvedLocation)
  );

  logDebug(
    `Index joueurs reconstruit ${resolvedLocation} pages=${pagesLoaded} players=${payload.totalPlayers}`,
    "LeaderboardIndex"
  );

  return payload;
}

async function invalidateLeaderboardPlayerIndex(resolvedLocation) {
  const absolutePath = toDataAbsolutePath(
    normalizedTournamentResultsPlayerIndexPath(resolvedLocation)
  );

  if (await fs.pathExists(absolutePath)) {
    await fs.remove(absolutePath);
  }
}

async function resolveLeaderboardPageNumbers(resolvedLocation) {
  const pageNumbers = new Set();
  const firstPagePath = normalizedTournamentResultsPath(resolvedLocation, 0);
  const firstPageAbsolutePath = toDataAbsolutePath(firstPagePath);

  if (!(await fs.pathExists(firstPageAbsolutePath))) {
    return [];
  }

  const firstPage = await loadNormalizedData(
    firstPagePath
  );

  if (isObject(firstPage) && typeof firstPage.totalPages === "number" && firstPage.totalPages > 0) {
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

function toDataAbsolutePath(relativePath) {
  return path.join(__dirname, "../../data", relativePath);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
  findPlayerResultInLocation,
  rebuildLeaderboardPlayerIndex,
  invalidateLeaderboardPlayerIndex
};

const fs = require("fs-extra");
const path = require("path");
const { logDebug, logWarning, logError, logInfo } = require("../utils/logger");
const { loadNormalizedData } = require("../storage/normalizedStore.js");
const { normalizedTournamentsPath } = require("../storage/paths.js");
const { isOlderThan15Days } = require("../utils/dates.js");

let isRunning = false;

async function runCleanupResultsJob() {
  if (isRunning) {
    logWarning("Cleanup job deja en cours d'execution", "CleanupResultsJob");
    return false;
  }

  isRunning = true;

  try {
    const events = await loadNormalizedData(normalizedTournamentsPath());

    if (!Array.isArray(events) || events.length === 0) {
      logDebug("Aucun evenement trouve pour cleanup", "CleanupResultsJob");
      return true;
    }

    const summary = await cleanupOldResults(events);

    logInfo(
      `Cleanup termine: ${summary.deletedDirectories} dossier(s), ${summary.deletedFiles} fichier(s)`,
      "CleanupResultsJob"
    );

    return true;
  } catch (error) {
    logError("Erreur lors du cleanup des resultats", "CleanupResultsJob", error);
    return false;
  } finally {
    isRunning = false;
  }
}

async function cleanupOldResults(events) {
  const summary = {
    deletedDirectories: 0,
    deletedFiles: 0
  };

  const processedLocations = new Set();
  const processedLeaderboards = new Set();

  for (const event of events) {
    for (const window of event.windows || []) {
      const windowEndDate = new Date(window.end);
      const resolvedLocation = window.resolvedLocation;
      const leaderboardId = window.leaderboardId;

      if (!isOlderThan15Days(windowEndDate)) {
        continue;
      }

      if (resolvedLocation && !processedLocations.has(resolvedLocation)) {
        processedLocations.add(resolvedLocation);

        const result = await deleteWindowResults(resolvedLocation);

        summary.deletedDirectories += result.directories;
        summary.deletedFiles += result.files;
      }

      if (leaderboardId && !processedLeaderboards.has(leaderboardId)) {
        processedLeaderboards.add(leaderboardId);

        const scoreRules = await deleteScoreRules(leaderboardId);

        summary.deletedDirectories += scoreRules.directories;
        summary.deletedFiles += scoreRules.files;
      }
    }
  }

  return summary;
}

async function deleteWindowResults(resolvedLocation) {
  const result = {
    directories: 0,
    files: 0
  };

  if (!resolvedLocation) {
    return result;
  }

  const [, ...segments] = String(resolvedLocation).split(":");

  const cleanSegments = segments
    .map((s) =>
      String(s)
        .replace(/[<>:"/\\|?*]/g, "_")
        .replace(/\s+/g, "_")
    )
    .filter(Boolean);

  if (cleanSegments.length === 0) {
    return result;
  }

  const normalizedResultsPath = path.join(
    __dirname,
    "../../data",
    "normalized",
    "results",
    ...cleanSegments
  );

  const rawResultsPath = path.join(
    __dirname,
    "../../data",
    "raw",
    "results",
    ...cleanSegments
  );

  try {
    if (await fs.pathExists(normalizedResultsPath)) {
      const filesDeleted = await deleteDirectoryRecursive(normalizedResultsPath);

      result.files += filesDeleted;
      result.directories += 1;

      logDebug(
        `Resultats normalises supprimes: ${normalizedResultsPath}`,
        "CleanupResultsJob"
      );
    }
  } catch (error) {
    logWarning(
      `Impossible de supprimer ${normalizedResultsPath}`,
      "CleanupResultsJob",
      error
    );
  }

  try {
    if (await fs.pathExists(rawResultsPath)) {
      const filesDeleted = await deleteDirectoryRecursive(rawResultsPath);

      result.files += filesDeleted;
      result.directories += 1;

      logDebug(
        `Resultats bruts supprimes: ${rawResultsPath}`,
        "CleanupResultsJob"
      );
    }
  } catch (error) {
    logWarning(
      `Impossible de supprimer ${rawResultsPath}`,
      "CleanupResultsJob",
      error
    );
  }

  return result;
}

async function deleteScoreRules(leaderboardId) {
  const result = {
    directories: 0,
    files: 0
  };

  if (!leaderboardId) {
    return result;
  }

  const normalizedScoreRulesPath = path.join(
    __dirname,
    "../../data",
    "normalized",
    "scoreRules",
    `${leaderboardId}.json`
  );

  try {
    if (await fs.pathExists(normalizedScoreRulesPath)) {
      await fs.unlink(normalizedScoreRulesPath);

      result.files += 1;

      logDebug(
        `ScoreRules supprimees: ${normalizedScoreRulesPath}`,
        "CleanupResultsJob"
      );
    }
  } catch (error) {
    logWarning(
      `Impossible de supprimer ${normalizedScoreRulesPath}`,
      "CleanupResultsJob",
      error
    );
  }

  return result;
}

async function deleteDirectoryRecursive(dirPath) {
  let filesDeleted = 0;

  const entries = await fs.readdir(dirPath);

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const stat = await fs.stat(fullPath);

    if (stat.isDirectory()) {
      filesDeleted += await deleteDirectoryRecursive(fullPath);
    } else {
      await fs.unlink(fullPath);
      filesDeleted += 1;
    }
  }

  await fs.rmdir(dirPath);

  return filesDeleted;
}

module.exports = { runCleanupResultsJob };
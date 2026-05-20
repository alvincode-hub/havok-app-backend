const { logDebug, logWarning, logError, logInfo } = require("../utils/logger");
const { loadNormalizedData } = require("../storage/normalizedStore.js");
const { normalizedTournamentsPath } = require("../storage/paths.js");
const { syncResultsEnriched } = require("../services/enriched.service.js");
const { updateLeaderboardWindow } = require("./leaderboardResults.shared.js");
const { isFinish, isOlderThan15Days } = require("../utils/dates.js");
const { loadAcceptedEventIds, isEventAccepted } = require("../services/filterEvents.js");
const {
  buildLeaderboardRequestOptions,
  getUniqueResolvedLocations
} = require("./leaderboardTargets.shared.js");

let isRunning = false;

async function runEventsResultJob() {
  if (isRunning) {
    logWarning("Job deja en cours d'execution", "EventsResultJob");
    return false;
  }

  isRunning = true;

  try {
    const events = await loadNormalizedData(normalizedTournamentsPath());

    if (!Array.isArray(events) || events.length === 0) {
      logDebug("Aucun evenement trouve dans les donnees normalisees", "EventsResultJob");
      return true;
    }

    const summary = await updateEventsResults(events);

    if (summary.updatedWindows > 0 || summary.skippedCooldownWindows > 0) {
      await syncResultsEnriched();
    }

    logInfo(
      `Job termine: ${summary.updatedWindows} fenetre(s), ${summary.updatedPages} page(s), ${summary.skippedForbiddenWindows} refusee(s), ${summary.skippedCooldownWindows} en cooldown, ${summary.failedWindows} en erreur`,
      "EventsResultJob"
    );
    return true;
  } catch (error) {
    logError("Erreur lors de l'execution du job", "EventsResultJob", error);
    return false;
  } finally {
    isRunning = false;
  }
}

async function updateEventsResults(events) {
  const acceptedEventIds = await loadAcceptedEventIds();
  const processedLocations = new Set();
  const summary = {
    updatedWindows: 0,
    updatedPages: 0,
    skippedForbiddenWindows: 0,
    skippedCooldownWindows: 0,
    failedWindows: 0
  };

  for (const event of events) {
    if (!(await isEventAccepted(event.id, acceptedEventIds))) {
      continue;
    }

    for (const window of event.windows || []) {
      if (!window.scoreLocations) {
        continue;
      }

      if (!isFinish(window.end)) {
        continue;
      }

      if (isOlderThan15Days(window.end)) {
        continue;
      }

      const leaderboards = getUniqueResolvedLocations(window);
      const requestOptions = buildLeaderboardRequestOptions(window, "finished");

      for (const leaderboard of leaderboards) {
        if (processedLocations.has(leaderboard)) {
          continue;
        }

        processedLocations.add(leaderboard);
        const result = await updateLeaderboardWindow(
          leaderboard,
          "EventsResultJob",
          requestOptions
        );

        if (result.status === "forbidden") {
          summary.skippedForbiddenWindows += 1;
          continue;
        }

        if (result.status === "cooldown") {
          summary.skippedCooldownWindows += 1;
          continue;
        }

        if (result.status === "failed") {
          summary.failedWindows += 1;
          continue;
        }

        summary.updatedWindows += 1;
        summary.updatedPages += result.pagesSaved;
      }
    }
  }

  return summary;
}

module.exports = { runEventsResultJob };

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

async function runEventsResultJob(options = {}) {
  if (isRunning) {
    logWarning("Job deja en cours d'execution", "EventsResultJob");
    return false;
  }

  isRunning = true;

  try {
    const jobOptions = normalizeJobOptions(options);
    const events = await loadNormalizedData(normalizedTournamentsPath());

    if (!Array.isArray(events) || events.length === 0) {
      logDebug("Aucun evenement trouve dans les donnees normalisees", "EventsResultJob");
      return true;
    }

    const summary = await updateEventsResults(events, jobOptions);

    if (summary.shouldRebuildEnriched) {
      const rebuildReason = jobOptions.forceRebuildEnriched
        ? "events-results-force-rebuild"
        : "events-results-refresh";

      logDebug(
        `Rebuild enrichi lance refreshedWindows=${summary.refreshedWindows} force=${jobOptions.forceRebuildEnriched}`,
        "EventsResultJob"
      );
      await syncResultsEnriched({
        force: jobOptions.forceRebuildEnriched,
        reason: rebuildReason
      });
    } else {
      logDebug("Rebuild enrichi saute: aucune fenetre rafraichie", "EventsResultJob");
    }

    logInfo(
      `Job termine: ${summary.refreshedWindows} fenetre(s) rafraichie(s), ${summary.updatedPages} page(s), ${summary.dataChangedWindows} fenetre(s) avec donnees changees, ${summary.skippedForbiddenWindows} refusee(s), ${summary.cooldownWindows} en cooldown, ${summary.failedWindows} en erreur, rebuildEnriched=${summary.shouldRebuildEnriched}`,
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

async function updateEventsResults(events, options = {}) {
  const acceptedEventIds = await loadAcceptedEventIds();
  const processedLocations = new Set();
  const summary = {
    refreshedWindows: 0,
    updatedPages: 0,
    dataChangedWindows: 0,
    skippedForbiddenWindows: 0,
    cooldownWindows: 0,
    failedWindows: 0,
    shouldRebuildEnriched: false
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
      const requestOptions = {
        ...buildLeaderboardRequestOptions(window, "finished"),
        forceRefresh: options.forceRefresh
      };

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
          summary.cooldownWindows += 1;
          continue;
        }

        if (result.status === "failed") {
          summary.failedWindows += 1;
          continue;
        }

        summary.refreshedWindows += 1;
        summary.updatedPages += result.pagesSaved;

        if (result.dataChanged) {
          summary.dataChangedWindows += 1;
        }
      }
    }
  }

  summary.shouldRebuildEnriched =
    Boolean(options.forceRebuildEnriched) || summary.refreshedWindows > 0;

  return summary;
}

function normalizeJobOptions(options = {}) {
  return {
    forceRefresh: Boolean(options.force),
    forceRebuildEnriched: Boolean(options.forceRebuildEnriched)
  };
}

module.exports = { runEventsResultJob };

const { logDebug, logWarning, logError, logInfo } = require("../utils/logger");
const { loadNormalizedData } = require("../storage/normalizedStore.js");
const { normalizedTournamentsPath } = require("../storage/paths.js");
const { isDateLive } = require("../utils/dates.js");
const { syncResultsEnriched } = require("../services/enriched.service.js");
const { updateLeaderboardWindow } = require("./leaderboardResults.shared.js");
const { loadAcceptedEventIds, isEventAccepted } = require("../services/filterEvents.js");
const {
  buildLeaderboardRequestOptions,
  getUniqueResolvedLocations
} = require("./leaderboardTargets.shared.js");

let isRunning = false;

async function runLiveEventsResultJob() {
  if (isRunning) {
    logWarning("Job deja en cours d'execution", "LiveEventsResultJob");
    return false;
  }

  isRunning = true;

  try {
    const liveEvents = await getLiveEvents();

    if (liveEvents.length === 0) {
      logDebug("Aucun evenement en direct", "LiveEventsResultJob");
      return true;
    }

    const acceptedEventIds = await loadAcceptedEventIds();
    const acceptedLiveEvents = [];

    for (const liveEvent of liveEvents) {
      if (await isEventAccepted(liveEvent.eventId, acceptedEventIds)) {
        acceptedLiveEvents.push(liveEvent);
      }
    }

    if (acceptedLiveEvents.length === 0) {
      logDebug("Aucun evenement live accepte", "LiveEventsResultJob");
      return true;
    }

    const summary = await updateLiveEventsResults(acceptedLiveEvents);

    if (summary.updatedWindows > 0) {
      await syncResultsEnriched();
    }

    logInfo(
      `Job termine: ${summary.updatedWindows} fenetre(s), ${summary.updatedPages} page(s), ${summary.skippedForbiddenWindows} refusee(s), ${summary.skippedCooldownWindows} en cooldown, ${summary.failedWindows} en erreur`,
      "LiveEventsResultJob"
    );
    return true;
  } catch (error) {
    logError("Erreur lors de l'execution du job", "LiveEventsResultJob", error);
    return false;
  } finally {
    isRunning = false;
  }
}

async function getLiveEvents() {
  const tournaments = await loadNormalizedData(normalizedTournamentsPath());

  if (!Array.isArray(tournaments)) {
    return [];
  }

  const liveEvents = [];

  for (const tournament of tournaments) {
    for (const window of tournament.windows || []) {
      if (!window.start || !window.end) {
        continue;
      }

      if (!isDateLive(window.start, window.end)) {
        continue;
      }

      liveEvents.push({
        eventId: tournament.id,
        window
      });
    }
  }

  return liveEvents.filter((event) => getUniqueResolvedLocations(event.window).length > 0);
}

async function updateLiveEventsResults(liveEvents) {
  const processedLocations = new Set();
  const summary = {
    updatedWindows: 0,
    updatedPages: 0,
    skippedForbiddenWindows: 0,
    skippedCooldownWindows: 0,
    failedWindows: 0
  };

  for (const liveEvent of liveEvents) {
    const leaderboards = getUniqueResolvedLocations(liveEvent.window);
    const requestOptions = buildLeaderboardRequestOptions(liveEvent.window, "live");

    for (const leaderboard of leaderboards) {
      if (processedLocations.has(leaderboard)) {
        continue;
      }

      processedLocations.add(leaderboard);
      const result = await updateLeaderboardWindow(
        leaderboard,
        "LiveEventsResultJob",
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

  return summary;
}

module.exports = { runLiveEventsResultJob };

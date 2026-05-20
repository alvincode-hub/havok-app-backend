const { enrichHome } = require("../enriched/enriched.home.js");
const { enrichedCalendrier } = require("../enriched/enriched.calendrier.js");
const { enrichedWindowList } = require("../enriched/enriched.eventList.js");
const { enrichedPlayers } = require("../enriched/enriched.players.js");
const { enrichedResults } = require("../enriched/enriched.results.js");
const { enrichedWindowDetail } = require("../enriched/enriched.windowDetail.js");
const { saveEnrichedData } = require("../storage/enrichedStore.js");
const {
  enrichedHomePath,
  enrichedCalendrierPath,
  enrichedPlayersPath,
  enrichedResultsPath,
  enrichedWindowDetailsPath,
  enrichedEventListPath
} = require("../storage/paths.js");
const {
  invalidateDashboardPayloadCache
} = require("./dashboardPayloadCache.service.js");
const { logDebug, logError, logInfo } = require("../utils/logger");

async function syncHomeEnriched(options = {}) {
  try {
    const data = await enrichHome();
    await saveEnrichedData(data, enrichedHomePath());
    invalidateDashboardPayloadCache();
    logEnrichedSnapshot("syncHomeEnriched", enrichedHomePath(), data, options);
    return data;
  } catch (error) {
    logError("Generation de home enrichi impossible", "EnrichedService", error);
    return null;
  }
}

async function syncEventListEnriched(options = {}) {
  try {
    const data = await enrichedWindowList();
    await saveEnrichedData(data, enrichedEventListPath());
    invalidateDashboardPayloadCache();
    logEnrichedSnapshot("syncEventListEnriched", enrichedEventListPath(), data, options);
    return data;
  } catch (error) {
    logError("Generation de la list d'events enrichi impossible", "EnrichedService", error);
    return null;
  }
}

async function syncCalendrierEnriched(options = {}) {
  try {
    const data = await enrichedCalendrier();
    await saveEnrichedData(data, enrichedCalendrierPath());
    invalidateDashboardPayloadCache();
    logEnrichedSnapshot("syncCalendrierEnriched", enrichedCalendrierPath(), data, options);
    return data;
  } catch (error) {
    logError("Generation du calendrier enrichi impossible", "EnrichedService", error);
    return null;
  }
}

async function syncWindowDetailEnriched(options = {}) {
  try {
    const data = await enrichedWindowDetail();
    await saveEnrichedData(data, enrichedWindowDetailsPath());
    invalidateDashboardPayloadCache();
    logEnrichedSnapshot("syncWindowDetailEnriched", enrichedWindowDetailsPath(), data, options);
    return data;
  } catch (error) {
    logError("Generation des details de window enrichis impossible", "EnrichedService", error);
    return null;
  }
}

async function syncWindowResultEnriched(options = {}) {
  try {
    const data = await enrichedResults();
    await saveEnrichedData(data, enrichedResultsPath());
    invalidateDashboardPayloadCache();
    logEnrichedSnapshot("syncWindowResultEnriched", enrichedResultsPath(), data, options);
    return data;
  } catch (error) {
    logError("Generation des resultats enrichis impossible", "EnrichedService", error);
    return null;
  }
}

async function syncPlayersEnriched(options = {}) {
  try {
    const data = await enrichedPlayers();
    await saveEnrichedData(data, enrichedPlayersPath());
    invalidateDashboardPayloadCache();
    logEnrichedSnapshot("syncPlayersEnriched", enrichedPlayersPath(), data, options);
    return data;
  } catch (error) {
    logError("Generation des joueurs enrichis impossible", "EnrichedService", error);
    return null;
  }
}

async function syncTournamentEnriched(options = {}) {
  await syncCalendrierEnriched(options);
  await syncHomeEnriched(options);
  await syncWindowDetailEnriched(options);
  await syncEventListEnriched(options);
}

async function syncResultsEnriched(options = {}) {
  await syncHomeEnriched(options);
  await syncPlayersEnriched(options);
  await syncWindowResultEnriched(options);
  await syncWindowDetailEnriched(options);
}

async function syncWindowEnriched(options = {}) {
  await syncWindowResultEnriched(options);
  await syncWindowDetailEnriched(options);
  await syncEventListEnriched(options);
}

async function syncProfileEnriched(options = {}) {
  await syncPlayersEnriched(options);
}

async function syncEventEnriched(options = {}) {
  await syncEventListEnriched(options);
}

async function syncAllEnriched(options = {}) {
  if (options.force) {
    logInfo(
      `Force rebuild enrichi complet reason=${options.reason || "manual"}`,
      "EnrichedService"
    );
  }

  await syncCalendrierEnriched(options);
  await syncHomeEnriched(options);
  await syncPlayersEnriched(options);
  await syncWindowResultEnriched(options);
  await syncWindowDetailEnriched(options);
  await syncEventListEnriched(options);
}

function logEnrichedSnapshot(syncName, filePath, data, options = {}) {
  const context = buildLogContext(options);
  logDebug(
    `${syncName} -> ${filePath} count=${countSnapshotEntries(data)}${context}`,
    "EnrichedService"
  );
}

function countSnapshotEntries(data) {
  if (Array.isArray(data)) {
    return data.length;
  }

  if (data && typeof data === "object") {
    return Object.keys(data).length;
  }

  return data === null || data === undefined ? 0 : 1;
}

function buildLogContext(options = {}) {
  const parts = [];

  if (options.reason) {
    parts.push(`reason=${options.reason}`);
  }

  if (options.force) {
    parts.push("force=true");
  }

  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

module.exports = {
  syncHomeEnriched,
  syncCalendrierEnriched,
  syncWindowDetailEnriched,
  syncWindowResultEnriched,
  syncPlayersEnriched,
  syncTournamentEnriched,
  syncResultsEnriched,
  syncProfileEnriched,
  syncAllEnriched,
  syncWindowEnriched,
  syncEventEnriched
};

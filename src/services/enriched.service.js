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
const { logDebug, logError } = require("../utils/logger");

async function syncHomeEnriched() {
  try {
    const data = await enrichHome();
    await saveEnrichedData(data, enrichedHomePath());
    invalidateDashboardPayloadCache();
    logDebug(`Snapshot enrichi ${enrichedHomePath()}`, "EnrichedService");
    return data;
  } catch (error) {
    logError("Generation de home enrichi impossible", "EnrichedService", error);
    return null;
  }
}

async function syncEventListEnriched() {
  try {
    const data = await enrichedWindowList();
    await saveEnrichedData(data, enrichedEventListPath());
    invalidateDashboardPayloadCache();
    logDebug(`Snapshot enrichi ${enrichedEventListPath()}`, "c");
    return data;
  } catch (error) {
    logError("Generation de la list d'events enrichi impossible", "EnrichedService", error);
    return null;
  }
}

async function syncCalendrierEnriched() {
  try {
    const data = await enrichedCalendrier();
    await saveEnrichedData(data, enrichedCalendrierPath());
    invalidateDashboardPayloadCache();
    logDebug(`Snapshot enrichi ${enrichedCalendrierPath()}`, "EnrichedService");
    return data;
  } catch (error) {
    logError("Generation du calendrier enrichi impossible", "EnrichedService", error);
    return null;
  }
}

async function syncWindowDetailEnriched() {
  try {
    const data = await enrichedWindowDetail();
    await saveEnrichedData(data, enrichedWindowDetailsPath());
    invalidateDashboardPayloadCache();
    logDebug(`Snapshot enrichi ${enrichedWindowDetailsPath()}`, "EnrichedService");
    return data;
  } catch (error) {
    logError("Generation des details de window enrichis impossible", "EnrichedService", error);
    return null;
  }
}

async function syncWindowResultEnriched() {
  try {
    const data = await enrichedResults();
    await saveEnrichedData(data, enrichedResultsPath());
    invalidateDashboardPayloadCache();
    logDebug(`Snapshot enrichi ${enrichedResultsPath()}`, "EnrichedService");
    return data;
  } catch (error) {
    logError("Generation des resultats enrichis impossible", "EnrichedService", error);
    return null;
  }
}

async function syncPlayersEnriched() {
  try {
    const data = await enrichedPlayers();
    await saveEnrichedData(data, enrichedPlayersPath());
    invalidateDashboardPayloadCache();
    logDebug(`Snapshot enrichi ${enrichedPlayersPath()}`, "EnrichedService");
    return data;
  } catch (error) {
    logError("Generation des joueurs enrichis impossible", "EnrichedService", error);
    return null;
  }
}

async function syncTournamentEnriched() {
  await syncCalendrierEnriched();
  await syncHomeEnriched();
  await syncWindowDetailEnriched();
  await syncEventListEnriched();
}

async function syncResultsEnriched() {
  await syncHomeEnriched();
  await syncPlayersEnriched();
  await syncWindowResultEnriched();
  await syncWindowDetailEnriched();
}

async function syncWindowEnriched() {
  await syncWindowResultEnriched();
  await syncWindowDetailEnriched();
   await syncEventListEnriched();
}

async function syncProfileEnriched() {
  await syncPlayersEnriched();
}

async function syncEventEnriched() {
  await syncEventListEnriched();
}

async function syncAllEnriched() {
  await syncCalendrierEnriched();
  await syncHomeEnriched();
  await syncPlayersEnriched();
  await syncWindowResultEnriched();
  await syncWindowDetailEnriched();
  await syncEventListEnriched();
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

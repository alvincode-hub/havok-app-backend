const {
  getDashboardPayload: getDashboardData,
  getDashboardTeamConfig,
  updateDashboardTeamConfig,
  getDashboardTournamentFilter,
  updateDashboardTournamentFilter,
  getDashboardActuConfig,
  updateDashboardActuConfig,
  getDashboardCastConfig,
  updateDashboardCastConfig
} = require("./dashboardData.service.js");
const { invalidateDashboardPayloadCache } = require("./dashboardPayloadCache.service.js");
const { runCleanupResultsJob } = require("../jobs/cleanupResults.job.js");
const { runEventsJob } = require("../jobs/event.job.js");
const { runEventsResultJob } = require("../jobs/eventResult.job.js");
const { runScoreRulesJob } = require("../jobs/eventScoreRules.job.js");
const { runLiveEventsResultJob } = require("../jobs/liveEventResults.job.js");
const { runProfileJob } = require("../jobs/profile.job.js");
const {
  startWithOrchestrationLock,
  getOrchestrationLockState
} = require("../jobs/orchestration.shared.js");

let dashboardDataPromise = null;

async function getDashboardPayload() {
  return loadDashboardData();
}

async function getDashboardOverview() {
  const data = await loadDashboardData();

  return {
    meta: asObject(data.meta),
    header: asObject(data.header),
    summaryCards: asArray(data.summaryCards),
    featuredEventId: normalizeId(data.featuredEventId),
    notes: asArray(data.notes),
    dataSources: asArray(data.dataSources)
  };
}

async function getDashboardEvents() {
  const data = await loadDashboardData();

  return {
    items: asArray(data.events)
  };
}

async function getDashboardEventDetail(eventId) {
  const data = await loadDashboardData();
  const normalizedEventId = normalizeId(eventId);

  if (!normalizedEventId) {
    return null;
  }

  return asArray(data.events).find((event) => normalizeId(event?.id) === normalizedEventId) || null;
}

async function getDashboardContent() {
  const data = await loadDashboardData();

  return {
    trackedPlayers: asArray(data.trackedPlayers),
    recentResults: asArray(data.recentResults),
    actu: asArray(data.actu),
    casts: asArray(data.casts)
  };
}

async function getDashboardConfig() {
  const data = await loadDashboardData();
  const settings = asObject(data.settings);

  return {
    teamConfig: asObject(settings.teamConfig, { description: "", players: [] }),
    tournamentFilter: asObject(settings.tournamentFilter, { description: "", acceptedEventIds: [] }),
    actuConfig: asArray(settings.actuConfig),
    castConfig: asObject(settings.castConfig, { entries: [] }),
    eventOptions: asArray(settings.eventOptions),
    castWindowOptions: asArray(settings.castWindowOptions)
  };
}

async function getDashboardStatus() {
  const overview = await getDashboardOverview();
  const sources = asArray(overview.dataSources);

  return {
    generatedAt: overview.meta.generatedAt || new Date().toISOString(),
    region: overview.meta.region || "EU",
    allSourcesPresent: sources.every((source) => Boolean(source?.exists)),
    sourceCount: sources.length,
    readyCount: sources.filter((source) => Boolean(source?.exists)).length,
    sources
  };
}

async function updateAllCron() {
  const orchestrationResult = startWithOrchestrationLock(
    "dashboard:updateAllCron",
    async () => {
      await runEventsJob();
      await runLiveEventsResultJob();
      await runScoreRulesJob();
      await runEventsResultJob();
      await runCleanupResultsJob();
      await runProfileJob();
      invalidateDashboardPayloadCache();
    },
    "DashboardService"
  );

  if (!orchestrationResult.executed) {
    return {
      ok: false,
      message: "Une synchronisation est deja en cours.",
      lockState: getOrchestrationLockState()
    };
  }

  return {
    ok: true,
    message: "Cron lance en arriere-plan.",
    lockState: getOrchestrationLockState()
  };
}

async function loadDashboardData() {
  if (dashboardDataPromise) {
    return dashboardDataPromise;
  }

  dashboardDataPromise = getDashboardData();

  try {
    return await dashboardDataPromise;
  } finally {
    dashboardDataPromise = null;
  }
}

function normalizeId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value, fallback = {}) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

module.exports = {
  getDashboardPayload,
  getDashboardOverview,
  getDashboardEvents,
  getDashboardEventDetail,
  getDashboardContent,
  getDashboardConfig,
  getDashboardStatus,
  getDashboardTeamConfig,
  updateDashboardTeamConfig,
  getDashboardTournamentFilter,
  updateDashboardTournamentFilter,
  getDashboardActuConfig,
  updateDashboardActuConfig,
  getDashboardCastConfig,
  updateDashboardCastConfig,
  updateAllCron
};

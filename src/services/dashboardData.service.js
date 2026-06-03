const fs = require("fs");
const path = require("path");
const { demo_mode } = require("../config/env.js");

const { loadEnrichedData } = require("../storage/enrichedStore.js");
const { loadConfigData, saveConfigData } = require("../storage/configStore.js");
const { loadNormalizedData, saveNormalizedData } = require("../storage/normalizedStore.js");
const { syncAllEnriched, syncCalendrierEnriched, syncResultsEnriched } = require("./enriched.service.js");
const {
  enrichedHomePath,
  enrichedCalendrierPath,
  enrichedPlayersPath,
  enrichedResultsPath,
  enrichedWindowDetailsPath
} = require("../storage/paths.js");
const {
  resolveDashboardImage,
  storeDashboardImage,
  removeDashboardAsset
} = require("./dashboardAssets.service.js");
const {
  getCachedDashboardPayload,
  setCachedDashboardPayload,
  invalidateDashboardPayloadCache
} = require("./dashboardPayloadCache.service.js");

const { runCleanupResultsJob } = require("../jobs/cleanupResults.job.js")
const { runEventsJob } = require("../jobs/event.job.js")
const { runEventsResultJob } = require("../jobs/eventResult.job.js")
const { runScoreRulesJob } = require("../jobs/eventScoreRules.job.js")
const { runLiveEventsResultJob } = require("../jobs/liveEventResults.job.js")
const { runProfileJob } = require("../jobs/profile.job.js")
const {
  startWithOrchestrationLock,
  getOrchestrationLockState
} = require("../jobs/orchestration.shared.js");

const { getWindowSuffix, stripKnownWindowSuffix } = require("../utils/windowSuffix.js");
const { logDebug } = require("../utils/logger.js");

const DATA_ROOT = path.join(__dirname, "../../data");
const HOME_PATH = enrichedHomePath();
const CALENDRIER_PATH = enrichedCalendrierPath();
const PLAYERS_PATH = enrichedPlayersPath();
const RESULTS_PATH = enrichedResultsPath();
const WINDOW_DETAILS_PATH = enrichedWindowDetailsPath();
const TEAM_CONFIG_PATH = "config/team.json";
const TOURNAMENT_FILTER_PATH = "config/tournament-filter.json";
const ACTU_PATH = "normalized/actu/actu.json";
const CAST_PATH = "config/cast.json";
const NORMALIZED_EVENTS_PATH = "normalized/events/events.json";

const SOURCE_DEFINITIONS = [
  {
    id: "home",
    label: "Home enrichi",
    relativePath: HOME_PATH,
    describe: (base) => `${(base.home.upcomingTournaments || []).length} event(s) a venir`
  },
  {
    id: "calendrier",
    label: "Calendrier enrichi",
    relativePath: CALENDRIER_PATH,
    describe: (base) => `${base.calendrier.length} fenetre(s) locale(s)`
  },
  {
    id: "players",
    label: "Players enrichi",
    relativePath: PLAYERS_PATH,
    describe: (base) => `${base.players.length} profil(s) charge(s)`
  },
  {
    id: "window-results",
    label: "Results enrichi",
    relativePath: RESULTS_PATH,
    describe: (base) => `${base.windowResults.length} fenetre(s) avec qual status`
  },
  {
    id: "window-details",
    label: "Window details enrichi",
    relativePath: WINDOW_DETAILS_PATH,
    describe: (base) => `${base.windowDetails.length} fenetre(s) detaillees`
  },
  {
    id: "team",
    label: "Team config",
    relativePath: TEAM_CONFIG_PATH,
    describe: (base) => `${base.teamConfig.players.length} joueur(s) configure(s)`
  },
  {
    id: "filter",
    label: "Tournament filter",
    relativePath: TOURNAMENT_FILTER_PATH,
    describe: (base) => `${base.tournamentFilter.acceptedEventIds.length} eventId(s) accepte(s)`
  },
  {
    id: "normalized-events",
    label: "Events normalizes",
    relativePath: NORMALIZED_EVENTS_PATH,
    describe: (base) => `${base.normalizedEvents.length} eventId(s) catalogue(s)`
  },
  {
    id: "actu",
    label: "Actu locale",
    relativePath: ACTU_PATH,
    describe: (base) => `${base.actu.length} carte(s) dispo`
  },
  {
    id: "cast",
    label: "Cast config",
    relativePath: CAST_PATH,
    describe: (base) =>
      `${countConfiguredCastChannels(base.cast)} canal(aux) sur ${countConfiguredCastWindows(base.cast)} windowId(s)`
  }
];

async function getDashboardPayload() {
  const cachedPayload = getCachedDashboardPayload();

  if (cachedPayload) {
    return cachedPayload;
  }

  logDebug("Construction du payload dashboard local", "DashboardService");

  const base = await loadDashboardBase();
  const acceptedEventIds = createAcceptedEventIdSet(base.tournamentFilter.acceptedEventIds);
  const rawEvents = buildEventCards(
    base.home,
    base.calendrier,
    base.players,
    base.windowResults,
    base.windowDetails
  );
  const filteredEvents = filterDashboardEvents(rawEvents, acceptedEventIds);
  const events = await materializeEvents(filteredEvents.slice(0, 24));
  const players = await buildPlayerDirectory(base.players, base.teamConfig, acceptedEventIds);
  const recentResults = buildRecentResults(players);
  const actu = await materializeActuConfig(base.actu);
  const teamConfig = await materializeTeamConfig(base.teamConfig);
  const sourceCards = buildSourceCards(base);
  const eventOptions = buildTournamentOptions(base.normalizedEvents, base.tournamentFilter);
  const castWindowOptions = buildCastWindowOptions(base.normalizedEvents);
  const castWindowLookup = new Map(castWindowOptions.map((option) => [option.windowId, option]));
  const casts = buildCastCards(base.cast, castWindowLookup);
  const generatedAt = new Date().toISOString();

  return setCachedDashboardPayload({
    meta: {
      generatedAt,
      region: "EU",
      mode: "local-data-only",
      dataRoot: "server/data",
      allSourcesPresent: sourceCards.every((source) => source.exists)
    },
    header: {
      title: "Havok Dashboard",
      subtitle: "Lecture simple des donnees locales du projet. Region unique: EU."
    },
    summaryCards: buildSummaryCards(
      events,
      players,
      recentResults,
      actu,
      base.tournamentFilter,
      sourceCards
    ),
    featuredEventId: events[0]?.id || "",
    events: events.map(stripEventInternals),
    trackedPlayers: players.map(stripPlayerInternals),
    recentResults,
    actu,
    casts,
    dataSources: sourceCards,
    settings: {
      teamConfig,
      tournamentFilter: base.tournamentFilter,
      actuConfig: actu,
      castConfig: base.cast,
      eventOptions,
      castWindowOptions
    },
    notes: buildNotes(events, players, actu, sourceCards, casts, generatedAt)
  });
}

async function updateAllCron() {
  const orchestrationResult = startWithOrchestrationLock(
    "dashboard:updateAllCron",
    async () => {
      await runEventsJob();
      await runLiveEventsResultJob({ force: true });
      await runScoreRulesJob();
      await runEventsResultJob({ force: true });
      await runCleanupResultsJob();
      await runProfileJob();
      logDebug("Force rebuild enrichi complet lance", "DashboardDataService");
      await syncAllEnriched({
        force: true,
        reason: "dashboard-force-refresh"
      });
      invalidateDashboardPayloadCache();
    },
    "DashboardDataService"
  );

  if (!orchestrationResult.executed) {
    const lockState = getOrchestrationLockState();

    return {
      ok: false,
      message: "Une synchronisation est deja en cours.",
      lockState
    };
  }

  return {
    ok: true,
    message: "Force refresh lance en arriere-plan.",
    lockState: getOrchestrationLockState()
  };
}

async function getDashboardStatus() {
  const base = await loadDashboardBase();
  const sources = buildSourceCards(base);

  return {
    generatedAt: new Date().toISOString(),
    region: "EU",
    allSourcesPresent: sources.every((source) => source.exists),
    sourceCount: sources.length,
    readyCount: sources.filter((source) => source.exists).length,
    sources
  };
}

async function getDashboardTeamConfig() {
  const config = normalizeTeamConfig(await loadConfigData(TEAM_CONFIG_PATH));
  return materializeTeamConfig(config);
}

async function updateDashboardTeamConfig(nextConfig) {
  const previousConfig = normalizeTeamConfig(await loadConfigData(TEAM_CONFIG_PATH));
  const config = normalizeTeamConfig(nextConfig);
  const storedConfig = await persistTeamConfig(config, previousConfig);
  await saveConfigData(storedConfig, TEAM_CONFIG_PATH);
  await syncResultsEnriched();
  invalidateDashboardPayloadCache();
  return storedConfig;
}

async function getDashboardTournamentFilter() {
  return normalizeTournamentFilter(await loadConfigData(TOURNAMENT_FILTER_PATH));
}

async function updateDashboardTournamentFilter(nextConfig) {
  const config = normalizeTournamentFilter(nextConfig);
  await saveConfigData(config, TOURNAMENT_FILTER_PATH);
  await syncCalendrierEnriched();
  await syncResultsEnriched();
  invalidateDashboardPayloadCache();
  return config;
}

async function getDashboardActuConfig() {
  const config = normalizeActuConfig(await loadOptionalNormalizedData(ACTU_PATH));
  return materializeActuConfig(config);
}

async function updateDashboardActuConfig(nextConfig) {
  const previousConfig = normalizeActuConfig(await loadOptionalNormalizedData(ACTU_PATH));
  const config = normalizeActuConfig(nextConfig);
  const storedConfig = await persistActuConfig(config);
  await saveNormalizedData(storedConfig, ACTU_PATH);
  await cleanupRemovedActuAssets(previousConfig, storedConfig);
  invalidateDashboardPayloadCache();
  return storedConfig;
}

async function getDashboardCastConfig() {
  return normalizeCastConfig(await loadConfigData(CAST_PATH));
}

async function updateDashboardCastConfig(nextConfig) {
  const config = normalizeCastConfig(nextConfig);
  await saveConfigData(config, CAST_PATH);
  invalidateDashboardPayloadCache();
  return config;
}

async function loadDashboardBase() {
  const [
    homeData,
    calendrierData,
    playersData,
    windowResultsData,
    windowDetailsData,
    teamConfig,
    tournamentFilter,
    actuConfig,
    castConfig,
    normalizedEvents
  ] =
    await Promise.all([
      loadEnrichedData(HOME_PATH),
      loadEnrichedData(CALENDRIER_PATH),
      loadEnrichedData(PLAYERS_PATH),
      loadEnrichedData(RESULTS_PATH),
      loadEnrichedData(WINDOW_DETAILS_PATH),
      loadConfigData(TEAM_CONFIG_PATH),
      loadConfigData(TOURNAMENT_FILTER_PATH),
      loadOptionalNormalizedData(ACTU_PATH),
      loadConfigData(CAST_PATH),
      demo_mode ? loadOptionalNormalizedData(NORMALIZED_EVENTS_PATH) : loadNormalizedData(NORMALIZED_EVENTS_PATH)
    ]);

  return {
    home: isObject(homeData) ? homeData : {},
    calendrier: Array.isArray(calendrierData) ? calendrierData : [],
    players: Array.isArray(playersData) ? playersData : [],
    windowResults: Array.isArray(windowResultsData) ? windowResultsData : [],
    windowDetails: Array.isArray(windowDetailsData) ? windowDetailsData : [],
    normalizedEvents: Array.isArray(normalizedEvents) ? normalizedEvents : [],
    teamConfig: normalizeTeamConfig(teamConfig),
    tournamentFilter: normalizeTournamentFilter(tournamentFilter),
    actu: normalizeActuConfig(actuConfig),
    cast: normalizeCastConfig(castConfig)
  };
}

async function materializeEvents(events) {
  return Promise.all(
    (events || []).map(async (event) => ({
      ...event,
      image: await resolveDashboardImage(event.image, {
        namespace: "events",
        assetKey: event.tournamentId || event.id,
        label: event.name,
        variant: "events"
      })
    }))
  );
}

async function buildPlayerDirectory(playersData, teamConfig, acceptedEventIds) {
  const mergedPlayers = new Map();

  for (const configPlayer of teamConfig.players) {
    mergedPlayers.set(configPlayer.accountId, {
      id: configPlayer.accountId,
      name: repairText(configPlayer.name) || "Tracked player",
      pseudo: repairText(configPlayer.name) || "Tracked player",
      image: normalizeSimpleString(configPlayer.image),
      country: repairText(configPlayer.country),
      countryFlag: normalizeSimpleString(configPlayer.countryFlag),
      lastTournaments: []
    });
  }

  for (const player of playersData) {
    const id = normalizeSimpleString(player.id);

    if (!id) {
      continue;
    }

    const current = mergedPlayers.get(id) || {
      id,
      name: "Tracked player",
      pseudo: "Tracked player",
      image: "",
      country: "",
      countryFlag: "",
      lastTournaments: []
    };

    mergedPlayers.set(id, {
      ...current,
      id,
      name: repairText(player.name) || current.name,
      pseudo: repairText(player.pseudo) || current.pseudo,
      image: normalizeSimpleString(player.image) || current.image,
      country: repairText(player.country) || current.country,
      countryFlag: normalizeSimpleString(player.countryFlag) || current.countryFlag,
      lastTournaments: filterTournamentHistory(
        Array.isArray(player.lastTournaments) ? player.lastTournaments : current.lastTournaments,
        acceptedEventIds
      )
    });
  }

  const localizedPlayers = await Promise.all(
    Array.from(mergedPlayers.values()).map(async (player) => {
      const history = Array.isArray(player.lastTournaments) ? player.lastTournaments : [];
      const liveEntry = history.find((entry) => isLiveWindow(entry.start, entry.end)) || null;
      const latestEntry = history.find((entry) => typeof entry?.result?.rank === "number") || history[0] || null;
      const bestRankValue = findBestRank(history);
      const bestRank = typeof bestRankValue === "number" ? `#${bestRankValue}` : "--";
      const latestRank = typeof latestEntry?.result?.rank === "number" ? `#${latestEntry.result.rank}` : "--";
      const latestPoints = typeof latestEntry?.result?.points === "number" ? latestEntry.result.points : 0;
      const latestKills = typeof latestEntry?.result?.kills === "number" ? latestEntry.result.kills : 0;
      const latestGames = typeof latestEntry?.result?.nbGamesPlayed === "number" ? latestEntry.result.nbGamesPlayed : 0;
      const latestEventName = formatWindowName(latestEntry);
      const latestPlayedAt = latestEntry?.start || null;
      const lastMode = repairText(latestEntry?.gameMode) || "Mode inconnu";
      const teamFormat = repairText(latestEntry?.teamFormat) || "Format inconnu";
      const status = liveEntry ? "live" : latestEntry ? "recent" : "idle";

      return {
        id: player.id,
        name: player.name,
        pseudo: player.pseudo,
        image: await resolveDashboardImage(player.image, {
          namespace: "players",
          assetKey: player.id || player.name,
          label: player.name,
          variant: "players"
        }),
        country: player.country || "EU",
        countryFlag: await resolveDashboardImage(player.countryFlag, {
          namespace: "flags",
          assetKey: player.country || player.id,
          label: player.country || "EU",
          variant: "flags"
        }),
        status,
        statusLabel: formatPlayerStatus(status),
        latestEventName,
        latestRank,
        bestRank,
        latestPoints,
        latestKills,
        latestGames,
        latestPlayedAt,
        latestPlayedAtLabel: formatShortDateTime(latestPlayedAt),
        mode: lastMode,
        teamFormat,
        resultsCount: history.length,
        summary: latestEntry?.result
          ? `${latestPoints} pts, ${latestKills} elim(s), ${latestGames} game(s) sur ${latestEventName}.`
          : "Aucun resultat local trouve pour ce joueur.",
        _latestEntry: latestEntry
      };
    })
  );

  return localizedPlayers.sort((left, right) => {
    const bestRankDelta = compareRankLabels(left.bestRank, right.bestRank);

    if (bestRankDelta !== 0) {
      return bestRankDelta;
    }

    return compareIsoDates(right.latestPlayedAt, left.latestPlayedAt) || left.name.localeCompare(right.name);
  });
}

function buildRecentResults(players) {
  return players
    .filter((player) => player._latestEntry?.result)
    .map((player) => ({
      id: `${player.id}-${player._latestEntry.windowId || player._latestEntry.tournamentId || "result"}`,
      playerName: player.name,
      eventName: formatWindowName(player._latestEntry),
      rankLabel: player.latestRank,
      points: player.latestPoints,
      kills: player.latestKills,
      games: player.latestGames,
      mode: player.mode,
      playedAt: player.latestPlayedAt,
      playedAtLabel: player.latestPlayedAtLabel
    }))
    .sort((left, right) => {
      const timeDelta = compareIsoDates(right.playedAt, left.playedAt);

      if (timeDelta !== 0) {
        return timeDelta;
      }

      return compareRankLabels(left.rankLabel, right.rankLabel);
    })
    .slice(0, 10);
}

function buildEventCards(home, calendrier, playersData, windowResults, windowDetails) {
  const eventMap = new Map();
  const windowResultsById = createWindowSnapshotLookup(windowResults);
  const windowDetailsById = createWindowSnapshotLookup(windowDetails);

  registerEvent(eventMap, home.liveTournament);

  for (const event of home.upcomingTournaments || []) {
    registerEvent(eventMap, event);
  }

  registerEvent(eventMap, home.lastPlayedWindow?.tournament);

  for (const event of calendrier || []) {
    registerEvent(eventMap, event);
  }

  return Array.from(eventMap.values())
    .map((event) =>
      finalizeEvent(
        event,
        playersData,
        windowResultsById.get(event.windowId) || null,
        windowDetailsById.get(event.windowId) || null
      )
    )
    .sort(sortEvents);
}

function createWindowSnapshotLookup(entries) {
  const lookup = new Map();

  for (const entry of entries || []) {
    const windowId = normalizeSimpleString(entry?.windowId);

    if (!windowId) {
      continue;
    }

    lookup.set(windowId, entry);
  }

  return lookup;
}

function registerEvent(eventMap, rawEvent) {
  if (!isObject(rawEvent)) {
    return;
  }

  const id = normalizeSimpleString(rawEvent.windowId || rawEvent.tournamentId || rawEvent.id);

  if (!id) {
    return;
  }

  const status = deriveEventStatus(rawEvent.start, rawEvent.end);
  const current = eventMap.get(id);
  const nextEvent = {
    id,
    tournamentId: normalizeSimpleString(rawEvent.tournamentId || rawEvent.id || id),
    windowId: normalizeSimpleString(rawEvent.windowId || id),
    name: formatWindowName(rawEvent),
    image: normalizeSimpleString(rawEvent.image),
    start: rawEvent.start || null,
    end: rawEvent.end || null,
    mode: normalizeMode(rawEvent.gameMode || rawEvent.mode),
    teamFormat: repairText(rawEvent.teamFormat) || "Format inconnu",
    status
  };

  if (!current) {
    eventMap.set(id, nextEvent);
    return;
  }

  const currentPriority = getStatusPriority(current.status);
  const nextPriority = getStatusPriority(nextEvent.status);

  if (nextPriority > currentPriority) {
    eventMap.set(id, { ...current, ...nextEvent });
    return;
  }

  eventMap.set(id, {
    ...current,
    image: current.image || nextEvent.image,
    start: current.start || nextEvent.start,
    end: current.end || nextEvent.end,
    mode: current.mode || nextEvent.mode,
    teamFormat: current.teamFormat || nextEvent.teamFormat
  });
}

function finalizeEvent(event, playersData, windowResult, windowDetail) {
  const trackedPlayers = countPlayersForEvent(playersData, event.windowId, event.tournamentId);
  const bestRankValue = findBestRankForEvent(playersData, event.windowId, event.tournamentId);
  const connectedWindow = connectWindowSnapshots(windowResult, windowDetail);

  return {
    id: event.id,
    eventId: event.tournamentId,
    tournamentId: event.tournamentId,
    windowId: event.windowId,
    name: event.name,
    status: event.status,
    statusLabel: formatEventStatus(event.status),
    start: event.start,
    end: event.end,
    mode: event.mode,
    teamFormat: event.teamFormat,
    timeLabel: formatEventRange(event.start, event.end),
    countdown: formatCountdown(event.status, event.start, event.end),
    trackedPlayers,
    bestRank: typeof bestRankValue === "number" ? `#${bestRankValue}` : "--",
    summary: buildEventSummary(event.status, trackedPlayers, bestRankValue),
    image: event.image,
    eventType: connectedWindow.type,
    detailDescription: connectedWindow.description,
    matchCap: connectedWindow.matchCap,
    leaderboardId: connectedWindow.leaderboardId,
    requiresQualification: connectedWindow.requiresQualification,
    prizeCount: connectedWindow.prizeCount,
    scoreRuleCount: connectedWindow.scoreRuleCount,
    prizeHighlights: connectedWindow.prizeHighlights,
    qualificationCount: connectedWindow.qualificationCount,
    qualificationSummary: connectedWindow.qualificationSummary,
    playerStatuses: connectedWindow.playerStatuses,
    hasResultConnection: connectedWindow.hasResultConnection,
    hasDetailConnection: connectedWindow.hasDetailConnection,
    hasWindowConnection: connectedWindow.hasWindowConnection
  };
}

function connectWindowSnapshots(windowResult, windowDetail) {
  const playerStatuses = mergeWindowPlayerStatuses(windowResult?.qualStatus, windowDetail?.playerQual);
  const prizeHighlights = buildPrizeHighlights(windowDetail?.prizes);
  const prizeCount = Array.isArray(windowDetail?.prizes) ? windowDetail.prizes.length : 0;
  const qualifiedPlayers = playerStatuses.filter((player) => player.isQualified).length;
  const labeledPlayers = playerStatuses.filter((player) => player.labels.length > 0).length;
  const qualificationCount = Math.max(qualifiedPlayers, labeledPlayers);

  return {
    type: repairText(windowDetail?.type) || "",
    description: repairText(windowDetail?.description) || "",
    matchCap: typeof windowDetail?.matchCap === "number" ? windowDetail.matchCap : null,
    leaderboardId: normalizeSimpleString(windowDetail?.leaderboardId),
    requiresQualification: Boolean(windowDetail?.requiresQualification),
    prizeCount,
    scoreRuleCount: Array.isArray(windowDetail?.scoreRules) ? windowDetail.scoreRules.length : 0,
    prizeHighlights,
    qualificationCount,
    qualificationSummary: buildQualificationSummary(playerStatuses, qualificationCount),
    playerStatuses,
    hasResultConnection: Boolean(windowResult),
    hasDetailConnection: Boolean(windowDetail),
    hasWindowConnection: Boolean(windowResult || windowDetail)
  };
}

function mergeWindowPlayerStatuses(qualStatusEntries, playerQualEntries) {
  const mergedStatuses = new Map();

  for (const entry of qualStatusEntries || []) {
    const key = getWindowPlayerStatusKey(entry?.accountId, entry?.name);

    if (!key) {
      continue;
    }

    mergedStatuses.set(key, {
      accountId: normalizeSimpleString(entry?.accountId),
      name: repairText(entry?.name) || "Joueur suivi",
      labels: Array.isArray(entry?.labels)
        ? entry.labels.map((label) => repairText(label)).filter(Boolean)
        : [],
      isQualified: false
    });
  }

  for (const entry of playerQualEntries || []) {
    const key = getWindowPlayerStatusKey(entry?.accountId, entry?.playerName);

    if (!key) {
      continue;
    }

    const current = mergedStatuses.get(key) || {
      accountId: "",
      name: repairText(entry?.playerName) || "Joueur suivi",
      labels: [],
      isQualified: false
    };

    mergedStatuses.set(key, {
      ...current,
      name: repairText(entry?.playerName) || current.name,
      isQualified: Boolean(entry?.isThisPlayerQual)
    });
  }

  return Array.from(mergedStatuses.values()).sort((left, right) => {
    if (left.isQualified !== right.isQualified) {
      return left.isQualified ? -1 : 1;
    }

    if (left.labels.length !== right.labels.length) {
      return right.labels.length - left.labels.length;
    }

    return left.name.localeCompare(right.name);
  });
}

function getWindowPlayerStatusKey(accountId, name) {
  const normalizedAccountId = normalizeSimpleString(accountId);

  if (normalizedAccountId) {
    return normalizedAccountId;
  }

  return repairText(name).toLowerCase().trim();
}

function buildPrizeHighlights(prizes) {
  return (prizes || [])
    .filter(isObject)
    .map((prize) => {
      const threshold = prize.threshold === undefined || prize.threshold === null ? "" : String(prize.threshold);
      const scoringType = repairText(prize.scoringType) || "Condition";
      const rewardType = repairText(prize.rewardType) || "Reward";
      const value = repairText(prize.value);
      const quantity = typeof prize.quantity === "number" && prize.quantity > 0 ? `x${prize.quantity}` : "";
      const reward = [rewardType, value, quantity].filter(Boolean).join(" - ");

      if (threshold && reward) {
        return `${scoringType} ${threshold} -> ${reward}`;
      }

      return reward || [scoringType, threshold].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .slice(0, 6);
}

function buildQualificationSummary(playerStatuses, qualificationCount) {
  if (playerStatuses.length === 0) {
    return "Aucun joueur suivi dans les snapshots results/window.";
  }

  if (qualificationCount === 0) {
    return `${playerStatuses.length} joueur(s) suivis, aucune qualification ou label detecte.`;
  }

  return `${qualificationCount}/${playerStatuses.length} joueur(s) avec qualification ou label sur cette fenetre.`;
}

async function materializeTeamConfig(config) {
  return {
    ...config,
    players: config.players.map((player) => ({
      ...player,
      image: normalizeRemoteAssetSource(player.image) || normalizeRemoteAssetSource(player.imageSource) || player.image,
      countryFlag:
        normalizeRemoteAssetSource(player.countryFlag) ||
        normalizeRemoteAssetSource(player.countryFlagSource) ||
        player.countryFlag
    }))
  };
}

async function persistTeamConfig(config, previousConfig = { players: [] }) {
  const previousPlayers = new Map(
    (previousConfig.players || []).map((player) => [normalizeSimpleString(player.accountId), player])
  );

  return {
    ...config,
    players: await Promise.all(
      config.players.map(async (player) => {
        const previousPlayer = previousPlayers.get(normalizeSimpleString(player.accountId)) || {};
        const imageSource = pickAssetSource(player.image, player.imageSource, previousPlayer.imageSource);
        const countryFlagSource = pickAssetSource(
          player.countryFlag,
          player.countryFlagSource,
          previousPlayer.countryFlagSource
        );

        return {
          ...player,
          image: await storeDashboardImage(imageSource || player.image, {
            namespace: "players",
            assetKey: player.accountId || player.name,
            label: player.name || "Player",
            variant: "players"
          }),
          imageSource,
          countryFlag: await storeDashboardImage(countryFlagSource || player.countryFlag, {
            namespace: "flags",
            assetKey: player.country || player.accountId,
            label: player.country || "EU",
            variant: "flags"
          }),
          countryFlagSource
        };
      })
    )
  };
}

async function materializeActuConfig(config) {
  return Promise.all(
    config.map(async (item) => ({
      ...item,
      image: await resolveDashboardImage(item.image, {
        namespace: "actu",
        assetKey: item.id || item.name,
        label: item.name || "Actu",
        variant: "actu"
      })
    }))
  );
}

async function persistActuConfig(config) {
  return Promise.all(
    config.map(async (item) => ({
      ...item,
      image: await storeDashboardImage(item.image, {
        namespace: "actu",
        assetKey: item.id || item.name,
        label: item.name || "Actu",
        variant: "actu"
      })
    }))
  );
}

async function cleanupRemovedActuAssets(previousConfig, nextConfig) {
  const previousImages = new Set(
    (previousConfig || [])
      .map((item) => normalizeSimpleString(item?.image))
      .filter((image) => image.startsWith("/dashboard-assets/actu/"))
  );
  const nextImages = new Set(
    (nextConfig || [])
      .map((item) => normalizeSimpleString(item?.image))
      .filter((image) => image.startsWith("/dashboard-assets/actu/"))
  );

  for (const imagePath of previousImages) {
    if (nextImages.has(imagePath)) {
      continue;
    }

    await removeDashboardAsset(imagePath);
  }
}

function buildSummaryCards(events, trackedPlayers, recentResults, actu, tournamentFilter, sourceCards) {
  const liveCount = events.filter((event) => event.status === "live").length;
  const upcomingCount = events.filter((event) => event.status === "upcoming").length;

  return [
    {
      label: "Sources locales",
      value: `${sourceCards.filter((source) => source.exists).length}/${sourceCards.length}`,
      hint: "Fichiers presents dans server/data"
    },
    {
      label: "Events live / a venir",
      value: `${liveCount} / ${upcomingCount}`,
      hint: "Deduits de home.json et calendrier.json"
    },
    {
      label: "Joueurs suivis",
      value: String(trackedPlayers.length),
      hint: "Issus de players.json et team.json"
    },
    {
      label: "Derniers resultats",
      value: String(recentResults.length),
      hint: "Derniere perf classee par joueur"
    },
    {
      label: "Actus",
      value: String(actu.length),
      hint: "Cartes locales affichees"
    },
    {
      label: "Filtre tournoi",
      value: String(tournamentFilter.acceptedEventIds.length),
      hint: "EventId(s) conserves en config"
    }
  ];
}

function buildNotes(events, trackedPlayers, actu, sourceCards, casts, generatedAt) {
  const liveCount = events.filter((event) => event.status === "live").length;
  const missingSources = sourceCards.filter((source) => !source.exists).length;
  const castWindowCount = new Set(casts.map((cast) => cast.windowId || "__fallback__")).size;

  return [
    "Dashboard branche uniquement sur les fichiers locaux de server/data.",
    "La logique region a ete retiree: on considere uniquement EU.",
    `${liveCount} event(s) live detecte(s), ${trackedPlayers.length} joueur(s) suivi(s), ${actu.length} actu locale(s).`,
    casts.length > 0
      ? `${casts.length} canal(aux) de cast sur ${castWindowCount} windowId(s).`
      : "Aucun canal de cast configure.",
    missingSources > 0
      ? `${missingSources} source(s) manque(nt) encore dans le dossier data.`
      : `Toutes les sources principales sont presentes au ${formatShortDateTime(generatedAt)}.`
  ];
}

function buildSourceCards(base) {
  return SOURCE_DEFINITIONS.map((definition) => {
    const absolutePath = path.join(DATA_ROOT, definition.relativePath);
    const exists = fs.existsSync(absolutePath);
    const updatedAt = exists ? fs.statSync(absolutePath).mtime.toISOString() : null;

    return {
      id: definition.id,
      label: definition.label,
      path: toDisplayPath(definition.relativePath),
      exists,
      statusLabel: exists ? "Present" : "Absent",
      updatedAtLabel: exists ? formatShortDateTime(updatedAt) : "Fichier manquant",
      detail: definition.describe(base)
    };
  });
}

function buildTournamentOptions(events, tournamentFilter) {
  const acceptedIds = new Set(tournamentFilter.acceptedEventIds || []);
  const options = new Map();

  for (const event of events || []) {
    const eventId = normalizeSimpleString(event.id || event.eventId || event.tournamentId);

    if (!eventId) {
      continue;
    }

    const windows = Array.isArray(event.windows) ? event.windows : [];
    const current = options.get(eventId) || {
      eventId,
      name: event.name || eventId,
      windows: 0,
      modes: new Set(),
      accepted: acceptedIds.has(eventId)
    };

    current.windows += Math.max(windows.length, 1);
    current.name = current.name || event.name || eventId;

    for (const windowEntry of windows) {
      const mode = normalizeMode(windowEntry?.mode);

      if (mode && mode !== "Mode inconnu") {
        current.modes.add(mode);
      }
    }

    if (current.modes.size === 0) {
      const fallbackMode = normalizeMode(event.mode);

      if (fallbackMode && fallbackMode !== "Mode inconnu") {
        current.modes.add(fallbackMode);
      }
    }

    current.accepted = acceptedIds.has(eventId);
    options.set(eventId, current);
  }

  return Array.from(options.values())
    .map((option) => ({
      eventId: option.eventId,
      name: option.name,
      windows: option.windows,
      modes: Array.from(option.modes).sort((left, right) => left.localeCompare(right)),
      accepted: option.accepted
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function createAcceptedEventIdSet(acceptedEventIds) {
  return new Set((acceptedEventIds || []).map((eventId) => normalizeSimpleString(eventId)).filter(Boolean));
}

function filterDashboardEvents(events, acceptedEventIds) {
  return (events || []).filter((event) => isAcceptedTournamentId(event.tournamentId, acceptedEventIds));
}

function filterTournamentHistory(history, acceptedEventIds) {
  return (history || []).filter((entry) => isAcceptedTournamentId(entry?.tournamentId, acceptedEventIds));
}

function isAcceptedTournamentId(tournamentId, acceptedEventIds) {
  const normalizedTournamentId = normalizeSimpleString(tournamentId);

  if (!normalizedTournamentId) {
    return false;
  }

  if (!(acceptedEventIds instanceof Set)) {
    return true;
  }

  if (acceptedEventIds.size === 0) {
    return false;
  }

  return acceptedEventIds.has(normalizedTournamentId);
}

function buildCastWindowOptions(events) {
  const options = new Map();

  for (const event of events || []) {
    const eventId = normalizeSimpleString(event.id || event.eventId || event.tournamentId);
    const eventName = repairText(event.name) || eventId || "Event";
    const windows = Array.isArray(event.windows) && event.windows.length > 0 ? event.windows : [event];

    for (const windowEntry of windows) {
      const windowId = normalizeSimpleString(windowEntry?.windowId || windowEntry?.id);

      if (!windowId) {
        continue;
      }

      const start = windowEntry?.start || event.start || null;
      const end = windowEntry?.end || event.end || null;
      const mode = normalizeMode(windowEntry?.mode || event.mode);
      const teamFormat = repairText(windowEntry?.teamFormat || event.teamFormat) || "Format inconnu";

      options.set(windowId, {
        windowId,
        eventId,
        eventName,
        windowName: formatCastWindowLabel(windowId, eventName),
        mode,
        teamFormat,
        start,
        end,
        timeLabel: formatEventRange(start, end),
        status: deriveEventStatus(start, end),
        statusLabel: formatEventStatus(deriveEventStatus(start, end))
      });
    }
  }

  return Array.from(options.values()).sort((left, right) => {
    const timeDelta = compareIsoDates(right.start, left.start);

    if (timeDelta !== 0) {
      return timeDelta;
    }

    return left.windowName.localeCompare(right.windowName);
  });
}

function buildCastCards(castConfig, castWindowLookup = new Map()) {
  const entries = Array.isArray(castConfig?.entries) ? castConfig.entries : [];

  return entries
    .flatMap((entry) =>
      ["youtube", "twitch"].map((platform) => {
        const channel = entry?.[platform];

        if (!channel?.channelName && !channel?.link) {
          return null;
        }

        const windowMeta = castWindowLookup.get(entry.windowId) || null;

        return {
          id: `${entry.windowId || "fallback"}-${platform}`,
          platform,
          windowId: entry.windowId || "",
          eventId: windowMeta?.eventId || "",
          eventName: windowMeta?.eventName || "",
          windowName: windowMeta?.windowName || formatCastWindowLabel(entry.windowId, windowMeta?.eventName),
          timeLabel: windowMeta?.timeLabel || "",
          label: platform === "youtube" ? "YouTube" : "Twitch",
          channelName: channel.channelName || "Canal sans nom",
          link: channel.link || ""
        };
      })
    )
    .filter(Boolean)
    .sort((left, right) => {
      if (left.windowId === right.windowId) {
        return left.label.localeCompare(right.label);
      }

      if (!left.windowId) {
        return 1;
      }

      if (!right.windowId) {
        return -1;
      }

      return left.windowName.localeCompare(right.windowName);
    });
}

function countPlayersForEvent(playersData, windowId, tournamentId) {
  let total = 0;

  for (const player of playersData) {
    const history = Array.isArray(player.lastTournaments) ? player.lastTournaments : [];
    const matched = history.some((entry) => {
      const entryWindowId = normalizeSimpleString(entry?.windowId);
      const entryTournamentId = normalizeSimpleString(entry?.tournamentId);
      return entryWindowId === windowId || entryTournamentId === tournamentId;
    });

    if (matched) {
      total += 1;
    }
  }

  return total;
}

function findBestRankForEvent(playersData, windowId, tournamentId) {
  let bestRank = null;

  for (const player of playersData) {
    const history = Array.isArray(player.lastTournaments) ? player.lastTournaments : [];

    for (const entry of history) {
      const entryWindowId = normalizeSimpleString(entry?.windowId);
      const entryTournamentId = normalizeSimpleString(entry?.tournamentId);
      const rank = entry?.result?.rank;

      if (typeof rank !== "number") {
        continue;
      }

      if (entryWindowId !== windowId && entryTournamentId !== tournamentId) {
        continue;
      }

      if (bestRank === null || rank < bestRank) {
        bestRank = rank;
      }
    }
  }

  return bestRank;
}

function findBestRank(history) {
  return history.reduce((bestRank, entry) => {
    const rank = entry?.result?.rank;

    if (typeof rank !== "number") {
      return bestRank;
    }

    if (bestRank === null || rank < bestRank) {
      return rank;
    }

    return bestRank;
  }, null);
}

function buildEventSummary(status, trackedPlayers, bestRankValue) {
  const bestRank = typeof bestRankValue === "number" ? `#${bestRankValue}` : "aucun classement";

  if (status === "live") {
    return `${trackedPlayers} joueur(s) suivi(s), meilleur rang connu ${bestRank}.`;
  }

  if (status === "upcoming") {
    return `${trackedPlayers} joueur(s) ont deja un historique local sur ce type de fenetre.`;
  }

  return `Fenetre archivee, meilleur rang local ${bestRank}.`;
}

function stripEventInternals(event) {
  const { start, end, tournamentId, windowId, ...publicEvent } = event;
  return publicEvent;
}

function stripPlayerInternals(player) {
  const { _latestEntry, ...publicPlayer } = player;
  return publicPlayer;
}

function normalizeTeamConfig(value) {
  const players = Array.isArray(value?.players) ? value.players : [];

  return {
    description: normalizeSimpleString(value?.description) || "Liste locale des joueurs suivis.",
    players: players
      .filter(isObject)
      .map((player) => ({
        accountId: normalizeSimpleString(player.accountId),
        name: repairText(player.name),
        image: normalizeSimpleString(player.image),
        imageSource: normalizeRemoteAssetSource(player.imageSource),
        country: repairText(player.country),
        countryFlag: normalizeSimpleString(player.countryFlag),
        countryFlagSource: normalizeRemoteAssetSource(player.countryFlagSource)
      }))
      .filter((player) => player.accountId)
  };
}

function pickAssetSource(value, explicitSource, previousSource) {
  const directSource = normalizeRemoteAssetSource(value);

  if (directSource) {
    return directSource;
  }

  const normalizedExplicitSource = normalizeRemoteAssetSource(explicitSource);

  if (normalizedExplicitSource) {
    return normalizedExplicitSource;
  }

  if (isDashboardAssetReference(value)) {
    return normalizeRemoteAssetSource(previousSource);
  }

  return "";
}

function normalizeTournamentFilter(value) {
  const acceptedEventIds = Array.isArray(value?.acceptedEventIds) ? value.acceptedEventIds : [];

  return {
    description: normalizeSimpleString(value?.description) || "Liste locale des eventId retenus.",
    acceptedEventIds: Array.from(
      new Set(
        acceptedEventIds
          .map((entry) => normalizeSimpleString(entry))
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right))
  };
}

function normalizeActuConfig(value) {
  const items = Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];

  return items
    .filter(isObject)
    .map((item, index) => ({
      id: normalizeSimpleString(item.id) || `actu-${index + 1}`,
      name: repairText(item.name) || "",
      image: normalizeSimpleString(item.image),
      date: normalizeDateField(item.date),
      dateLabel: formatDate(item.date),
      description: repairText(item.description),
      link: normalizeSimpleString(item.moreInfoLink || item.link)
    }))
    .filter((item) => item.name || item.image || item.date || item.description || item.link)
    .sort((left, right) => compareIsoDates(right.date, left.date));
}

function normalizeCastConfig(value) {
  const rawEntries = Array.isArray(value) ? value : Array.isArray(value?.entries) ? value.entries : [];
  const normalizedEntries = rawEntries.filter(isObject).map(normalizeCastEntry);

  if (
    normalizedEntries.length === 0 &&
    (isObject(value?.youtube) || isObject(value?.twitch))
  ) {
    normalizedEntries.push(
      normalizeCastEntry({
        windowId: "",
        youtube: value?.youtube,
        twitch: value?.twitch
      })
    );
  }

  const mergedEntries = new Map();

  for (const entry of normalizedEntries) {
    const windowId = normalizeSimpleString(entry.windowId);
    const current = mergedEntries.get(windowId) || createEmptyCastEntry(windowId);

    mergedEntries.set(windowId, {
      windowId,
      youtube: mergeCastChannel(current.youtube, entry.youtube),
      twitch: mergeCastChannel(current.twitch, entry.twitch)
    });
  }

  return {
    entries: Array.from(mergedEntries.values())
      .filter(hasConfiguredCastChannels)
      .sort((left, right) => {
        if (!left.windowId) {
          return 1;
        }

        if (!right.windowId) {
          return -1;
        }

        return left.windowId.localeCompare(right.windowId);
      })
  };
}

function normalizeCastEntry(value) {
  return {
    windowId: normalizeSimpleString(value?.windowId),
    youtube: normalizeCastChannel(value?.youtube),
    twitch: normalizeCastChannel(value?.twitch)
  };
}

function normalizeCastChannel(value) {
  return {
    channelName: repairText(value?.channelName),
    link: normalizeSimpleString(value?.link)
  };
}

function createEmptyCastEntry(windowId = "") {
  return {
    windowId: normalizeSimpleString(windowId),
    youtube: normalizeCastChannel(),
    twitch: normalizeCastChannel()
  };
}

function mergeCastChannel(current, next) {
  return {
    channelName: next?.channelName || current?.channelName || "",
    link: next?.link || current?.link || ""
  };
}

function hasConfiguredCastChannels(entry) {
  return ["youtube", "twitch"].some((platform) => {
    const channel = entry?.[platform];
    return Boolean(channel?.channelName || channel?.link);
  });
}

function countConfiguredCastChannels(castConfig) {
  const entries = Array.isArray(castConfig?.entries) ? castConfig.entries : [];

  return entries.reduce((total, entry) => {
    return total + ["youtube", "twitch"].filter((platform) => {
      const channel = entry?.[platform];
      return Boolean(channel?.channelName || channel?.link);
    }).length;
  }, 0);
}

function countConfiguredCastWindows(castConfig) {
  const entries = Array.isArray(castConfig?.entries) ? castConfig.entries : [];
  return entries.filter(hasConfiguredCastChannels).length;
}

function formatCastWindowLabel(windowId, eventName) {
  const normalizedWindowId = normalizeSimpleString(windowId);
  const normalizedEventName = stripKnownWindowSuffix(repairText(eventName));

  if (!normalizedWindowId) {
    return "Fallback global";
  }

  if (!normalizedEventName) {
    return normalizedWindowId;
  }

  const suffix = getWindowSuffix(normalizedWindowId);

  if (!suffix || normalizedEventName.includes(suffix)) {
    return normalizedEventName;
  }

  return `${normalizedEventName} ${suffix}`.trim();
}

function formatWindowName(entry) {
  if (!entry) {
    return "Event inconnu";
  }

  const baseName = stripKnownWindowSuffix(repairText(entry.tournamentName || entry.name)) || "Tournament";
  const suffix = getWindowSuffix(normalizeSimpleString(entry.windowId));

  if (!suffix || baseName.includes(suffix)) {
    return baseName;
  }

  return `${baseName} ${suffix}`.trim();
}

function deriveEventStatus(start, end) {
  if (isLiveWindow(start, end)) {
    return "live";
  }

  if (start && new Date(start).getTime() > Date.now()) {
    return "upcoming";
  }

  return "review";
}

function getStatusPriority(status) {
  if (status === "live") return 3;
  if (status === "upcoming") return 2;
  return 1;
}

function sortEvents(left, right) {
  const priorityDelta = getStatusPriority(right.status) - getStatusPriority(left.status);

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  if (left.status === "review" || right.status === "review") {
    return compareIsoDates(right.start, left.start);
  }

  return compareIsoDates(left.start, right.start) || left.name.localeCompare(right.name);
}

function formatEventStatus(status) {
  if (status === "live") return "Live";
  if (status === "upcoming") return "A venir";
  return "Archive";
}

function formatPlayerStatus(status) {
  if (status === "live") return "Live";
  if (status === "recent") return "Recent";
  return "Archive";
}

function formatEventRange(start, end) {
  if (!start && !end) {
    return "--";
  }

  return `${formatShortDateTime(start)} -> ${formatShortDateTime(end)}`;
}

function formatCountdown(status, start, end) {
  if (status === "live") {
    return `En direct jusqu'a ${formatHour(end)}`;
  }

  if (status === "review") {
    return "Termine";
  }

  if (!start) {
    return "--";
  }

  const diff = new Date(start).getTime() - Date.now();

  if (diff <= 0) {
    return "Bientot";
  }

  const totalMinutes = Math.round(diff / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `Dans ${minutes} min`;
  }

  if (minutes === 0) {
    return `Dans ${hours}h`;
  }

  return `Dans ${hours}h ${minutes}`;
}

function formatDate(value) {
  if (!value) {
    return "Date inconnue";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Date inconnue";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Zurich"
  }).format(parsedDate);
}

function formatHour(value) {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Zurich"
  }).format(parsedDate);
}

function formatShortDateTime(value) {
  if (!value) {
    return "--";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Zurich"
  }).format(parsedDate);
}

function normalizeMode(value) {
  const normalizedValue = repairText(value);

  if (!normalizedValue) {
    return "Mode inconnu";
  }

  if (normalizedValue === "Ranked Battle Royale") {
    return "Battle Royale";
  }

  return normalizedValue;
}

function normalizeDateField(value) {
  const normalizedValue = normalizeSimpleString(value);

  if (!normalizedValue) {
    return "";
  }

  const shortDateMatch = normalizedValue.match(/^\d{4}-\d{2}-\d{2}/);

  if (shortDateMatch) {
    return shortDateMatch[0];
  }

  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().slice(0, 10);
}

function repairText(value) {
  const text = normalizeSimpleString(value);

  if (!text) {
    return "";
  }

  if (!text.includes("\u00c3") && !text.includes("\u00c2")) {
    return text;
  }

  try {
    return Buffer.from(text, "latin1").toString("utf8");
  } catch (error) {
    return text;
  }
}

function toDisplayPath(relativePath) {
  return path.join("server", "data", relativePath).replaceAll("\\", "/");
}

function normalizeSimpleString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRemoteAssetSource(value) {
  const normalizedValue = normalizeSimpleString(value);
  return /^https?:\/\//i.test(normalizedValue) ? normalizedValue : "";
}

function isDashboardAssetReference(value) {
  return normalizeSimpleString(value).replaceAll("\\", "/").includes("dashboard-assets/");
}

function compareIsoDates(left, right) {
  const leftTime = left ? new Date(left).getTime() : 0;
  const rightTime = right ? new Date(right).getTime() : 0;
  return leftTime - rightTime;
}

function compareRankLabels(left, right) {
  const leftValue = extractRankValue(left);
  const rightValue = extractRankValue(right);

  if (leftValue === null && rightValue === null) {
    return 0;
  }

  if (leftValue === null) {
    return 1;
  }

  if (rightValue === null) {
    return -1;
  }

  return leftValue - rightValue;
}

function extractRankValue(value) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function isLiveWindow(start, end) {
  if (!start || !end) {
    return false;
  }

  const now = Date.now();
  return now >= new Date(start).getTime() && now <= new Date(end).getTime() + 25 * 60 * 1000;
}

async function loadOptionalNormalizedData(relativePath) {
  const absolutePath = path.join(DATA_ROOT, relativePath);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  if (fs.statSync(absolutePath).size === 0) {
    return null;
  }

  return loadNormalizedData(relativePath);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
  getDashboardPayload,
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

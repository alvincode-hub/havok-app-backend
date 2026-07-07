const { loadConfigData } = require("../storage/configStore.js");
const { loadNormalizedData } = require("../storage/normalizedStore.js");
const { normalizedTournamentsPath, normalizedTournamentResultsPath } = require("../storage/paths.js");
const { findPlayersResultInLocation } = require("../services/leaderboardIndex.service.js");
const { loadAcceptedEventIds, isEventAccepted } = require("../services/filterEvents.js");
const { isOlderThan15Days } = require("../utils/dates.js");
const { getWindowSuffix } = require("../utils/windowSuffix.js");
const { enrichResult, getResultLabels } = require("../utils/resultLabels.js");
const fs = require("fs");
const path = require("path");

const RESULTS_MAX_SIZE = 50;
const PAGE_SIZE = 10;

async function enrichedResults() {
  const tournaments = (await loadNormalizedData(normalizedTournamentsPath())) || [];
  const playerConfig = await loadConfigData("config/team.json");
  const acceptedEventIds = await loadAcceptedEventIds();

  if (!playerConfig?.players || playerConfig.players.length === 0) {
    return [];
  }

  const results = [];

  for (const tournament of tournaments) {
    if (!(await isEventAccepted(tournament.id, acceptedEventIds))) {
      continue;
    }

    for (const window of tournament.windows || []) {
      const tournamentName = `${tournament.name} ${getWindowSuffix(window.windowId)}`.trim();
      if (!window.scoreLocations) {
        continue;
      }

      const leaderboardIndex = getMainLeaderboard(window.scoreLocations);

      if (leaderboardIndex === -1) {
        continue;
      }

      const leaderboardLocation = window.resolvedLocations?.[leaderboardIndex];

      if (!leaderboardLocation) {
        continue;
      }

      const cumulatifIndex = getCumulLeaderboard(window.resolvedLocations);

      const payload = await loadNormalizedResultPageIfExists(leaderboardLocation);

      if (!payload?.results) {
        continue;
      }

      const players = buildTrackedPlayers(playerConfig.players);
      const leaderboardQualStatus = await buildLeaderboardQualStatus(
        leaderboardLocation,
        players,
        window
      );
      const leaderboard = buildLeaderboardPages(payload, window, {
        qualStatus: leaderboardQualStatus
      });

      let leaderboardCumul = null;

      if (cumulatifIndex !== -1) {
        const cumulatifLocation = window.resolvedLocations?.[cumulatifIndex];

        if (cumulatifLocation) {
          const payloadCumul = await loadNormalizedResultPageIfExists(cumulatifLocation);

          if (payloadCumul?.results) {
            const leaderboardCumulQualStatus = await buildLeaderboardQualStatus(
              cumulatifLocation,
              players,
              window
            );
            leaderboardCumul = buildLeaderboardPages(payloadCumul, window, {
              totalPagesKey: "totalPagesCumul",
              pagesKey: "pagesCumul",
              qualStatus: leaderboardCumulQualStatus
            });
          }
        }
      }

      results.push({
        tournamentId: tournament.id || null,
        tournamentName: tournamentName || tournament.name || null,
        windowId: window.windowId || null,
        start: window.start || null,
        end: window.end || null,
        players,
        leaderboard,
        leaderboardCumul
      });
    }
  }

  return results;
}

async function loadNormalizedResultPageIfExists(resolvedLocation) {
  const relativePath = normalizedTournamentResultsPath(resolvedLocation, 0);
  const absolutePath = path.join(__dirname, "../../data", relativePath);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return loadNormalizedData(relativePath);
}

function buildLeaderboardPages(payload, window, options = {}) {
  const {
    totalPagesKey = "totalPages",
    pagesKey = "pages",
    qualStatus = []
  } = options;
  const windowResults = enrichLeaderboardResults(payload?.results, window);
  const totalPages = Math.ceil(windowResults.length / PAGE_SIZE);
  const pages = [];

  for (let page = 0; page < totalPages; page += 1) {
    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE;

    pages.push(windowResults.slice(start, end));
  }

  return {
    id: payload?.id || null,
    windowId: payload?.windowId || null,
    qualStatus,
    [totalPagesKey]: totalPages,
    [pagesKey]: pages
  };
}

function buildTrackedPlayers(players) {
  return (Array.isArray(players) ? players : []).map((player) => {
    return {
      accountId: player?.accountId || null,
      name: player?.name || null,
      image: player?.image || null
    };
  }).filter((player) => player.accountId);
}

async function buildLeaderboardQualStatus(resolvedLocation, players, window) {
  const playerIds = players.map((player) => player.accountId).filter(Boolean);
  const playerResults = await findPlayersResultInLocation(resolvedLocation, playerIds);

  return players.map((player, index) => {
    const playerResult = playerResults[index] || null;

    if (!playerResult) {
      return null;
    }

    return {
      accountId: player.accountId,
      name: player.name || null,
      image: player.image || null,
      labels: getResultLabels(playerResult, window),
      rank: playerResult?.rank ?? null,
      points: playerResult?.points ?? null
    };
  }).filter(Boolean);
}

function enrichLeaderboardResults(results, window) {
  return (Array.isArray(results) ? results : [])
    .slice(0, RESULTS_MAX_SIZE)
    .map((result) => enrichResult(result, window));
}

function getMainLeaderboard(scoreLocations) {
  return scoreLocations.findIndex((el) => {
    return el.isMainWindowLeaderboard === true;
  });
}

function getCumulLeaderboard(resolvedLocations) {
  return (resolvedLocations || []).findIndex((location) => {
    return location.includes("Fortnite:cumulative:");
  });
}

module.exports = { enrichedResults };

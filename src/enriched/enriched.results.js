const { loadConfigData } = require("../storage/configStore.js");
const { loadNormalizedData } = require("../storage/normalizedStore.js");
const { normalizedTournamentsPath, normalizedTournamentResultsPath } = require("../storage/paths.js");
const { findPlayersResultInLocation } = require("../services/leaderboardIndex.service.js");
const { loadAcceptedEventIds, isEventAccepted } = require("../services/filterEvents.js");
const { isOlderThan15Days } = require("../utils/dates.js");
const { getWindowSuffix } = require("../utils/windowSuffix.js");
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

      if (isOlderThan15Days(window.end)) {
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
    .map((result) => {
      return {
        ...result,
        labels: getResultLabels(result, window),
        rankLabel: getRankLabel(result?.rank),
        pointsLabel: getPointsLabel(result?.points)
      };
    });
}

const LABEL = {
  ecomm_true: "Cash",
  token_true: "Qual",
};

function getResultLabels(result, window) {
  if (!result) {
    return [];
  }

  const prizes = window?.prizes || [];
  const points = typeof result?.points === "number" ? result.points : null;
  const rank = typeof result?.rank === "number" ? result.rank : null;
  const hasCompetitiveResult =
    (typeof points === "number" && points > 0) ||
    (typeof rank === "number" && rank > 0);
  const labels = new Set();

  for (const prize of prizes) {
    let key = "";

    if (
      prize.rewardType === "token" &&
      prize.scoringType === "value" &&
      Number(prize.threshold) === 0 &&
      !hasCompetitiveResult
    ) {
      continue;
    }

    if (prize.scoringType === "rank" && rank !== null) {
      key = `${prize.rewardType}_${rank <= prize.threshold}`;
    } else if (prize.scoringType === "value" && points !== null) {
      key = `${prize.rewardType}_${points >= prize.threshold}`;
    } else if (prize.scoringType === "percentile") {
      continue;
    }

    const label = LABEL[key] || null;

    if (label) {
      labels.add(label);
    }
  }

  return [...labels];
}

function getRankLabel(rank) {
  return typeof rank === "number" ? `#${rank}` : null;
}

function getPointsLabel(points) {
  return typeof points === "number" ? `${points} pts` : null;
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

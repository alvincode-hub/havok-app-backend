const { loadConfigData } = require("../storage/configStore.js");
const { loadNormalizedData } = require("../storage/normalizedStore.js");
const { normalizedTournamentsPath, normalizedTournamentResultsPath } = require("../storage/paths.js");
const { findPlayerTop } = require("../services/findPlayersTop.js");
const { loadAcceptedEventIds, isEventAccepted } = require("../services/filterEvents.js");
const { isOlderThan15Days } = require("../utils/dates.js");
const { getWindowSuffix } = require("../utils/windowSuffix.js");
const fs = require("fs");
const path = require("path");

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

      const leaderboard = await loadNormalizedResultPageIfExists(leaderboardLocation);

      let cumulatif = null;

      if (cumulatifIndex !== -1) {
        const cumulatifLocation = window.resolvedLocations?.[cumulatifIndex];

        if (cumulatifLocation) {
          cumulatif = await loadNormalizedResultPageIfExists(cumulatifLocation);
        }
      }

      const qualStatus = [];

      for (const player of playerConfig.players) {
        const playerResult = await findPlayerTop(player.accountId, window);

        qualStatus.push({
          accountId: player.accountId,
          name: player.name || null,
          image: player.image || null,
          labels: getPlayerLabels(playerResult, window)
        });
      }

      results.push({
        tournamentId: tournament.id || null,
        tournamentName: tournamentName || tournament.name || null,
        windowId: window.windowId || null,
        start: window.start || null,
        end: window.end || null,
        leaderboard,
        cumulatif,
        qualStatus
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

const LABEL = {
  ecomm_true: "Cash",
  token_true: "Qual",
};

function getPlayerLabels(result, window) {
  if (!result) {
    return [];
  }

  const prizes = window?.prizes || [];
  const points = result.points || 0;
  const rank = result.rank || 0;
  const labels = new Set();

  for (const prize of prizes) {
    let key = "";

    if (prize.scoringType === "rank") {
      key = `${prize.rewardType}_${rank <= prize.threshold}`;
    } else if (prize.scoringType === "value") {
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

function getMainLeaderboard(scoreLocations) {
  return scoreLocations.findIndex((el) => {
    return el.isMainWindowLeaderboard === true;
  });
}

function getCumulLeaderboard(resolvedLocations) {
  return resolvedLocations.findIndex((location) => {
    return location.includes("Fortnite:cumulative:");
  });
}

module.exports = { enrichedResults };

const fs = require("fs");
const path = require("path");

const { loadConfigData } = require("../storage/configStore.js");
const { loadNormalizedData } = require("../storage/normalizedStore.js");
const { loadRawData } = require("../storage/rawStore.js");
const {
  normalizedTournamentScoreRulesPath,
  rawTournamentScoreRulesPath,
  normalizedTournamentsPath,
} = require("../storage/paths.js");
const { isPlayerQual } = require("../services/isPlayerQual.js");
const {
  loadAcceptedEventIds,
  isEventAccepted,
} = require("../services/filterEvents.js");
const {
  getWindowSuffix,
  stripKnownWindowSuffix,
} = require("../utils/windowSuffix.js");

async function enrichedWindowDetail() {
  const tournaments = (await loadNormalizedData(normalizedTournamentsPath())) || [];
  const playerConfig = await loadConfigData("config/team.json");
  const acceptedEventIds = await loadAcceptedEventIds();
  const configuredPlayers = playerConfig?.players || [];
  const qualificationTargets = buildQualificationTargetMap(tournaments);
  const windows = [];

  for (const tournament of tournaments) {
    if (!(await isEventAccepted(tournament.id, acceptedEventIds))) {
      continue;
    }

    for (const window of tournament.windows || []) {
      const prizes = (window.prizes || []).map((prize) => {
      const rawRewardType = prize.rewardType || null;
      const value = prize.value || null;

      const rewardType =
        rawRewardType === "ecomm"
          ? "cash"
          : rawRewardType === "token"
            ? "qualif"
            : rawRewardType;

      const rewardTypeDisplayName =
        rewardType === "cash"
          ? "Cash"
          : rewardType === "qualif"
            ? "Qualification"
            : prize.rewardTypeDisplayName || null;

      const qualificationTarget =
        rewardType === "qualif" && value
          ? qualificationTargets.get(String(value)) || null
          : null;

      const qualificationWindowName =
        rewardType === "qualif" && value
          ? qualificationTarget?.windowName || buildWindowName(tournament.name, value)
          : null;

      return {
        scoringTypeDisplayName: prize.scoringTypeDisplayName || null,
        threshold: prize.threshold ?? null,
        rewardTypeDisplayName,
        value,
        qualificationWindowName,
        quantity: prize.quantity ?? null,
      };
    });

      const playerQual = [];

      for (const player of configuredPlayers) {
        playerQual.push({
          accountId: player.accountId || null,
          playerName: player.name || null,
          image: player.image || null,
          isThisPlayerQual: await isPlayerQual(player.accountId, window),
        });
      }

      let scoreRules = null;

      for (const leaderboard of window.scoreLocations || []) {
        const leaderboardId = leaderboard.leaderboardDefId;
        const rawScoreRules = await loadRawData(rawTournamentScoreRulesPath());
        const scoreRuleId = getScoreRuleId(leaderboardId, rawScoreRules);
        const scoreRulesPath = scoreRuleId
          ? normalizedTournamentScoreRulesPath(scoreRuleId)
          : null;

        scoreRules =
          scoreRulesPath && hasDataFile(scoreRulesPath)
            ? await loadNormalizedData(scoreRulesPath)
            : null;
      }

      const tournamentName = buildWindowName(tournament.name, window.windowId);

      windows.push({
        tournamentId: tournament.id || null,
        tournamentName: tournamentName || tournament.name || null,
        description: tournament.description || null,
        type: tournament.typeDisplayName || tournament.type || null,
        images: tournament.images?.square || null,
        windowId: window.windowId || null,
        start: window.start || null,
        end: window.end || null,
        cast: window.cast || null,
        matchCap: window.matchCap || 0,
        mode: window.mode || null,
        teamFormat: window.teamFormat || null,
        requiresQualification: Boolean(window.requiresQualification),
        prizes,
        scoreRules,
        playerQual,
      });
    }
  }

  return windows;
}

function buildQualificationTargetMap(tournaments = []) {
  const qualificationTargets = new Map();

  for (const tournament of tournaments) {
    const tournamentBaseName = stripKnownWindowSuffix(tournament?.name || "");

    for (const window of tournament?.windows || []) {
      const windowId = window?.windowId;

      if (!windowId) {
        continue;
      }

      qualificationTargets.set(String(windowId), {
        windowName: buildWindowName(tournamentBaseName, windowId),
      });
    }
  }

  return qualificationTargets;
}

function buildWindowName(name = "", windowId = "") {
  const baseName = stripKnownWindowSuffix(name);
  const suffix = getWindowSuffix(windowId);

  return [baseName, suffix].filter(Boolean).join(" ").trim() || null;
}

function getScoreRuleId(leaderboardId, rawScoreRules) {
  if (!leaderboardId || !rawScoreRules) {
    return null;
  }

  for (const scoreRule of rawScoreRules.leaderboardDefs || []) {
    if (scoreRule.leaderboardDefId === leaderboardId) {
      return scoreRule.scoringRuleSetId;
    }
  }

  return null;
}

function hasDataFile(relativePath) {
  return fs.existsSync(path.join(__dirname, "../../data", relativePath));
}

module.exports = { enrichedWindowDetail };
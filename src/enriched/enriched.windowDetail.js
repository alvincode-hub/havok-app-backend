const fs = require("fs");
const path = require("path");

const { loadConfigData } = require("../storage/configStore.js");
const { loadNormalizedData } = require("../storage/normalizedStore.js");
const { loadRawData } = require("../storage/rawStore.js");
const { normalizedTournamentScoreRulesPath, rawTournamentScoreRulesPath, normalizedTournamentsPath } = require("../storage/paths.js");
const { isPlayerQual } = require("../services/isPlayerQual.js");
const { loadAcceptedEventIds, isEventAccepted } = require("../services/filterEvents.js");
const { getWindowSuffix } = require("../utils/windowSuffix.js");

async function enrichedWindowDetail() {
  const tournaments = (await loadNormalizedData(normalizedTournamentsPath())) || [];
  const playerConfig = await loadConfigData("config/team.json");
  const acceptedEventIds = await loadAcceptedEventIds();
  const configuredPlayers = playerConfig?.players || [];
  const windows = [];

  for (const tournament of tournaments) {
    if (!(await isEventAccepted(tournament.id, acceptedEventIds))) {
      continue;
    }

    for (const window of tournament.windows || []) {
      const prizes = (window.prizes || []).map((prize) => {
        return {
          scoringType: prize.scoringTypeDisplayName,
          threshold: prize.threshold,
          rewardType: prize.rewardTypeDisplayName,
          value: prize.value,
          quantity: prize.quantity
        };
      });

      const playerQual = [];

      for (const player of configuredPlayers) {
        playerQual.push({
          accountId: player.accountId || null,
          playerName: player.name || null,
          image: player.image || null,
          isThisPlayerQual: await isPlayerQual(player.accountId, window)
        });
      }
      let scoreRules;
      for(const leaderboard of window.scoreLocations){
        const leaderboardId = leaderboard.leaderboardDefId;
        const rawScoreRules = await loadRawData(rawTournamentScoreRulesPath())
        const scoreRuleId = getScoreRuleId(leaderboardId,rawScoreRules)
        const scoreRulesPath = normalizedTournamentScoreRulesPath(scoreRuleId)
        scoreRules = scoreRulesPath && hasDataFile(scoreRulesPath)
          ? await loadNormalizedData(scoreRulesPath)
          : null;
      }
      const tournamentName = `${tournament.name} ${getWindowSuffix(window.windowId)}`.trim();

      windows.push({
        tournamentId: tournament.id || null,
        tournamentName: tournamentName || tournament.name || null,
        description: tournament.description || null,
        type: tournament.typeDisplayName || tournament.type || null,
        images: {
          square: tournament.images?.square || null,
          tile: tournament.images?.tile || null,
          background: tournament.images?.background || null
        },
        windowId: window.windowId || null,
        start: window.start || null,
        end: window.end || null,
        cast: window.cast || null,
        matchCap: window.matchCap || 0,
        mode: window.mode || null,
        teamFormat: window.teamFormat || null,
        anyRequiredTokens: window.anyRequiredTokens || [],
        blockedTokens: window.blockedTokens || [],
        requiredTokens: window.requiredTokens || [],
        requiresQualification: Boolean(window.requiresQualification),
        prizes,
        scoreRules,
        playerQual
      });
    }
  }

  return windows;
}

function getScoreRuleId(leaderboardId,rawScoreRules) {
  if(!leaderboardId || !rawScoreRules){return null}
  for(const scoreRule of rawScoreRules.leaderboardDefs){
    if(scoreRule.leaderboardDefId === leaderboardId){
      return scoreRule.scoringRuleSetId
    }
  }
}

function hasDataFile(relativePath) {
  return fs.existsSync(path.join(__dirname, "../../data", relativePath));
}

module.exports = { enrichedWindowDetail };

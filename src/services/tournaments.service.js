const { getRawEvents, getLeaderboard, getRawScoreRules } = require("../fnbr/tournaments.js");
const { saveRawData } = require("../storage/rawStore.js");
const {
  rawTournamentResultsPath,
  rawTournamentsPath,
  normalizedTournamentsPath,
  normalizedTournamentResultsPath,
  rawTournamentScoreRulesPath,
  normalizedTournamentScoreRulesPath
} = require("../storage/paths.js");
const { saveNormalizedData } = require("../storage/normalizedStore.js");
const { normalizeTournamentsResults } = require("../normalizers/normalize.tournaments.results.js");
const { normalizeTournaments } = require("../normalizers/normalize.tournaments.js");
const { normalizeTournamentsScoreRules } = require("../normalizers/normalize.tournaments.scoreRules.js");
const { syncResultsEnriched, syncTournamentEnriched } = require("./enriched.service.js");
const { logDebug, logInfo } = require("../utils/logger");

async function getTournamentResults(resolvedLocation, page) {
  logInfo(`Traitement des resultats ${resolvedLocation} page=${page}`, "TournamentsService");

  const rawResults = await getLeaderboard(resolvedLocation, page);
  const rawPath = rawTournamentResultsPath(resolvedLocation, page);
  const normalizedPath = normalizedTournamentResultsPath(resolvedLocation, page);

  await saveRawData(rawResults, rawPath);

  const cleanResults = await normalizeTournamentsResults(rawResults);
  await saveNormalizedData(cleanResults, normalizedPath);
  await syncResultsEnriched();

  logDebug(`Resultats normalises ${normalizedPath}`, "TournamentsService");
  return cleanResults;
}

async function getTournament() {
  logInfo("Traitement de la liste des tournois", "TournamentsService");

  const rawPath = rawTournamentsPath();
  const normalizedPath = normalizedTournamentsPath();
  const rawEvents = await getRawEvents();

  await saveRawData(rawEvents, rawPath);

  const cleanEvents = await normalizeTournaments(rawEvents);
  await saveNormalizedData(cleanEvents, normalizedPath);
  await syncTournamentEnriched();

  logDebug(`Tournois normalises ${normalizedPath}`, "TournamentsService");
  return cleanEvents;
}

async function getTournamentScoreRules() {
  logInfo("Traitement des score rules", "TournamentsService");

  const rawPath = rawTournamentScoreRulesPath();
  const rawRules = await getRawScoreRules();

  await saveRawData(rawRules, rawPath);
  const cleanRules = [];
  for (const [scoreRuleId, rules] of Object.entries(rawRules.scoringRuleSets)) {
    const scoreRules = []
    const leaderboardDefId = findLeaderboardDefId(scoreRuleId,rawRules)
    for(const rule of rules){
      rule.rewardTiers.forEach((el)=>{
        scoreRules.push({
          type: rule.trackedStat,
          value: el.keyValue,
          points: el.pointsEarned
        })
      })
    }
    const scoringRuleSets = {
      id: scoreRuleId,
      leaderboardDefId: leaderboardDefId,
      rule: scoreRules
    }
    cleanRules.push(scoringRuleSets)
    if(leaderboardDefId){await saveNormalizedData(scoringRuleSets,normalizedTournamentScoreRulesPath(scoreRuleId))}
    
  }

  logDebug(`Score rules normalisees: ${cleanRules.length}`, "TournamentsService");
  return cleanRules;
}

function findLeaderboardDefId(rulesId,obj) {
  const found = obj.leaderboardDefs.find((el)=>{
    return matchesScoringRule(el.scoringRuleSetId, rulesId)
  })
  return found?.leaderboardDefId || null;
}

function matchesScoringRule(pattern, rulesId) {
  if (!pattern || !rulesId) {
    return false;
  }
  
  if (pattern === rulesId) {
    return true;
  }

  const regexText = pattern
    .replace("${round}", "\\d+");

  const regex = new RegExp(`^${regexText}$`);

  return regex.test(rulesId);
}

module.exports = { getTournamentResults, getTournament, getTournamentScoreRules };

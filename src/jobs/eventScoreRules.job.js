const { getTournamentScoreRules } = require("../services/tournaments.service.js");
const { logError, logInfo, logWarning } = require("../utils/logger");
const { syncWindowDetailEnriched } = require("../services/enriched.service.js")

let isRunning = false;

async function runScoreRulesJob() {
  if (isRunning) {
    logWarning("Job deja en cours d'execution", "ScoreRulesJob");
    return false;
  }

  isRunning = true;

  try {
    await getTournamentScoreRules()
    await syncWindowDetailEnriched()
    return true;
  } catch (error) {
    
    return false;
  } finally {
    isRunning = false;
  }
}

module.exports = { runScoreRulesJob };

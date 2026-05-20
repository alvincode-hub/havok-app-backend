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
    logInfo("Job start", "ScoreRulesJob");
    await getTournamentScoreRules();
    await syncWindowDetailEnriched({
      reason: "score-rules-refresh"
    });
    logInfo("Job termine", "ScoreRulesJob");
    return true;
  } catch (error) {
    logError("Erreur lors de l'execution du job", "ScoreRulesJob", error);
    return false;
  } finally {
    isRunning = false;
  }
}

module.exports = { runScoreRulesJob };

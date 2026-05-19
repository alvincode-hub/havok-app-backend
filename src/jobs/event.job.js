const { getTournament } = require("../services/tournaments.service.js");
const { logError, logInfo, logWarning } = require("../utils/logger");

let isRunning = false;

async function runEventsJob() {
  if (isRunning) {
    logWarning("Job deja en cours d'execution", "EventsJob");
    return false;
  }

  isRunning = true;

  try {
    logInfo("Job start", "EventsJob");
    await getTournament();
    logInfo("Job termine", "EventsJob");
    return true;
  } catch (error) {
    logError("Erreur lors de l'execution du job", "EventsJob", error);
    return false;
  } finally {
    isRunning = false;
  }
}

module.exports = { runEventsJob };

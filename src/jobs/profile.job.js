const { logError, logInfo, logWarning } = require("../utils/logger");
const { loadConfigData } = require("../storage/configStore.js");
const { getProfile } = require("../services/profile.service.js")
const { syncProfileEnriched } = require("../services/enriched.service.js");

let isRunning = false;

async function runProfileJob() {
  if (isRunning) {
    logWarning("Job deja en cours d'execution", "ProfileJob");
    return false;
  }

  isRunning = true;

  try {
    const playerConfig = await loadConfigData("config/team.json");

    if (!playerConfig?.players || playerConfig.players.length === 0) {
      logInfo("Aucun joueur configure", "ProfileJob");
      return true;
    }

    for (const player of playerConfig.players) {
      await getProfile(player.accountId, { syncEnriched: false });
      logInfo(`Profil synchronise ${player.accountId}`, "ProfileJob");
    }

    await syncProfileEnriched();
    return true;
  } catch (error) {
    logError("Erreur lors de l'execution du job", "ProfileJob", error);
    return false;
  } finally {
    isRunning = false;
  }
}

module.exports = { runProfileJob };

const { logError, logInfo } = require("../utils/logger");

const fs = require("fs-extra");
const path = require("path");

const {
  runWithOrchestrationLock,
  logSkippedOrchestration
} = require("./orchestration.shared.js");

async function runStartCron() {
  try {
    const result = await runWithOrchestrationLock("startup:initial-sync", async () => {
      const normalizedPath = getDataFilePath("normalized");
      const enrichedPath = getDataFilePath("enriched");
      const hasNormalizedData = fs.existsSync(normalizedPath);
      const hasEnrichedData = fs.existsSync(enrichedPath);

      if (!hasNormalizedData || !hasEnrichedData) {
        const { runEventsJob } = require("./event.job.js");
        const { runLiveEventsResultJob } = require("./liveEventResults.job.js");
        const { runEventsResultJob } = require("./eventResult.job.js");
        const { runProfileJob } = require("./profile.job.js");
        const { runScoreRulesJob } = require("./eventScoreRules.job.js");
        const { runCleanupResultsJob } = require("./cleanupResults.job.js");
        
        await runEventsJob();
        await runScoreRulesJob();
        await runLiveEventsResultJob({ force: true });
        await runEventsResultJob({ force: true });
        await runCleanupResultsJob();
        await runProfileJob();
      }

      if (!hasEnrichedData) {
        const { syncAllEnriched } = require("../services/enriched.service.js");

        await syncAllEnriched({
          force: true,
          reason: "startup-initial-sync"
        });
      }

      logInfo("Donnees recuperees", "StartJob");
    });

    if (!result.executed) {
      logSkippedOrchestration("startup:initial-sync", "StartJob");
      return false;
    }

    return true;
  } catch (error) {
    logError("Erreur lors de l'initialisation des donnees", "StartJob", error);
    return false;
  }
}

function getDataFilePath(fileName) {
  return path.join(__dirname, "../../data", fileName);
}

module.exports = { runStartCron };

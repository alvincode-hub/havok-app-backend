const cron = require("node-cron");

const { logError, logInfo } = require("../utils/logger");
const { runEventsJob } = require("./event.job.js");
const { runLiveEventsResultJob } = require("./liveEventResults.job.js");
const { runEventsResultJob } = require("./eventResult.job.js");
const { runProfileJob } = require("./profile.job.js");
const { runScoreRulesJob } = require("./eventScoreRules.job.js");
const { runCleanupResultsJob } = require("./cleanupResults.job.js");
const {
  runWithOrchestrationLock,
  logSkippedOrchestration
} = require("./orchestration.shared.js");

logInfo("Cron initialise", "Cron");

async function runCronTask(owner, job, errorMessage) {
  try {
    const result = await runWithOrchestrationLock(owner, job);

    if (!result.executed) {
      logSkippedOrchestration(owner, "Cron");
    }
  } catch (error) {
    logError(errorMessage, "Cron", error);
  }
}

cron.schedule("*/1 * * * *", async () => {
  await runCronTask(
    "cron:live-results",
    runLiveEventsResultJob,
    "Execution du cron live results impossible"
  );
});

cron.schedule("*/30 * * * *", async () => {
  await runCronTask("cron:results", runEventsResultJob, "Execution du cron results impossible");
});

cron.schedule("0 */6 * * *", async () => {
  await runCronTask("cron:events", runEventsJob, "Execution du cron events impossible");
});

cron.schedule("0 * * * *", async () => {
  await runCronTask("cron:profiles", runProfileJob, "Execution du cron profiles impossible");
});

cron.schedule("0 0 * * *", async () => {
  await runCronTask(
    "cron:score-rules",
    runScoreRulesJob,
    "Execution du cron score rules impossible"
  );
});

cron.schedule("0 3 * * *", async () => {
  await runCronTask(
    "cron:cleanup-results",
    runCleanupResultsJob,
    "Execution du cron cleanup results impossible"
  );
});

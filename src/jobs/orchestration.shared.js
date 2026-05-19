const { logWarning } = require("../utils/logger");

let activeLock = null;

async function runWithOrchestrationLock(owner, fn) {
  if (activeLock) {
    return {
      executed: false,
      owner: activeLock.owner,
      startedAt: activeLock.startedAt,
      reason: "busy"
    };
  }

  activeLock = {
    owner,
    startedAt: new Date().toISOString()
  };

  try {
    const result = await fn();
    return {
      executed: true,
      owner,
      result
    };
  } finally {
    activeLock = null;
  }
}

function getOrchestrationLockState() {
  return activeLock ? { ...activeLock } : null;
}

function logSkippedOrchestration(owner, source = "Orchestration") {
  const lockState = getOrchestrationLockState();

  if (!lockState) {
    return;
  }

  logWarning(
    `Execution ignoree owner=${owner} lockOwner=${lockState.owner} startedAt=${lockState.startedAt}`,
    source
  );
}

module.exports = {
  runWithOrchestrationLock,
  getOrchestrationLockState,
  logSkippedOrchestration
};

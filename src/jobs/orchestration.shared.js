const { logError, logWarning } = require("../utils/logger");

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

function startWithOrchestrationLock(owner, fn, source = "Orchestration") {
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

  Promise.resolve()
    .then(() => fn())
    .catch((error) => {
      logError(`Execution asynchrone impossible owner=${owner}`, source, error);
    })
    .finally(() => {
      activeLock = null;
    });

  return {
    executed: true,
    owner,
    startedAt: activeLock.startedAt,
    background: true
  };
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
  startWithOrchestrationLock,
  getOrchestrationLockState,
  logSkippedOrchestration
};

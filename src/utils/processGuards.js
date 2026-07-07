const { resetClientAfterAuthError } = require("../fnbr/client.js");
const { logError } = require("./logger.js");

let installed = false;

function installProcessGuards() {
  if (installed) {
    return;
  }

  installed = true;

  process.on("unhandledRejection", (reason) => {
    if (resetClientAfterAuthError(reason)) {
      logError("Rejet FNBR TOKEN_NOT_FOUND intercepte sans arret du process", "Process", reason);
      return;
    }

    logError("Rejet non gere", "Process", reason);
    process.exitCode = 1;
    setTimeout(() => process.exit(1), 50);
  });

  process.on("uncaughtException", (error) => {
    if (resetClientAfterAuthError(error)) {
      logError("Exception FNBR TOKEN_NOT_FOUND interceptee sans arret du process", "Process", error);
      return;
    }

    logError("Exception non geree", "Process", error);
    process.exitCode = 1;
    setTimeout(() => process.exit(1), 50);
  });
}

module.exports = { installProcessGuards };

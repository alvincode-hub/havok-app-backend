const app = require("./app");
const os = require("os");
const { login } = require("./fnbr/client");
const { logError, logInfo } = require("./utils/logger");
const { demo_mode, port } = require("./config/env.js");
const { validateEnv } = require("./config/validateEnv.js");

const PORT = port;
const HOST = "0.0.0.0";
const envValidation = validateEnv();

envValidation.warnings.forEach((warning) => {
  logInfo(`Configuration: ${warning}`, "ServerConfig");
});

if (envValidation.errors.length > 0) {
  envValidation.errors.forEach((errorMessage) => {
    logError(`Configuration invalide: ${errorMessage}`, "ServerConfig");
  });

  process.exitCode = 1;
  throw new Error("Configuration d environnement invalide");
}

logInfo(`Initialisation du serveur pid=${process.pid} port=${PORT}`, "Server");

const server = app.listen(PORT, HOST);

server.on("listening", () => {
  logInfo(`Server pid=${process.pid} port=${PORT}`, "Server");
  logInfo(`Serveur en ecoute sur http://localhost:${PORT}`, "Server");
  getLanUrls(PORT).forEach((url) => {
    logInfo(`Serveur joignable sur ${url}`, "Server");
  });

  if (demo_mode) {
    logInfo("Mode demo actif: cron et connexion Fortnite desactives", "Server");
    return;
  }

  login()
    .then(() => {
      logInfo("Client Fortnite connecte", "Server");
    })
    .catch((error) => {
      logError("Connexion Fortnite impossible au demarrage", "Server", error);
    });
});

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    logError(
      `Demarrage impossible: port ${PORT} deja utilise. Un autre process serveur repond probablement deja. pid=${process.pid}`,
      "Server",
      error
    );
  } else {
    logError(`Demarrage impossible pid=${process.pid}`, "Server", error);
  }

  process.exitCode = 1;
  setTimeout(() => process.exit(1), 50);
});

function getLanUrls(port) {
  const interfaces = os.networkInterfaces();
  const urls = [];

  for (const interfaceEntries of Object.values(interfaces)) {
    for (const entry of interfaceEntries || []) {
      if (!entry || entry.family !== "IPv4" || entry.internal) {
        continue;
      }

      urls.push(`http://${entry.address}:${port}`);
    }
  }

  return urls;
}

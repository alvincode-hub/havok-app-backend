const app = require("./app");
const os = require("os");
const { login } = require("./fnbr/client");
const { logError, logInfo } = require("./utils/logger");
const { port } = require("./config/env.js");

const PORT = port;
const HOST = "0.0.0.0";

logInfo("Initialisation du serveur", "Server");

app.listen(PORT, HOST, () => {
  logInfo(`Serveur en ecoute sur http://localhost:${PORT}`, "Server");
  getLanUrls(PORT).forEach((url) => {
    logInfo(`Serveur joignable sur ${url}`, "Server");
  });

  login()
    .then(() => {
      logInfo("Client Fortnite connecte", "Server");
    })
    .catch((error) => {
      logError("Connexion Fortnite impossible au demarrage", "Server", error);
    });
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

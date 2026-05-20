const app = require("./app");
const { login } = require("./fnbr/client");
const { logError, logInfo } = require("./utils/logger");
const { port } = require("./config/env.js");

const PORT = port;

logInfo("Initialisation du serveur", "Server");

app.listen(PORT, () => {
  logInfo(`Serveur en ecoute sur http://localhost:${PORT}`, "Server");

  login()
    .then(() => {
      logInfo("Client Fortnite connecte", "Server");
    })
    .catch((error) => {
      logError("Connexion Fortnite impossible au demarrage", "Server", error);
    });
});

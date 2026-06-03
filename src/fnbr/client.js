const fs = require("fs");
const path = require("path");
const { Client } = require("fnbr");

const { logError, logInfo } = require("../utils/logger");

const deviceAuthPath = path.join(__dirname, "../../deviceAuth.json");
let cachedClient = null;
let loginPromise = null;

function loadDeviceAuth() {
  if (!fs.existsSync(deviceAuthPath)) {
    return undefined;
  }

  try {
    return JSON.parse(fs.readFileSync(deviceAuthPath, "utf8"));
  } catch (error) {
    logError("Lecture de deviceAuth impossible", "FnbrClient", error);
    return undefined;
  }
}

function saveDeviceAuth(deviceAuth) {
  try {
    fs.writeFileSync(deviceAuthPath, JSON.stringify(deviceAuth, null, 2));
    logInfo("deviceAuth.json mis a jour", "FnbrClient");
  } catch (error) {
    logError("Ecriture de deviceAuth impossible", "FnbrClient", error);
  }
}

async function login() {
  if (cachedClient) {
    return cachedClient;
  }

  if (loginPromise) {
    return loginPromise;
  }

  logInfo("Demande d'authentification Fortnite", "FnbrClient");
  logInfo("Allez sur https://www.epicgames.com/id/api/redirect?clientId=3f69e56c7649492c8cc29f1af08a8a12&responseType=code pour avoir le code.","FnbrClient")

  loginPromise = (async () => {
    const client = new Client({
      auth: {
        authClient: "fortniteAndroidGameClient",
        deviceAuth: loadDeviceAuth()
      },
      connectToXMPP: false,
      connectToSTOMP: false,
      createParty: false,
      fetchFriends: false
    });

    client.on("deviceauth:created", saveDeviceAuth);

    await client.login();

    cachedClient = client;
    logInfo("Connexion Fortnite reussie", "FnbrClient");
    return client;
  })();

  try {
    return await loginPromise;
  } catch (error) {
    logError("Connexion Fortnite echouee", "FnbrClient", error);
    throw error;
  } finally {
    if (!cachedClient) {
      loginPromise = null;
    }
  }
}

function getClientStatus() {
  return {
    connected: Boolean(cachedClient),
    authenticating: Boolean(loginPromise && !cachedClient),
    hasDeviceAuth: Boolean(loadDeviceAuth())
  };
}

module.exports = { login, getClientStatus };

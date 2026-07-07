const fs = require("fs");
const path = require("path");
const { Client } = require("fnbr");

const { logError, logInfo } = require("../utils/logger");

const deviceAuthPath = path.join(__dirname, "../../deviceAuth.json");
let cachedClient = null;
let loginPromise = null;

function isTokenNotFoundError(error) {
  if (!error) {
    return false;
  }

  const errorText = [
    error.code,
    error.message,
    error.name,
    error.errorCode,
    error.response?.data?.errorCode,
    error.response?.data?.errorMessage
  ]
    .filter(Boolean)
    .join(" ");

  return errorText.toUpperCase().includes("TOKEN_NOT_FOUND");
}

function resetClientAfterAuthError(error) {
  if (!isTokenNotFoundError(error)) {
    return false;
  }

  if (cachedClient) {
    try {
      cachedClient.destroy();
    } catch (destroyError) {
      logError("Nettoyage du client Fortnite impossible", "FnbrClient", destroyError);
    }
  }

  cachedClient = null;
  loginPromise = null;
  logError("Token Fortnite introuvable, client FNBR remis a zero", "FnbrClient", error);
  return true;
}

function loadDeviceAuth() {
  if (process.env.DEVICE_AUTH_JSON) {
    try {
      return JSON.parse(process.env.DEVICE_AUTH_JSON);
    } catch (error) {
      logError("DEVICE_AUTH_JSON invalide", "FnbrClient", error);
      return undefined;
    }
  }

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
  if (process.env.NODE_ENV === "production") {
    logInfo("deviceAuth creee/renouvelee en production: mettre a jour DEVICE_AUTH_JSON dans Render si necessaire", "FnbrClient");
    return;
  }

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
    resetClientAfterAuthError(error);
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

module.exports = {
  login,
  getClientStatus,
  isTokenNotFoundError,
  resetClientAfterAuthError
};

const { login } = require("./client");
const {
  loadNormalizedData,
  saveNormalizedData
} = require("../storage/normalizedStore.js");
const { normalizedPlayerNamesCachePath } = require("../storage/paths.js");
const { formatRequestLog } = require("../utils/requestLog.js");
const { logDebug, logInfo, logWarning } = require("../utils/logger");

const ACCOUNT_LOOKUP_CHUNK_SIZE = 50;
const PLAYER_NAMES_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function getPlayerTournament(user) {
  logDebug(`Recuperation du profil tournoi ${user}`, "FnbrProfile");
  const startedAt = Date.now();
  const client = await login();

  try {
    const profile = await client.tournaments.getEventTokens(user);
    logInfo(
      formatRequestLog({
        service: "Epic",
        operation: "getEventTokens",
        key: user,
        source: "FnbrProfile",
        status: "ok",
        cacheHit: false,
        cooldownApplied: false,
        durationMs: Date.now() - startedAt
      }),
      "FnbrProfile"
    );
    return profile;
  } catch (error) {
    logWarning(
      formatRequestLog({
        service: "Epic",
        operation: "getEventTokens",
        key: user,
        source: "FnbrProfile",
        status: "error",
        cacheHit: false,
        cooldownApplied: false,
        durationMs: Date.now() - startedAt,
        errorMessage: error?.message || "unknown"
      }),
      "FnbrProfile"
    );
    throw error;
  }
}

async function getPlayerNameOrId(user) {
  logDebug(`Recuperation du nom/id de ${user}`, "FnbrProfile");
  const startedAt = Date.now();
  const client = await login();

  try {
    const player = await client.user.fetch(user);
    logInfo(
      formatRequestLog({
        service: "Epic",
        operation: "user.fetch",
        key: user,
        source: "FnbrProfile",
        status: "ok",
        cacheHit: false,
        cooldownApplied: false,
        durationMs: Date.now() - startedAt
      }),
      "FnbrProfile"
    );
    return player;
  } catch (error) {
    logWarning(
      formatRequestLog({
        service: "Epic",
        operation: "user.fetch",
        key: user,
        source: "FnbrProfile",
        status: "error",
        cacheHit: false,
        cooldownApplied: false,
        durationMs: Date.now() - startedAt,
        errorMessage: error?.message || "unknown"
      }),
      "FnbrProfile"
    );
    throw error;
  }
}

async function getAllPlayersName(userArr) {
  const uniqueIds = [...new Set(userArr || [])].filter(Boolean);

  logDebug(`Recuperation de ${uniqueIds.length} noms joueurs`, "FnbrProfile");

  if (uniqueIds.length === 0) {
    return [];
  }

  const startedAt = Date.now();
  const cache = await loadPlayerNamesCache();
  const cachedPlayers = [];
  const staleCachedPlayers = [];
  const idsToFetch = [];

  for (const accountId of uniqueIds) {
    const cacheEntry = cache.entries[accountId];

    if (!cacheEntry) {
      idsToFetch.push(accountId);
      continue;
    }

    if (isFreshCacheEntry(cacheEntry)) {
      cachedPlayers.push({
        accountId,
        displayName: cacheEntry.displayName || accountId
      });
      continue;
    }

    staleCachedPlayers.push({
      accountId,
      displayName: cacheEntry.displayName || accountId
    });
    idsToFetch.push(accountId);
  }

  if (idsToFetch.length === 0) {
    logInfo(
      formatRequestLog({
        service: "EpicAccount",
        operation: "public.account.lookup",
        key: "batch",
        source: "FnbrProfile",
        status: "cache",
        cacheHit: uniqueIds.length,
        cooldownApplied: false,
        durationMs: Date.now() - startedAt,
        requested: uniqueIds.length,
        fetched: 0,
        failedChunks: 0
      }),
      "FnbrProfile"
    );

    return cachedPlayers;
  }

  const client = await login();
  const allPlayers = [...cachedPlayers];
  const staleFallbackById = new Map(
    staleCachedPlayers.map((player) => [player.accountId, player])
  );
  let failedChunks = 0;
  let fetched = 0;
  let cacheChanged = false;

  for (let i = 0; i < idsToFetch.length; i += ACCOUNT_LOOKUP_CHUNK_SIZE) {
    const chunk = idsToFetch.slice(i, i + ACCOUNT_LOOKUP_CHUNK_SIZE);
    const chunkIndex = Math.floor(i / ACCOUNT_LOOKUP_CHUNK_SIZE);
    const chunkStartedAt = Date.now();

    const params = new URLSearchParams();

    chunk.forEach((id) => {
      params.append("accountId", id);
    });

    const url = `https://account-public-service-prod03.ol.epicgames.com/account/api/public/account?${params.toString()}`;

    try {
      const players = await client.http.epicgamesRequest(
        { method: "GET", url },
        "fortnite"
      );

      if (Array.isArray(players)) {
        allPlayers.push(...players);
        fetched += players.length;
        logInfo(
          formatRequestLog({
            service: "EpicAccount",
            operation: "public.account.lookup.chunk",
            key: `chunk_${chunkIndex}`,
            source: "FnbrProfile",
            status: "ok",
            cacheHit: 0,
            cooldownApplied: false,
            durationMs: Date.now() - chunkStartedAt,
            requested: chunk.length,
            fetched: players.length
          }),
          "FnbrProfile"
        );

        for (const player of players) {
          const accountId = player.accountId || player.id;

          if (!accountId) {
            continue;
          }

          cache.entries[accountId] = {
            displayName: player.displayName || accountId,
            updatedAt: new Date().toISOString()
          };
          staleFallbackById.delete(accountId);
          cacheChanged = true;
        }
      }
    } catch (error) {
      failedChunks += 1;
      logWarning(
        formatRequestLog({
          service: "EpicAccount",
          operation: "public.account.lookup.chunk",
          key: `chunk_${chunkIndex}`,
          source: "FnbrProfile",
          status: "error",
          cacheHit: 0,
          cooldownApplied: false,
          durationMs: Date.now() - chunkStartedAt,
          requested: chunk.length,
          errorMessage: error?.message || "unknown"
        }),
        "FnbrProfile"
      );

      for (const accountId of chunk) {
        if (staleFallbackById.has(accountId)) {
          allPlayers.push(staleFallbackById.get(accountId));
          staleFallbackById.delete(accountId);
        }
      }
    }
  }

  if (cacheChanged) {
    await saveNormalizedData(cache, normalizedPlayerNamesCachePath());
  }

  logInfo(
    formatRequestLog({
      service: "EpicAccount",
      operation: "public.account.lookup",
      key: "batch",
      source: "FnbrProfile",
      status: failedChunks > 0 ? "partial" : "ok",
      cacheHit: cachedPlayers.length,
      cooldownApplied: false,
      durationMs: Date.now() - startedAt,
      requested: uniqueIds.length,
      fetched,
      failedChunks
    }),
    "FnbrProfile"
  );

  return allPlayers;
}

async function loadPlayerNamesCache() {
  const cache = await loadNormalizedData(normalizedPlayerNamesCachePath());

  if (!cache || typeof cache !== "object" || Array.isArray(cache)) {
    return { entries: {} };
  }

  return {
    entries: isObject(cache.entries) ? cache.entries : {}
  };
}

function isFreshCacheEntry(entry) {
  const updatedAt = new Date(entry?.updatedAt).getTime();

  if (Number.isNaN(updatedAt)) {
    return false;
  }

  return Date.now() - updatedAt < PLAYER_NAMES_TTL_MS;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
  getPlayerTournament,
  getPlayerNameOrId,
  getAllPlayersName
};

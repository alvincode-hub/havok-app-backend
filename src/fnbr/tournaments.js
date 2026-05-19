const { login } = require("./client");
const { formatRequestLog } = require("../utils/requestLog.js");
const { logDebug, logInfo, logWarning } = require("../utils/logger");

async function getRawEvents() {
  logInfo("Recuperation des evenements Fortnite", "FnbrTournaments");
  const startedAt = Date.now();

  try {
    const client = await login();
    const events = await client.tournaments.get("fr", "EU", "Windows");
    logInfo(
      formatRequestLog({
        service: "Epic",
        operation: "tournaments.get",
        key: "fr:EU:Windows",
        source: "FnbrTournaments",
        status: "ok",
        cacheHit: false,
        cooldownApplied: false,
        durationMs: Date.now() - startedAt
      }),
      "FnbrTournaments"
    );
    return events;
  } catch (error) {
    logWarning(
      formatRequestLog({
        service: "Epic",
        operation: "tournaments.get",
        key: "fr:EU:Windows",
        source: "FnbrTournaments",
        status: "error",
        cacheHit: false,
        cooldownApplied: false,
        durationMs: Date.now() - startedAt,
        errorMessage: error?.message || "unknown"
      }),
      "FnbrTournaments"
    );
    throw error;
  }
}

async function getLeaderboard(resolvedLocation, page = 0) {
  logDebug(`Recuperation du leaderboard ${resolvedLocation} page=${page}`, "FnbrTournaments");

  const startedAt = Date.now();

  try {
    const client = await login();
    const [appId, ...segments] = resolvedLocation.split(":");
    const scoreId = segments.join("/");
    const url = `https://events-public-service-live.ol.epicgames.com/api/v1/leaderboards/${appId}/${scoreId}/${client.user.self.id}?page=${page}&rank=0&teamAccountIds=&appId=Fortnite&showLiveSessions=false`;

    const leaderboard = await client.http.epicgamesRequest({ method: "GET", url }, "fortnite");
    logInfo(
      formatRequestLog({
        service: "Epic",
        operation: "leaderboard.get",
        key: `${resolvedLocation}:page_${page}`,
        source: "FnbrTournaments",
        status: "ok",
        cacheHit: false,
        cooldownApplied: false,
        durationMs: Date.now() - startedAt
      }),
      "FnbrTournaments"
    );
    return leaderboard;
  } catch (error) {
    logWarning(
      formatRequestLog({
        service: "Epic",
        operation: "leaderboard.get",
        key: `${resolvedLocation}:page_${page}`,
        source: "FnbrTournaments",
        status: "error",
        cacheHit: false,
        cooldownApplied: false,
        durationMs: Date.now() - startedAt,
        errorMessage: error?.message || "unknown"
      }),
      "FnbrTournaments"
    );
    throw error;
  }
}

async function getPlayerTop(resolvedLocation, page = 0) {
  logDebug(`Recuperation du leaderboard ${resolvedLocation} page=${page}`, "FnbrTournaments");

  const startedAt = Date.now();

  try {
    const client = await login();
    const [appId, ...segments] = resolvedLocation.split(":");
    const scoreId = segments.join("/");
    const url = `https://events-public-service-live.ol.epicgames.com/api/v1/leaderboards/${appId}/${scoreId}/${client.user.self.id}?page=${page}&rank=0&teamAccountIds=&appId=Fortnite&showLiveSessions=false`;

    const leaderboard = await client.http.epicgamesRequest({ method: "GET", url }, "fortnite");
    logInfo(
      formatRequestLog({
        service: "Epic",
        operation: "leaderboard.getPlayerTop",
        key: `${resolvedLocation}:page_${page}`,
        source: "FnbrTournaments",
        status: "ok",
        cacheHit: false,
        cooldownApplied: false,
        durationMs: Date.now() - startedAt
      }),
      "FnbrTournaments"
    );
    return leaderboard;
  } catch (error) {
    logWarning(
      formatRequestLog({
        service: "Epic",
        operation: "leaderboard.getPlayerTop",
        key: `${resolvedLocation}:page_${page}`,
        source: "FnbrTournaments",
        status: "error",
        cacheHit: false,
        cooldownApplied: false,
        durationMs: Date.now() - startedAt,
        errorMessage: error?.message || "unknown"
      }),
      "FnbrTournaments"
    );
    throw error;
  }
}

async function getRawScoreRules() {
  logInfo("Recuperation des score rules Fortnite", "FnbrTournaments");

  const startedAt = Date.now();

  try {
    const client = await login();
    const accountId = client.user.self.id;
    const url = `https://events-public-service-live.ol.epicgames.com/api/v1/events/Fortnite/download/${accountId}?region=EU&platform=Windows&teamAccountIds=${accountId}`;

    const scoreRules = await client.http.epicgamesRequest({ method: "GET", url }, "fortnite");
    logInfo(
      formatRequestLog({
        service: "Epic",
        operation: "scoreRules.download",
        key: accountId,
        source: "FnbrTournaments",
        status: "ok",
        cacheHit: false,
        cooldownApplied: false,
        durationMs: Date.now() - startedAt
      }),
      "FnbrTournaments"
    );
    return scoreRules;
  } catch (error) {
    logWarning(
      formatRequestLog({
        service: "Epic",
        operation: "scoreRules.download",
        key: "self",
        source: "FnbrTournaments",
        status: "error",
        cacheHit: false,
        cooldownApplied: false,
        durationMs: Date.now() - startedAt,
        errorMessage: error?.message || "unknown"
      }),
      "FnbrTournaments"
    );
    throw error;
  }
}

module.exports = { getRawEvents, getLeaderboard, getRawScoreRules, getPlayerTop };

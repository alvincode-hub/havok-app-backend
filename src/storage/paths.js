const path = require("path");

function safeName(value) {
  return String(value)
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_");
}

function rawTournamentsPath() {
  return "raw/events/events.json";
}

function normalizedTournamentsPath() {
  return "normalized/events/events.json";
}

function rawTournamentResultsPath(resolvedLocation, page = 0) {
  return path.join(
    rawTournamentResultsDirPath(resolvedLocation),
    `page_${page}.json`
  );
}

function normalizedTournamentResultsPath(resolvedLocation, page = 0) {
  return path.join(
    normalizedTournamentResultsDirPath(resolvedLocation),
    `page_${page}.json`
  );
}

function normalizedTournamentResultsNamesPath(resolvedLocation) {
  return path.join(
    normalizedTournamentResultsDirPath(resolvedLocation),
    `_names.json`
  );
}

function rawTournamentResultsDirPath(resolvedLocation) {
  return path.join(
    "raw",
    "results",
    ...getResolvedLocationSegments(resolvedLocation)
  );
}

function normalizedTournamentResultsDirPath(resolvedLocation) {
  return path.join(
    "normalized",
    "results",
    ...getResolvedLocationSegments(resolvedLocation)
  );
}

function normalizedTournamentResultsPlayerIndexPath(resolvedLocation) {
  return path.join(
    normalizedTournamentResultsDirPath(resolvedLocation),
    "_player-index.json"
  );
}

function normalizedTournamentResultsTrackedPlayerIndexPath(resolvedLocation) {
  return path.join(
    normalizedTournamentResultsDirPath(resolvedLocation),
    "_tracked-player-index.json"
  );
}

function rawPlayerPath(playerNameOrId) {
  return path.join("raw", "players", `${safeName(playerNameOrId)}.json`);
}

function normalizedPlayerPath(playerNameOrId) {
  return path.join("normalized", "players", `${safeName(playerNameOrId)}.json`);
}

function rawTournamentScoreRulesPath() {
  return "raw/events/score_rules.json";
}

function normalizedTournamentScoreRulesPath(scoreRulesId) {
  return path.join("normalized", "scoreRules", `${safeName(scoreRulesId)}.json`);
}

function enrichedHomePath() {
  return path.join("enriched", "home.json");
}

function enrichedCalendrierPath() {
  return path.join("enriched", "calendrier.json");
}

function enrichedPlayersPath() {
  return path.join("enriched", "players.json");
}

function enrichedResultsPath() {
  return path.join("enriched", "results.json");
}

function enrichedWindowDetailsPath() {
  return path.join("enriched", "window-details.json");
}

function normalizedCacheDirPath() {
  return path.join("normalized", "cache");
}

function normalizedPlayerNamesCachePath() {
  return path.join(normalizedCacheDirPath(), "player-names.json");
}

function normalizedRequestStatePath() {
  return path.join(normalizedCacheDirPath(), "request-state.json");
}

function getResolvedLocationSegments(resolvedLocation) {
  const [, ...segments] = String(resolvedLocation || "").split(":");
  const cleanSegments = segments.map(safeName).filter(Boolean);

  if (cleanSegments.length > 0) {
    return cleanSegments;
  }

  return [safeName(resolvedLocation || "unknown")];
}

module.exports = {
  rawTournamentsPath,
  normalizedTournamentsPath,
  rawTournamentResultsDirPath,
  rawTournamentResultsPath,
  normalizedTournamentResultsDirPath,
  normalizedTournamentResultsPath,
  normalizedTournamentResultsPlayerIndexPath,
  normalizedTournamentResultsTrackedPlayerIndexPath,
  rawPlayerPath,
  normalizedPlayerPath,
  rawTournamentScoreRulesPath,
  normalizedTournamentScoreRulesPath,
  enrichedHomePath,
  enrichedCalendrierPath,
  enrichedPlayersPath,
  enrichedResultsPath,
  enrichedWindowDetailsPath,
  normalizedTournamentResultsNamesPath,
  normalizedCacheDirPath,
  normalizedPlayerNamesCachePath,
  normalizedRequestStatePath
};

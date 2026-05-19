const { saveRawData } = require("../storage/rawStore.js");
const { saveNormalizedData } = require("../storage/normalizedStore.js");
const { rawPlayerPath, normalizedPlayerPath } = require("../storage/paths.js");
const { getPlayerTournament } = require("../fnbr/profile.js");
const { normalizeProfile } = require("../normalizers/normalize.profile.js");
const { syncProfileEnriched } = require("./enriched.service.js");
const { logInfo } = require("../utils/logger");

async function getProfile(accountId, options = {}) {
  const { syncEnriched = true } = options;

  logInfo(`Traitement du profil ${accountId}`, "ProfileService");

  const rawPath = rawPlayerPath(accountId);
  const normalizedPath = normalizedPlayerPath(accountId);
  const rawProfile = await getPlayerTournament(accountId);

  await saveRawData(rawProfile, rawPath);

  const normalizedProfile = await normalizeProfile(rawProfile);
  await saveNormalizedData(normalizedProfile, normalizedPath);

  if (syncEnriched) {
    await syncProfileEnriched();
  }

  return normalizedProfile;
}

module.exports = { getProfile };

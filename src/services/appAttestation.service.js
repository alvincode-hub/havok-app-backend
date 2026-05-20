const {
  app_attestation_mode,
  node_env
} = require("../config/env.js");

const SUPPORTED_PLATFORMS = new Set(["ios", "android", "web"]);
const SUPPORTED_ATTESTATION_MODES = new Set(["development", "web"]);

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePlatform(value) {
  return normalizeString(value).toLowerCase();
}

function assertSupportedPlatform(platform) {
  const normalizedPlatform = normalizePlatform(platform);

  if (!SUPPORTED_PLATFORMS.has(normalizedPlatform)) {
    throw new Error("platform invalide");
  }

  return normalizedPlatform;
}

async function verifyAppAttestation({
  attestation,
  challengeRecord,
  installationId,
  platform,
  appVersion
}) {
  const normalizedPlatform = assertSupportedPlatform(platform);
  const normalizedInstallationId = normalizeString(installationId);
  const normalizedAppVersion = normalizeString(appVersion);

  if (app_attestation_mode === "development") {
    return verifyDevelopmentAttestation({
      attestation,
      challengeRecord,
      installationId: normalizedInstallationId,
      platform: normalizedPlatform,
      appVersion: normalizedAppVersion
    });
  }

  if (app_attestation_mode === "web") {
    return verifyWebAttestation({
      attestation,
      challengeRecord,
      installationId: normalizedInstallationId,
      platform: normalizedPlatform,
      appVersion: normalizedAppVersion
    });
  }

  return {
    ok: false,
    error:
      node_env === "production"
        ? "Attestation native non configuree cote serveur."
        : `Mode d'attestation non supporte: ${app_attestation_mode}`
  };
}

function verifyWebAttestation({
  attestation,
  challengeRecord,
  installationId,
  platform,
  appVersion
}) {
  if (platform !== "web") {
    return {
      ok: false,
      error: "attestation web reservee au client web"
    };
  }

  if (!attestation || typeof attestation !== "object") {
    return {
      ok: false,
      error: "attestation manquante"
    };
  }

  if (attestation.provider !== "web") {
    return {
      ok: false,
      error: "provider d'attestation invalide"
    };
  }

  return verifyExpectedPayload({
    attestationPayload: attestation.payload,
    challengeRecord,
    installationId,
    platform,
    appVersion,
    mode: "web",
    attested: true,
    provider: "web"
  });
}

function verifyDevelopmentAttestation({
  attestation,
  challengeRecord,
  installationId,
  platform,
  appVersion
}) {
  if (!attestation || typeof attestation !== "object") {
    return {
      ok: false,
      error: "attestation manquante"
    };
  }

  if (attestation.provider !== "development") {
    return {
      ok: false,
      error: "provider d'attestation invalide"
    };
  }

  return verifyExpectedPayload({
    attestationPayload: attestation.payload,
    challengeRecord,
    installationId,
    platform,
    appVersion,
    mode: "development",
    attested: false,
    provider: "development"
  });
}

function verifyExpectedPayload({
  attestationPayload,
  challengeRecord,
  installationId,
  platform,
  appVersion,
  mode,
  attested,
  provider
}) {
  const payload = attestationPayload;

  if (!payload || typeof payload !== "object") {
    return {
      ok: false,
      error: "payload d'attestation manquant"
    };
  }

  const expectedChallenge = challengeRecord.challenge;
  const expectedInstallationId = challengeRecord.installationId;
  const expectedPlatform = challengeRecord.platform;
  const expectedAppVersion = challengeRecord.appVersion;

  if (
    normalizeString(payload.challenge) !== expectedChallenge ||
    normalizeString(payload.installationId) !== expectedInstallationId ||
    normalizePlatform(payload.platform) !== expectedPlatform ||
    normalizeString(payload.appVersion) !== expectedAppVersion
  ) {
    return {
      ok: false,
      error: "payload d'attestation incoherent"
    };
  }

  if (
    installationId !== expectedInstallationId ||
    platform !== expectedPlatform ||
    appVersion !== expectedAppVersion
  ) {
    return {
      ok: false,
      error: "requete de session incoherente"
    };
  }

  return {
    ok: true,
    attested,
    mode,
    provider,
    claims: {
      platform,
      installationId,
      appVersion
    }
  };
}

module.exports = {
  SUPPORTED_ATTESTATION_MODES,
  assertSupportedPlatform,
  normalizePlatform,
  normalizeString,
  verifyAppAttestation
};

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const {
  app_auth_jwt_audience,
  app_auth_jwt_issuer,
  app_auth_jwt_secret,
  app_challenge_ttl_seconds,
  app_session_ttl_seconds
} = require("../config/env.js");
const {
  assertSupportedPlatform,
  normalizePlatform,
  normalizeString,
  verifyAppAttestation
} = require("./appAttestation.service.js");
const { logInfo, logWarning } = require("../utils/logger.js");

const challengeStore = new Map();
const cleanupIntervalMs = 30 * 1000;

setInterval(() => {
  cleanupExpiredChallenges();
}, cleanupIntervalMs).unref();

function createAppChallenge({
  installationId,
  platform,
  appVersion,
  ip,
  userAgent
}) {
  const normalizedInstallationId = requireNonEmptyField(
    installationId,
    "installationId"
  );
  const normalizedPlatform = assertSupportedPlatform(platform);
  const normalizedAppVersion = requireNonEmptyField(appVersion, "appVersion");
  const now = Date.now();
  const expiresAtMs = now + app_challenge_ttl_seconds * 1000;
  const challenge = crypto.randomBytes(32).toString("base64url");

  challengeStore.set(challenge, {
    challenge,
    installationId: normalizedInstallationId,
    platform: normalizedPlatform,
    appVersion: normalizedAppVersion,
    ip: normalizeString(ip),
    userAgent: normalizeString(userAgent),
    createdAt: now,
    expiresAt: expiresAtMs
  });

  logInfo(
    `Challenge mobile cree pour ${normalizedPlatform}:${normalizedInstallationId}`,
    "AppSessionService"
  );

  return {
    challenge,
    expiresAt: new Date(expiresAtMs).toISOString(),
    ttlSeconds: app_challenge_ttl_seconds
  };
}

async function createAppSession({
  challenge,
  installationId,
  platform,
  appVersion,
  attestation
}) {
  assertJwtSecretConfigured();

  const normalizedChallenge = requireNonEmptyField(challenge, "challenge");
  const normalizedInstallationId = requireNonEmptyField(
    installationId,
    "installationId"
  );
  const normalizedPlatform = assertSupportedPlatform(platform);
  const normalizedAppVersion = requireNonEmptyField(appVersion, "appVersion");

  const challengeRecord = getChallengeRecord(normalizedChallenge);

  if (!challengeRecord) {
    throw new Error("challenge introuvable");
  }

  if (challengeRecord.installationId !== normalizedInstallationId) {
    throw new Error("installationId non associe au challenge");
  }

  if (challengeRecord.platform !== normalizedPlatform) {
    throw new Error("platform non associee au challenge");
  }

  if (challengeRecord.appVersion !== normalizedAppVersion) {
    throw new Error("appVersion non associee au challenge");
  }

  const verification = await verifyAppAttestation({
    attestation,
    challengeRecord,
    installationId: normalizedInstallationId,
    platform: normalizedPlatform,
    appVersion: normalizedAppVersion
  });

  if (!verification.ok) {
    logWarning(
      `Attestation mobile refusee (${verification.error}) pour ${normalizedPlatform}:${normalizedInstallationId}`,
      "AppSessionService"
    );
    throw new Error(verification.error || "attestation invalide");
  }

  challengeStore.delete(normalizedChallenge);

  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = issuedAtSeconds + app_session_ttl_seconds;

  const payload = {
    platform: normalizedPlatform,
    appVersion: normalizedAppVersion,
    attested: Boolean(verification.attested),
    attestationMode: verification.mode,
    attestationProvider: verification.provider
  };

  const accessToken = jwt.sign(payload, app_auth_jwt_secret, {
    algorithm: "HS256",
    subject: normalizedInstallationId,
    audience: app_auth_jwt_audience,
    issuer: app_auth_jwt_issuer,
    expiresIn: app_session_ttl_seconds
  });

  logInfo(
    `Session mobile creee pour ${normalizedPlatform}:${normalizedInstallationId}`,
    "AppSessionService"
  );

  return {
    accessToken,
    tokenType: "Bearer",
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
    expiresInSeconds: app_session_ttl_seconds
  };
}

function verifyAppSessionToken(token) {
  assertJwtSecretConfigured();

  return jwt.verify(token, app_auth_jwt_secret, {
    algorithms: ["HS256"],
    audience: app_auth_jwt_audience,
    issuer: app_auth_jwt_issuer
  });
}

function extractBearerToken(headerValue) {
  const normalizedHeader = normalizeString(headerValue);

  if (!normalizedHeader.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return normalizedHeader.slice(7).trim();
}

function getChallengeRecord(challenge) {
  cleanupExpiredChallenges();

  const record = challengeStore.get(challenge);

  if (!record) {
    return null;
  }

  if (record.expiresAt <= Date.now()) {
    challengeStore.delete(challenge);
    return null;
  }

  return record;
}

function cleanupExpiredChallenges() {
  const now = Date.now();

  for (const [challenge, record] of challengeStore.entries()) {
    if (record.expiresAt <= now) {
      challengeStore.delete(challenge);
    }
  }
}

function requireNonEmptyField(value, fieldName) {
  const normalizedValue = normalizeString(value);

  if (!normalizedValue) {
    throw new Error(`${fieldName} est requis`);
  }

  return normalizedValue;
}

function assertJwtSecretConfigured() {
  if (!app_auth_jwt_secret) {
    throw new Error("APP_AUTH_JWT_SECRET manquant");
  }
}

module.exports = {
  createAppChallenge,
  createAppSession,
  extractBearerToken,
  verifyAppSessionToken
};

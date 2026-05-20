const dotenv = require("dotenv");

dotenv.config();

const port = Number(process.env.PORT) || 3000;
const node_env = process.env.NODE_ENV || "development";

const fortnite_auth_client = process.env.FORTNITE_AUTH_CLIENT || "";
const fortnite_device_auth_file = process.env.FORTNITE_DEVICE_AUTH_FILE || "";

const app_api_key = process.env.APP_API_KEY || "";

const admin_username = process.env.ADMIN_USERNAME || "";
const admin_password = process.env.ADMIN_PASSWORD_HASH || "";
const session_secret = process.env.SESSION_SECRET || "";

const dashboard_origin = process.env.DASHBOARD_ORIGIN || "";
const trust_proxy = parseTrustProxy(process.env.TRUST_PROXY, node_env === "production" ? 1 : false);
const app_auth_jwt_secret =
  process.env.APP_AUTH_JWT_SECRET || session_secret || app_api_key || "";
const app_auth_jwt_issuer = process.env.APP_AUTH_JWT_ISSUER || "havok-api";
const app_auth_jwt_audience =
  process.env.APP_AUTH_JWT_AUDIENCE || "havok-mobile-app";
const app_attestation_mode =
  process.env.APP_ATTESTATION_MODE || (node_env === "production" ? "production" : "development");
const app_session_ttl_seconds =
  Number(process.env.APP_SESSION_TTL_SECONDS) || 10 * 60;
const app_challenge_ttl_seconds =
  Number(process.env.APP_CHALLENGE_TTL_SECONDS) || 3 * 60;

module.exports = {
  port,
  node_env,
  fortnite_auth_client,
  fortnite_device_auth_file,
  app_api_key,
  admin_username,
  admin_password,
  session_secret,
  dashboard_origin,
  trust_proxy,
  app_auth_jwt_secret,
  app_auth_jwt_issuer,
  app_auth_jwt_audience,
  app_attestation_mode,
  app_session_ttl_seconds,
  app_challenge_ttl_seconds
};

function parseTrustProxy(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalizedValue = String(value).trim().toLowerCase();

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  const numericValue = Number(normalizedValue);

  if (Number.isInteger(numericValue) && numericValue >= 0) {
    return numericValue;
  }

  return value;
}

const {
  app_api_key,
  app_attestation_mode,
  app_auth_jwt_secret,
  allowed_origins,
  demo_mode,
  node_env
} = require("./env.js");
const { SUPPORTED_ATTESTATION_MODES } = require("../services/appAttestation.service.js");

function validateEnv() {
  const errors = [];
  const warnings = [];
  const isProduction = node_env === "production";

  if (!SUPPORTED_ATTESTATION_MODES.has(app_attestation_mode)) {
    errors.push(
      `APP_ATTESTATION_MODE="${app_attestation_mode}" est invalide. Utilise ${Array.from(
        SUPPORTED_ATTESTATION_MODES
      ).join(" ou ")}.`
    );
  }

  if (!app_api_key) {
    errors.push("APP_API_KEY est requis.");
  }

  if (!app_auth_jwt_secret) {
    errors.push("APP_AUTH_JWT_SECRET est requis.");
  }

  if (demo_mode) {
    warnings.push(
      "DEMO_MODE actif: l API publique est exposee sans dashboard."
    );
    return {
      errors,
      warnings
    };
  }

  if (isProduction) {
    if (allowed_origins.length === 0) {
      warnings.push(
        "ALLOWED_ORIGINS est vide. Seuls localhost et les clients explicites seront autorises par CORS."
      );
    }

    if (app_attestation_mode === "development") {
      errors.push(
        "APP_ATTESTATION_MODE=development n est pas autorise pour un deploiement de production."
      );
    }
  }

  return {
    errors,
    warnings
  };
}

module.exports = {
  validateEnv
};

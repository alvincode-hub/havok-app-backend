const {
  extractBearerToken,
  verifyAppSessionToken
} = require("../services/appSession.service.js");
const { node_env } = require("../config/env.js");
const { logWarning } = require("../utils/logger.js");

function requireAppSession(req, res, next) {
  const isDevMode = node_env !== "production";

  if (isDevMode) {
    return next();
  }

  const bearerToken = extractBearerToken(req.headers.authorization);

  if (!bearerToken) {
    return res.status(401).json({
      success: false,
      error: "Session mobile manquante"
    });
  }

  try {
    req.appSession = verifyAppSessionToken(bearerToken);
    return next();
  } catch (error) {
    logWarning(
      `Session mobile invalide pour ${req.method} ${req.originalUrl}: ${error.message}`,
      "AppSessionSecurity"
    );

    return res.status(401).json({
      success: false,
      error: "Session mobile invalide"
    });
  }
}

module.exports = {
  requireAppSession
};
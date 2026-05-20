const {
  createAppChallenge,
  createAppSession
} = require("../services/appSession.service.js");
const { logError, logWarning } = require("../utils/logger.js");

async function createAppChallengeController(req, res) {
  try {
    const payload = createAppChallenge({
      installationId: req.body?.installationId,
      platform: req.body?.platform,
      appVersion: req.body?.appVersion,
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });

    return res.status(201).json({
      success: true,
      ...payload
    });
  } catch (error) {
    logWarning(
      `Challenge mobile refuse: ${error.message}`,
      "AppSessionController"
    );

    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
}

async function createAppSessionController(req, res) {
  try {
    const payload = await createAppSession({
      challenge: req.body?.challenge,
      installationId: req.body?.installationId,
      platform: req.body?.platform,
      appVersion: req.body?.appVersion,
      attestation: req.body?.attestation
    });

    return res.status(201).json({
      success: true,
      ...payload
    });
  } catch (error) {
    const statusCode = getSessionErrorStatusCode(error.message);

    if (statusCode >= 500) {
      logError(
        "Creation de session mobile impossible",
        "AppSessionController",
        error
      );
    } else {
      logWarning(
        `Session mobile refusee: ${error.message}`,
        "AppSessionController"
      );
    }

    return res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
}

function getSessionErrorStatusCode(message = "") {
  const normalizedMessage = String(message).toLowerCase();

  if (
    normalizedMessage.includes("attestation native") ||
    normalizedMessage.includes("app_auth_jwt_secret")
  ) {
    return 500;
  }

  if (normalizedMessage.includes("challenge")) {
    return 401;
  }

  return 400;
}

module.exports = {
  createAppChallengeController,
  createAppSessionController
};

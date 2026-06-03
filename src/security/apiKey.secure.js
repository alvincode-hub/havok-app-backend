const { app_api_key, demo_mode } = require("../config/env.js");

function requireAppKey(req, res, next) {
  if (demo_mode) {
    return next();
  }

  const appKey = req.headers["x-app-key"];

  if (!appKey || appKey !== app_api_key) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized"
    });
  }

  next();
}

module.exports = {
  requireAppKey
};

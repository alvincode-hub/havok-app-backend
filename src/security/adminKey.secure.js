const { demo_mode } = require("../config/env.js");

function requireAdminAuth(req, res, next) {
  if (demo_mode) {
    if (req.method === "GET" || req.method === "HEAD") {
      return next();
    }

    return res.status(403).json({
      error: "Mode demo: modifications desactivees."
    });
  }

  if (!req.session || !req.session.admin) {
    if (req.originalUrl.startsWith("/api/dashboard") || req.originalUrl.startsWith("/dashboard/api")) {
      return res.status(401).json({
        error: "Session dashboard invalide. Reconnecte-toi."
      });
    }

    return res.redirect("/dashboard/login");
  }

  next();
}

module.exports = {requireAdminAuth};

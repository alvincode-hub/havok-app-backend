function requireAdminAuth(req, res, next) {
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

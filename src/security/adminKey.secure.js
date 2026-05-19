function requireAdminAuth(req, res, next) {
  if (!req.session || !req.session.admin) {
    return res.redirect("/dashboard/login");
  }

  next();
}

module.exports = {requireAdminAuth};
function requireAppKey(req, res, next) {
  const appKey = req.headers["x-app-key"];

  if (!appKey || appKey !== process.env.APP_API_KEY) {
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
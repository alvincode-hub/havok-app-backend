const express = require("express");
const { requireAppKey } = require("../security/apiKey.secure.js");
const { requireAppSession } = require("../security/appSession.secure.js");

const {
  getTournamentResultsController,
  getPlayerController,
  getAllPlayersController,
  getTournamentCalendarController,
  getTournamentWindowController,
  getHomeController,
  getTournamentWindowListController
} = require("../controllers/api.controlleur.js");

const router = express.Router();

router.get("/api/health", (req, res) => {
  res.json({ message: "API OK" });
});

router.get("/api/home", requireAppKey, requireAppSession, getHomeController);

router.get(
  "/api/tournaments/results",
  requireAppKey,
  requireAppSession,
  getTournamentResultsController
);

router.get(
  "/api/tournaments/allWindow",
  requireAppKey,
  requireAppSession,
  getTournamentWindowListController
);

router.get(
  "/api/tournaments/window",
  requireAppKey,
  requireAppSession,
  getTournamentWindowController
);

router.get(
  "/api/tournaments/calendrier",
  requireAppKey,
  requireAppSession,
  getTournamentCalendarController
);

router.get(
  "/api/players",
  requireAppKey,
  requireAppSession,
  getAllPlayersController
);

router.get(
  "/api/player",
  requireAppKey,
  requireAppSession,
  getPlayerController
);

module.exports = router;

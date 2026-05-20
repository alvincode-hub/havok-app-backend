const express = require("express");
const { requireAppKey } = require("../security/apiKey.secure.js");

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

router.get("/api/home", requireAppKey, getHomeController);

router.get(
  "/api/tournaments/results",
  requireAppKey,
  getTournamentResultsController
);

router.get(
  "/api/tournaments/allWindow",
  requireAppKey,
  getTournamentWindowListController
);

router.get(
  "/api/tournaments/window",
  requireAppKey,
  getTournamentWindowController
);

router.get(
  "/api/tournaments/calendrier",
  requireAppKey,
  getTournamentCalendarController
);

router.get(
  "/api/players",
  requireAppKey,
  getAllPlayersController
);

router.get(
  "/api/player",
  requireAppKey,
  getPlayerController
);

module.exports = router;
const express = require("express");
const { requireAdminAuth } = require("../security/adminKey.secure.js");

const {
  getDashboardController,
  getDashboardStatusController,
  getDashboardTeamConfigController,
  updateDashboardTeamConfigController,
  getDashboardTournamentFilterController,
  updateDashboardTournamentFilterController,
  getDashboardActuConfigController,
  updateDashboardActuConfigController,
  getDashboardCastConfigController,
  updateDashboardCastConfigController,
  updateCronDashboardController
} = require("../controllers/dashboard.controlleur.js");

const router = express.Router();

router.get("/api/dashboard", requireAdminAuth, getDashboardController);
router.get("/api/dashboard/status", requireAdminAuth, getDashboardStatusController);

router.get(
  "/api/dashboard/config/team",
  requireAdminAuth,
  getDashboardTeamConfigController
);

router.put(
  "/api/dashboard/config/team",
  requireAdminAuth,
  updateDashboardTeamConfigController
);

router.get(
  "/api/dashboard/config/tournament-filter",
  requireAdminAuth,
  getDashboardTournamentFilterController
);

router.put(
  "/api/dashboard/config/tournament-filter",
  requireAdminAuth,
  updateDashboardTournamentFilterController
);

router.get(
  "/api/dashboard/config/actu",
  requireAdminAuth,
  getDashboardActuConfigController
);

router.put(
  "/api/dashboard/config/actu",
  requireAdminAuth,
  updateDashboardActuConfigController
);

router.get(
  "/api/dashboard/config/cast",
  requireAdminAuth,
  getDashboardCastConfigController
);

router.put(
  "/api/dashboard/config/cast",
  requireAdminAuth,
  updateDashboardCastConfigController
);

router.post(
  "/api/dashboard/updateCron",
  requireAdminAuth,
  updateCronDashboardController
);

module.exports = router;
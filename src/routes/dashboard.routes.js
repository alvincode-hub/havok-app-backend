const express = require("express");
const { requireAdminAuth } = require("../security/adminKey.secure.js");
const {
  getDashboardController,
  getDashboardOverviewController,
  getDashboardEventsController,
  getDashboardEventDetailController,
  getDashboardContentController,
  getDashboardConfigController,
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
router.get("/api/dashboard/overview", requireAdminAuth, getDashboardOverviewController);
router.get("/api/dashboard/events", requireAdminAuth, getDashboardEventsController);
router.get("/api/dashboard/events/:eventId", requireAdminAuth, getDashboardEventDetailController);
router.get("/api/dashboard/content", requireAdminAuth, getDashboardContentController);
router.get("/api/dashboard/config", requireAdminAuth, getDashboardConfigController);
router.get("/api/dashboard/status", requireAdminAuth, getDashboardStatusController);

router
  .route("/api/dashboard/config/team")
  .get(requireAdminAuth, getDashboardTeamConfigController)
  .put(requireAdminAuth, updateDashboardTeamConfigController);

router
  .route("/api/dashboard/config/tournament-filter")
  .get(requireAdminAuth, getDashboardTournamentFilterController)
  .put(requireAdminAuth, updateDashboardTournamentFilterController);

router
  .route("/api/dashboard/config/actu")
  .get(requireAdminAuth, getDashboardActuConfigController)
  .put(requireAdminAuth, updateDashboardActuConfigController);

router
  .route("/api/dashboard/config/cast")
  .get(requireAdminAuth, getDashboardCastConfigController)
  .put(requireAdminAuth, updateDashboardCastConfigController);

router.post("/api/dashboard/updateCron", requireAdminAuth, updateCronDashboardController);

module.exports = router;

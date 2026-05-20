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

const dashboardPrefixes = ["/api/dashboard", "/dashboard/api"];

registerGet("", getDashboardController);
registerGet("/overview", getDashboardOverviewController);
registerGet("/events", getDashboardEventsController);
registerGet("/events/:eventId", getDashboardEventDetailController);
registerGet("/content", getDashboardContentController);
registerGet("/config", getDashboardConfigController);
registerGet("/status", getDashboardStatusController);

registerGetPut(
  "/config/team",
  getDashboardTeamConfigController,
  updateDashboardTeamConfigController
);
registerGetPut(
  "/config/tournament-filter",
  getDashboardTournamentFilterController,
  updateDashboardTournamentFilterController
);
registerGetPut(
  "/config/actu",
  getDashboardActuConfigController,
  updateDashboardActuConfigController
);
registerGetPut(
  "/config/cast",
  getDashboardCastConfigController,
  updateDashboardCastConfigController
);

dashboardPrefixes.forEach((prefix) => {
  router.post(`${prefix}/updateCron`, requireAdminAuth, updateCronDashboardController);
});

function registerGet(suffix, handler) {
  dashboardPrefixes.forEach((prefix) => {
    router.get(`${prefix}${suffix}`, requireAdminAuth, handler);
  });
}

function registerGetPut(suffix, getHandler, putHandler) {
  dashboardPrefixes.forEach((prefix) => {
    router
      .route(`${prefix}${suffix}`)
      .get(requireAdminAuth, getHandler)
      .put(requireAdminAuth, putHandler);
  });
}

module.exports = router;

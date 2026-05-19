const {
  getDashboardPayload,
  getDashboardOverview,
  getDashboardEvents,
  getDashboardEventDetail,
  getDashboardContent,
  getDashboardConfig,
  getDashboardStatus,
  getDashboardTeamConfig,
  updateDashboardTeamConfig,
  getDashboardTournamentFilter,
  updateDashboardTournamentFilter,
  getDashboardActuConfig,
  updateDashboardActuConfig,
  getDashboardCastConfig,
  updateDashboardCastConfig,
  updateAllCron
} = require("../services/dashboard.service.js");
const { logError } = require("../utils/logger.js");

function createReadController(action, errorMessage, options = {}) {
  const { notFoundMessage = "" } = options;

  return async function dashboardReadController(req, res) {
    try {
      const payload = await action(req);

      if (payload === null && notFoundMessage) {
        return res.status(404).json({ error: notFoundMessage });
      }

      return res.json(payload);
    } catch (error) {
      logError(errorMessage, "DashboardController", error);
      return res.status(500).json({ error: `Erreur lors de ${errorMessage.toLowerCase()}.` });
    }
  };
}

function createUpdateController(action, successMessage, errorMessage) {
  return async function dashboardUpdateController(req, res) {
    try {
      const config = await action(req.body);

      return res.json({
        ok: true,
        message: successMessage,
        config
      });
    } catch (error) {
      logError(errorMessage, "DashboardController", error);
      return res.status(400).json({ error: error.message || `Erreur lors de ${errorMessage.toLowerCase()}.` });
    }
  };
}

const getDashboardController = createReadController(
  () => getDashboardPayload(),
  "la construction du dashboard"
);

const getDashboardOverviewController = createReadController(
  () => getDashboardOverview(),
  "la lecture de l'overview dashboard"
);

const getDashboardEventsController = createReadController(
  () => getDashboardEvents(),
  "la lecture des events dashboard"
);

const getDashboardEventDetailController = createReadController(
  (req) => getDashboardEventDetail(req.params.eventId),
  "la lecture du detail d'event dashboard",
  { notFoundMessage: "Event introuvable." }
);

const getDashboardContentController = createReadController(
  () => getDashboardContent(),
  "la lecture du contenu dashboard"
);

const getDashboardConfigController = createReadController(
  () => getDashboardConfig(),
  "la lecture de la configuration dashboard"
);

const getDashboardStatusController = createReadController(
  () => getDashboardStatus(),
  "la lecture du status dashboard"
);

const getDashboardTeamConfigController = createReadController(
  () => getDashboardTeamConfig(),
  "la lecture de la config team"
);

const updateDashboardTeamConfigController = createUpdateController(
  updateDashboardTeamConfig,
  "Config team sauvegardee.",
  "la sauvegarde de la config team"
);

const getDashboardTournamentFilterController = createReadController(
  () => getDashboardTournamentFilter(),
  "la lecture du tournament filter"
);

const updateDashboardTournamentFilterController = createUpdateController(
  updateDashboardTournamentFilter,
  "Tournament filter sauvegarde.",
  "la sauvegarde du tournament filter"
);

const getDashboardActuConfigController = createReadController(
  () => getDashboardActuConfig(),
  "la lecture de la config actu"
);

const updateDashboardActuConfigController = createUpdateController(
  updateDashboardActuConfig,
  "Actu sauvegardee.",
  "la sauvegarde de la config actu"
);

const getDashboardCastConfigController = createReadController(
  () => getDashboardCastConfig(),
  "la lecture de la config cast"
);

const updateDashboardCastConfigController = createUpdateController(
  updateDashboardCastConfig,
  "Config cast sauvegardee.",
  "la sauvegarde de la config cast"
);

const updateCronDashboardController = createReadController(
  () => updateAllCron(),
  "le lancement des cron"
);

module.exports = {
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
};

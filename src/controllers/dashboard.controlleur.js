const {
  getDashboardPayload,
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

async function getDashboardController(req, res) {
  try {
    const payload = await getDashboardPayload();
    res.json(payload);
  } catch (error) {
    logError("Construction du payload dashboard impossible", "DashboardController", error);
    res.status(500).json({ error: "Erreur lors de la construction du dashboard." });
  }
}

async function getDashboardStatusController(req, res) {
  try {
    const payload = await getDashboardStatus();
    res.json(payload);
  } catch (error) {
    logError("Lecture du status dashboard impossible", "DashboardController", error);
    res.status(500).json({ error: "Erreur lors de la lecture du status dashboard." });
  }
}

async function getDashboardTeamConfigController(req, res) {
  try {
    const config = await getDashboardTeamConfig();
    res.json(config);
  } catch (error) {
    logError("Lecture de la config team impossible", "DashboardController", error);
    res.status(500).json({ error: "Erreur lors de la lecture de la config team." });
  }
}

async function updateDashboardTeamConfigController(req, res) {
  try {
    const config = await updateDashboardTeamConfig(req.body);
    res.json({
      ok: true,
      message: "Config team sauvegardee.",
      config
    });
  } catch (error) {
    logError("Sauvegarde de la config team impossible", "DashboardController", error);
    res.status(400).json({ error: error.message || "Erreur lors de la sauvegarde de la config team." });
  }
}

async function getDashboardTournamentFilterController(req, res) {
  try {
    const config = await getDashboardTournamentFilter();
    res.json(config);
  } catch (error) {
    logError("Lecture du tournament filter impossible", "DashboardController", error);
    res.status(500).json({ error: "Erreur lors de la lecture du tournament filter." });
  }
}

async function updateDashboardTournamentFilterController(req, res) {
  try {
    const config = await updateDashboardTournamentFilter(req.body);
    res.json({
      ok: true,
      message: "Tournament filter sauvegarde.",
      config
    });
  } catch (error) {
    logError("Sauvegarde du tournament filter impossible", "DashboardController", error);
    res.status(400).json({ error: error.message || "Erreur lors de la sauvegarde du tournament filter." });
  }
}

async function getDashboardActuConfigController(req, res) {
  try {
    const config = await getDashboardActuConfig();
    res.json(config);
  } catch (error) {
    logError("Lecture de la config actu impossible", "DashboardController", error);
    res.status(500).json({ error: "Erreur lors de la lecture de la config actu." });
  }
}

async function updateDashboardActuConfigController(req, res) {
  try {
    const config = await updateDashboardActuConfig(req.body);
    res.json({
      ok: true,
      message: "Actu sauvegardee.",
      config
    });
  } catch (error) {
    logError("Sauvegarde de la config actu impossible", "DashboardController", error);
    res.status(400).json({ error: error.message || "Erreur lors de la sauvegarde de la config actu." });
  }
}

async function getDashboardCastConfigController(req, res) {
  try {
    const config = await getDashboardCastConfig();
    res.json(config);
  } catch (error) {
    logError("Lecture de la config cast impossible", "DashboardController", error);
    res.status(500).json({ error: "Erreur lors de la lecture de la config cast." });
  }
}

async function updateDashboardCastConfigController(req, res) {
  try {
    const config = await updateDashboardCastConfig(req.body);
    res.json({
      ok: true,
      message: "Config cast sauvegardee.",
      config
    });
  } catch (error) {
    logError("Sauvegarde de la config cast impossible", "DashboardController", error);
    res.status(400).json({ error: error.message || "Erreur lors de la sauvegarde de la config cast." });
  }
}

async function updateCronDashboardController(req, res) {
  try {
    const result = await updateAllCron();
    res.json(result);
  } catch (error) {
    logError("Lancement des Cron impossible", "DashboardController", error);
    res.status(400).json({ error: error.message || "Erreur lors du lancement des Cron." });
  }
}


module.exports = {
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
};

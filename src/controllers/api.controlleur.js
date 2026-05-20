const {
  getTournamentResults,
  getTournamentWindow,
  getTournamentCalendar,
  getHome,
  getAllPlayers,
  getPlayer,
  getAllWindow } = require("../services/api.service.js");
const { logError, logWarning } = require("../utils/logger");

async function getTournamentResultsController(req, res) {
  const { windowId, page, cumulatif } = req.query;

  if (!windowId) {
    logWarning("Requete results rejetee: windowId manquant", "TournamentResultsController");
    return res.status(400).json({ error: "windowId est requis" });
  }

  try {
    const results = await getTournamentResults(windowId,page,cumulatif);
    res.json(results);
  } catch (error) {
    logError("Recuperation des resultats de tournoi impossible", "TournamentResultsController", error);
    res.status(500).json({ error: "Erreur lors de la recuperation des resultats de tournoi" });
  }
}

async function getTournamentWindowListController(req, res) {
  const { windowId, eventId } = req.query;

  if (!windowId && !eventId) {
    logWarning("Requete results rejetee: windowId ou eventId manquant", "TournamentWindowListController");
    return res.status(400).json({ error: "windowId ou eventId est requis" });
  }

  try {
    const results = await getAllWindow(windowId,eventId);
    res.json(results);
  } catch (error) {
    logError("Recuperation des resultats de tournoi impossible", "TournamentWindowListController", error);
    res.status(500).json({ error: "Erreur lors de la recuperation des windows d'un tournoi" });
  }
}

async function getTournamentWindowController(req, res) {
  const { windowId } = req.query;

  if (!windowId) {
    logWarning("Requete results rejetee: windowId manquant", "TournamentWindowController");
    return res.status(400).json({ error: "windowId est requis" });
  }

  try {
    const results = await getTournamentWindow(windowId);
    res.json(results);
  } catch (error) {
    logError("Recuperation des details de tournoi impossible", "TournamentWindowController", error);
    res.status(500).json({ error: "Erreur lors de la recuperation des details de tournoi" });
  }
}

async function getTournamentCalendarController(req, res) {
  try {
    const results = await getTournamentCalendar();
    res.json(results);
  } catch (error) {
    logError("Recuperation du calendrier des tournois impossible", "TournamentCalendarController", error);
    res.status(500).json({ error: "Erreur lors de la recuperation  du calendrier des tournois" });
  }
}

async function getHomeController(req, res) {
  try {
    const results = await getHome();
    res.json(results);
  } catch (error) {
    logError("Recuperation de l'acceuil impossible", "HomeController", error);
    res.status(500).json({ error: "Erreur lors de la recuperation de l'acceuil" });
  }
}

async function getAllPlayersController(req, res) {
  try {
    const results = await getAllPlayers();
    res.json(results);
  } catch (error) {
    logError("Recuperation des joueurs impossible", "AllPlayersController", error);
    res.status(500).json({ error: "Erreur lors de la recuperation des joueurs" });
  }
}

async function getPlayerController(req, res) {
  const { playerId } = req.query;

  if (!playerId) {
    logWarning("Requete results rejetee: playerId manquant", "PlayerController");
    return res.status(400).json({ error: "playerId est requis" });
  }

  try {
    const results = await getPlayer(playerId);
    res.json(results);
  } catch (error) {
    logError(`Recuperation du joueur ${playerId} impossible`, "PlayerController", error);
    res.status(500).json({ error: "Erreur lors de la recuperation du joueur "+ playerId });
  }
}


module.exports = {
  getTournamentResultsController,
  getPlayerController,
  getAllPlayersController,
  getTournamentCalendarController,
  getTournamentWindowController,
  getHomeController,
  getTournamentWindowListController
};

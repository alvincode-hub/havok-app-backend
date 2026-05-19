const { loadEnrichedData } = require("../storage/enrichedStore.js");

async function getTournamentResults(windowId) {
  const tournaments = await loadEnrichedData("/enriched/results.json");

  const tournamentResult = tournaments.find((el) => {
    return el.windowId == windowId;
  });

  return tournamentResult || null;
}

async function getTournamentWindow(windowId) {
  const tournaments = await loadEnrichedData("/enriched/window-details.json");

  const tournamentResult = tournaments.find((el) => {
    return el.windowId == windowId;
  });

  return tournamentResult || null;
}

async function getTournamentCalendar() {
  const calendrier = await loadEnrichedData("/enriched/calendrier.json");
  return calendrier || null;
}

async function getHome() {
  const home = await loadEnrichedData("/enriched/home.json");
  return home || null;
}

async function getAllPlayers() {
  const players = await loadEnrichedData("/enriched/players.json");

  const playersProfile = players.map((el) => {
    return {
      id: el.id,
      name: el.name,
      image: el.image,
      pseudo: el.pseudo || null,
      country: el.country || null,
      countryFlag: el.countryFlag || null,
      top5: el.top5 ?? null,
      bestTop: el.bestTop ?? null
    };
  });

  return playersProfile || null;
}

async function getPlayer(accountId) {
  const players = await loadEnrichedData("/enriched/players.json");

  const player = players.find((el) => {
    return el.id == accountId;
  });

  return player || null;
}

module.exports = {
  getTournamentResults,
  getTournamentWindow,
  getTournamentCalendar,
  getHome,
  getAllPlayers,
  getPlayer
};

const { loadEnrichedData } = require("../storage/enrichedStore.js");

async function getTournamentResults(windowId, page, cumulatif) {
  const tournaments = await loadEnrichedData("/enriched/results.json");
  const requestedPage = Number(page) || 0;
  const cumulatifToggle = parseBooleanQuery(cumulatif);

  if (!Array.isArray(tournaments)) {
    return null;
  }

  const tournamentResult = tournaments.find((el) => {
    return el.windowId == windowId;
  });

  if (!tournamentResult) {
    return null;
  }

  const leaderboardType = cumulatifToggle
    ? tournamentResult.leaderboardCumul
    : tournamentResult.leaderboard;

  if (!leaderboardType) {
    return null;
  }

  const {
    totalPages,
    results
  } = getLeaderboardPageResults(leaderboardType, cumulatifToggle, requestedPage);

  const leaderboard = {
    id: leaderboardType.id,
    windowId: leaderboardType.windowId,
    totalPages,
    results,
    qualStatus: leaderboardType.qualStatus || []
  };

  const response = {
    tournamentId: tournamentResult.tournamentId,
    tournamentName: tournamentResult.tournamentName,
    windowId: tournamentResult.windowId,
    start: tournamentResult.start,
    end: tournamentResult.end,
    leaderboard,
    players: tournamentResult.players || []
  };

  return response || null;
}

function parseBooleanQuery(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();
  return normalizedValue === "true" || normalizedValue === "1";
}

function getLeaderboardPageResults(leaderboardType, isCumulative, requestedPage) {
  const pages = isCumulative ? leaderboardType.pagesCumul : leaderboardType.pages;
  const totalPagesValue = isCumulative
    ? leaderboardType.totalPagesCumul
    : leaderboardType.totalPages;

  return {
    totalPages: Number(totalPagesValue) || 1,
    results: Array.isArray(pages) ? pages[requestedPage] || [] : []
  };
}

async function getAllWindow(windowId, eventId) {
  const tournamentsList = await loadEnrichedData("/enriched/eventList.json");

  if (!windowId && !eventId) {
    return null;
  }

  if (eventId) {
    return tournamentsList.find(event => event.id === eventId) || null;
  }

  if (windowId) {
    for (const event of tournamentsList) {
      const foundWindow = event.windows.find(
        window => window.windowId === windowId
      );

      if (foundWindow) {
        return event;
      }
    }
  }

  return null;
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
      countryFlag: el.countryFlag || null
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
  getPlayer,
  getAllWindow
};

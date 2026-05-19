const { findPlayerTop } = require("../services/findPlayersTop.js");
const { loadConfigData } = require("../storage/configStore.js");
const { loadNormalizedData } = require("../storage/normalizedStore.js");
const { normalizedPlayerPath, normalizedTournamentsPath } = require("../storage/paths.js");
const { loadAcceptedEventIds, isEventAccepted } = require("../services/filterEvents.js");
const { getWindowSuffix } = require("../utils/windowSuffix.js");
const fs = require("fs");
const path = require("path");

async function enrichedPlayers() {
  const playersArr = [];
  const playerConfig = await loadConfigData("config/team.json");

  if (!playerConfig?.players || playerConfig.players.length === 0) {
    return [];
  }

  const tournaments = (await loadNormalizedData(normalizedTournamentsPath())) || [];
  const acceptedEventIds = await loadAcceptedEventIds();

  for (const player of playerConfig.players) {
    const id = player.accountId;
    const name = player.name;
    const image = player.image || null;
    const normalizedProfile = await loadNormalizedPlayerIfExists(id);
    const pseudo = normalizedProfile?.name || name || id;

    const tournamentParticipated = [];

    for (const tournament of tournaments) {
      if (!(await isEventAccepted(tournament.id, acceptedEventIds))) {
        continue;
      }

      for (const tournamentWindow of tournament.windows || []) {
        const result = await findPlayerTop(id, tournamentWindow);
        const tournamentName = `${tournament.name} ${getWindowSuffix(tournamentWindow.windowId)}`.trim();
        if (result) {
          tournamentParticipated.push({
            tournamentId: tournament.id || null,
            tournamentName: tournamentName || tournament.name || null,
            windowId: tournamentWindow.windowId || null,
            start: tournamentWindow.start || null,
            end: tournamentWindow.end || null,
            image: tournament.images?.square || null,
            teamFormat: tournamentWindow.teamFormat || null,
            gameMode: tournamentWindow.mode || null,
            result
          });
        }
      }
    }

    tournamentParticipated.sort((a, b) => new Date(b.start) - new Date(a.start));

    playersArr.push({
      id,
      name,
      pseudo,
      image,
      countryFlag: player.countryFlag,
      country: player.country,
      top5: getTop5(tournamentParticipated),
      bestTop:getBestTop(tournamentParticipated),
      avgKill: avgKill(tournamentParticipated),
      avgTop: avgTop(tournamentParticipated),
      lastTournaments: tournamentParticipated
    });
  }

  return playersArr;
}

async function loadNormalizedPlayerIfExists(accountId) {
  const relativePath = normalizedPlayerPath(accountId);
  const absolutePath = path.join(__dirname, "../../data", relativePath);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return loadNormalizedData(relativePath);
}

function getTop5(tournamentParticipated){
  let top5 = 0;
  tournamentParticipated.forEach((el)=>{
    if (el.result.rank <= 5) {
      top5 += 1;
    }
  });
  return top5;
}

function avgTop(tournamentParticipated) {
  const ranks = tournamentParticipated
    .map((el) => el.result?.rank)
    .filter((rank) => typeof rank === "number");

  return ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : 0;
}

function avgKill(tournamentParticipated) {
  const kills = tournamentParticipated
    .map((el) => el.result?.kills)
    .filter((kill) => typeof kill === "number");

  return kills.length ? kills.reduce((a, b) => a + b, 0) / kills.length : 0;
}

function getBestTop(tournamentParticipated){
  let bestTop = null;
  tournamentParticipated.forEach((el)=>{
    if (!bestTop) {
      bestTop = el.result.rank;
    }

    if (el.result.rank <= bestTop) {
      bestTop = el.result.rank;
    }
  });
  return bestTop;
}

module.exports = { enrichedPlayers };

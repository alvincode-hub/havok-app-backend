const { getAllPlayersName } = require("../fnbr/profile.js");

async function normalizeTournamentsResults(tournaments, rawResults) {
  const entries = tournaments.entries || rawResults.entries || [];

  const allAccountIds = entries.flatMap((result) => {
    return getTeamAccountIds(result.teamId);
  });

  const namesMap = await getPlayersNamesMap(allAccountIds);

  const resultsArr = entries.map((result) => {
    const accountIds = getTeamAccountIds(result.teamId);

    const gameArr = (result.sessionHistory || []).map((session) => {
      return {
        id: session.sessionId,
        end: session.endTime,
        placement: session.trackedStats?.PLACEMENT_STAT_INDEX || 0,
        kills: session.trackedStats?.TEAM_ELIMS_STAT_INDEX || 0,
        timeAlived: session.trackedStats?.TIME_ALIVE_STAT || 0
      };
    });

    return {
      rank: result.rank,
      accountIds,
      names: getNamesFromAccountIds(accountIds, namesMap),
      teamAccountId: result.teamId,
      points: result.pointsEarned,
      nbGamesPlayed: result.sessionHistory?.length || 0,
      kills: getNbKills(result),
      top15s: getNbTop(result, 15),
      top5s: getNbTop(result, 5),
      wins: getNbTop(result, 1),
      pointsKills: result.pointBreakdown?.["TEAM_ELIMS_STAT_INDEX:1"]?.pointsEarned || 0,
      pointsTop: getPointsTop(result) || 0,
      avrgPlacement: getAvrgPlacement(result) || 0,
      avrgKill: getAvrgKill(result) || 0,
      sessionHistory: gameArr
    };
  });

  return {
    id: tournaments.eventId,
    windowId: tournaments.eventWindowId,
    page: tournaments.page,
    totalPages: Math.min(tournaments.totalPages || 1, 10),
    results: resultsArr
  };
}

function getTeamAccountIds(teamId = "") {
  return String(teamId)
    .split(":")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function getPlayersNamesMap(accountIds) {
  const uniqueIds = [...new Set(accountIds)].filter(Boolean);

  const players = await getAllPlayersName(uniqueIds);

  const namesMap = {};

  for (const player of players || []) {
    const id = player.accountId || player.id;
    const name = player.displayName || id;

    if (id) {
      namesMap[id] = name;
    }
  }

  return namesMap;
}

function getNamesFromAccountIds(accountIds, namesMap) {
  return accountIds.map((id) => namesMap[id] || id);
}

function getNbTop(result, top) {
  return (result.sessionHistory || []).reduce((acc, session) => {
    const placement = session.trackedStats?.PLACEMENT_STAT_INDEX;

    if (placement && placement <= top) {
      acc += 1;
    }

    return acc;
  }, 0);
}

function getNbKills(result) {
  return (result.sessionHistory || []).reduce(
    (acc, session) => acc + (session.trackedStats?.TEAM_ELIMS_STAT_INDEX || 0),
    0
  );
}

function getPointsTop(result) {
  const breakdown = result.pointBreakdown || {};
  let total = 0;

  for (const key in breakdown) {
    if (key.startsWith("PLACEMENT_STAT_INDEX")) {
      total += breakdown[key].pointsEarned || 0;
    }
  }

  return total;
}

function getAvrgPlacement(result) {
  const sessions = result.sessionHistory || [];

  const total = sessions.reduce(
    (sum, session) => sum + (session.trackedStats?.PLACEMENT_STAT_INDEX || 0),
    0
  );

  return total / (sessions.length || 1);
}

function getAvrgKill(result) {
  const sessions = result.sessionHistory || [];

  const total = sessions.reduce(
    (sum, session) => sum + (session.trackedStats?.TEAM_ELIMS_STAT_INDEX || 0),
    0
  );

  return total / (sessions.length || 1);
}

module.exports = {
  normalizeTournamentsResults
};
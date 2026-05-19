const fs = require("fs");
const path = require("path");
const { loadConfigData } = require("../storage/configStore");

let castEntriesCache = null;

async function normalizeTournaments(tournaments) {
    const normalizedTournaments = [];
    
    for (const tournament of tournaments) {
        const windowArr = [];
        
        for (const window of (tournament.windows || [])) {
            const scoreLocations = window.scoreLocations || [];
            const resolvedLocations = window.resolvedLocations || [];
            const mainLeaderboardIndex = getMainLeaderboardIndex(scoreLocations);
            const leaderboardId = getMainLeaderboardId(window, scoreLocations, mainLeaderboardIndex);
            const resolvedLocation = getMainResolvedLocation(resolvedLocations, mainLeaderboardIndex);

            let prizePoolArr = [];

            (window.leaderboardDefs || []).forEach(leaderboardDef => {
                (leaderboardDef.payoutTable || []).forEach(payoutTable => {
                    (payoutTable.ranks || []).forEach(rank => {
                        (rank.payouts || []).forEach(payout => {

                            const prize = {

                                scoringType: payoutTable.scoringType || null,
                                scoringTypeDisplayName:
                                    payoutTable.scoringType === "rank" ? "Top" :
                                    payoutTable.scoringType === "value" ? "Points / condition" :
                                    payoutTable.scoringType === "percentile" ? "Pourcentage" :
                                    "Inconnu",

                                threshold: rank.threshold,

                                rewardType: payout.rewardType || null,
                                rewardTypeDisplayName:
                                    payout.rewardType === "ecomm" ? "Cash prize" :
                                    payout.rewardType === "token" ? "Qualification" :
                                    payout.rewardType === "game" ? "Cosmetique" :
                                    "Inconnu",

                                rewardMode: payout.rewardMode || null,
                                value: payout.value || null,
                                quantity: payout.quantity || null,
                            };

                            prizePoolArr.push(prize);
                        });
                    });
                });
            });

            const windowObj = {
                windowId: window.id,
                start: window.beginTime,
                end: window.endTime,

                cast: await getCast(window.id),

                matchCap: window.matchCap || 0,
                playlistId: window.playlistId || null,

                mode: getModeFromPlaylist(window.playlistId),
                teamSize: getTeamSizeFromPlaylist(window.playlistId),
                teamFormat: getTeamFormatFromPlaylist(window.playlistId),

                scoreLocations: scoreLocations.length > 0 ? scoreLocations : null,
                leaderboardId,
                resolvedLocation,
                resolvedLocations,

                requiresQualification:
                    (window.requireAllTokens || []).length > 0 ||
                    (window.requireAnyTokens || []).length > 0,

                requiredTokens: window.requireAllTokens || [],
                anyRequiredTokens: window.requireAnyTokens || [],
                blockedTokens: window.requireNoneTokensCaller || [],

                prizes: prizePoolArr
            };
            windowArr.push(windowObj);
        }

        const tournamentObj = {
            id: tournament.id,

            name:
                tournament.texts?.longFormatTitle ||
                tournament.texts?.titleLine1 ||
                "Tournoi sans nom",

            description:
                tournament.texts?.detailsDescription ||
                "Pas de description disponible",

            type: tournament.metadata?.tournamentType || null,
            typeDisplayName: getTournamentTypeDisplayName(tournament.metadata?.tournamentType),

            start: tournament.beginTime,
            end: tournament.endTime,

            images: {
                square: tournament.images?.squarePosterImage || null,
                tile: tournament.images?.playlistTileImage || null,
                background: tournament.images?.tournamentViewBackgroundImage || null
            },

            windows: windowArr
        };
        normalizedTournaments.push(tournamentObj);
    }

    return normalizedTournaments;
}

function getModeFromPlaylist(playlistId = "") {
    if (!playlistId) return "Inconnu";

    if (playlistId.includes("NoBuild")) return "Zero Build";
    if (playlistId.includes("RE_")) return "Reload";
    if (playlistId.includes("DashBerry")) return "Reload";
    if (playlistId.includes("ForbiddenFruit")) return "Mobile / Zero Build";
    if (playlistId.includes("RC_")) return "Ranked Battle Royale";
    if (playlistId.includes("NPM")) return "Battle Royale";

    return "Battle Royale";
}

async function getCast(windowId) {
    console.log(windowId)
    if (!castEntriesCache) {
        const castData = await loadConfigData("/config/cast.json");
        castEntriesCache = castData?.entries || [];
    }

    const specialCast = castEntriesCache.find((el) => el.windowId === windowId);
    if (specialCast) {
        return {
        youtube: {
            channelName: specialCast.youtube?.channelName || "HavoK",
            link: specialCast.youtube?.link || "https://www.youtube.com/@HvKGGs",
        },
        twitch: {
            channelName: specialCast.twitch?.channelName || "Wazz",
            link: specialCast.twitch?.link || "https://www.twitch.tv/wazz",
        },
        };
    }
    console.log(specialCast)
    return {
        youtube: {
            channelName: "HavoK",
            link: "https://www.youtube.com/@HvKGGs",
        },
        twitch: {
            channelName: "Wazz",
            link: "https://www.twitch.tv/wazz",
        },
    };
}
function getTeamSizeFromPlaylist(playlistId = "") {
    const id = playlistId.toLowerCase();

    if (id.includes("solo")) return 1;
    if (id.includes("duo")) return 2;
    if (id.includes("trio")) return 3;
    if (id.includes("squad")) return 4;

    return null;
}

function getTeamFormatFromPlaylist(playlistId = "") {
    const teamSize = getTeamSizeFromPlaylist(playlistId);

    if (teamSize === 1) return "Solo";
    if (teamSize === 2) return "Duo";
    if (teamSize === 3) return "Trio";
    if (teamSize === 4) return "Squad";

    return "Inconnu";
}

function getTournamentTypeDisplayName(type) {
    if (type === "CashCup") return "Cash Cup";
    if (type === "FNCS") return "FNCS";
    if (type === "RankedCup") return "Ranked Cup";
    if (type === "VictoryCup") return "Victory Cup";
    if (type === "WorkshopCup") return "Workshop Cup";
    if (type === "ShopCup") return "Shop Cup";

    return type || "Inconnu";
}

function getMainLeaderboardIndex(scoreLocations = []) {
    return scoreLocations.findIndex((location) => {
        return location?.isMainWindowLeaderboard === true;
    });
}

function getMainLeaderboardId(window, scoreLocations = [], mainLeaderboardIndex = -1) {
    if (window?.leaderboardId) {
        return window.leaderboardId;
    }

    if (mainLeaderboardIndex !== -1) {
        return scoreLocations[mainLeaderboardIndex]?.leaderboardDefId || null;
    }

    return scoreLocations[0]?.leaderboardDefId || null;
}

function getMainResolvedLocation(resolvedLocations = [], mainLeaderboardIndex = -1) {
    if (mainLeaderboardIndex !== -1 && resolvedLocations[mainLeaderboardIndex]) {
        return resolvedLocations[mainLeaderboardIndex];
    }

    return resolvedLocations[0] || null;
}

module.exports = {
    normalizeTournaments
};

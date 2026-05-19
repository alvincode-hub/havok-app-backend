function normalizeTournamentsScoreRules(rules) {
    return rules.flatMap((rule) => {
        const type = getStateDisplayName(rule.trackedStat);

        return (rule.rewardTiers || []).map((rewardTier) => {
            return {
                type,
                matchRule: rule.matchRule || null,
                score: rewardTier.pointsEarned || 0,
                value: rewardTier.keyValue || 0,
                multiplicative: Boolean(rewardTier.multiplicative)
            };
        });
    });
}

function getStateDisplayName(state = "") {
    if (state.includes("PLACEMENT_STAT_INDEX")) return "placement";
    if (state.includes("ELIMS_STAT_INDEX")) return "eliminations";
    if (state.includes("TIME_ALIVE_STAT")) return "timeAlive";
    return "unknown";
}

module.exports = { normalizeTournamentsScoreRules };

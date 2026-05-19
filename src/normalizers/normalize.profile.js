async function normalizeProfile(profile) {
    const profileEntry = Array.isArray(profile) ? profile[0] : profile;

    if (!profileEntry?.user?.id) {
        throw new Error("Profil brut invalide");
    }

    return {
        accountId: profileEntry.user.id,
        name: profileEntry.user._displayName || profileEntry.user.displayName || profileEntry.user.id,
        tokens: profileEntry.tokens || [],
        geoIdentity: profileEntry.geoIdentity || null,
    };
}

module.exports = {
    normalizeProfile
};

// Cache de la version DDragon en mémoire — refresh automatique toutes les heures
let cachedVersion = '14.8.1'; // fallback si le premier fetch échoue
let lastFetch = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 heure

async function getDDragonVersion() {
    const now = Date.now();
    if (now - lastFetch < CACHE_DURATION) {
        return cachedVersion;
    }
    try {
        const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        const versions = await res.json();
        cachedVersion = versions[0];
        lastFetch = now;
        console.log(`[DDragon] Version mise en cache : ${cachedVersion}`);
    } catch (e) {
        console.log(`[DDragon] Fetch échoué, version en cache utilisée : ${cachedVersion}`);
    }
    return cachedVersion;
}

module.exports = { getDDragonVersion };

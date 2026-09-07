const db = require('../database');
const { getAccountData } = require('../riot');

/**
 * À chaque démarrage du bot, re-fetch les PUUIDs de tous les participants
 * avec la clé API Riot actuelle. Cela évite les erreurs 400/403 quand
 * la clé de développement est renouvelée (toutes les 24h).
 */
async function refreshAllPuuids() {
  const participants = db.prepare('SELECT discord_id, game_name, tag_line, region, puuid FROM participants').all();
  
  if (participants.length === 0) {
    console.log('🔑 Aucun participant en base — skip migration PUUIDs.');
    return;
  }

  console.log(`🔑 Rafraîchissement des PUUIDs pour ${participants.length} participant(s)...`);
  
  const updateStmt = db.prepare('UPDATE participants SET puuid = ? WHERE discord_id = ?');
  const updateSnapshot = db.prepare('UPDATE daily_snapshots SET puuid = ? WHERE puuid = ?');
  
  let updated = 0;
  let errors = 0;

  for (const p of participants) {
    try {
      const account = await getAccountData(p.game_name, p.tag_line, p.region);
      
      if (account.puuid && account.puuid !== p.puuid) {
        // PUUID a changé (nouvelle clé API) — on met à jour partout
        updateSnapshot.run(account.puuid, p.puuid);
        updateStmt.run(account.puuid, p.discord_id);
        updated++;
        console.log(`  ✅ ${p.game_name}#${p.tag_line} — PUUID mis à jour`);
      } else if (account.puuid) {
        console.log(`  ✔️  ${p.game_name}#${p.tag_line} — PUUID inchangé`);
      }
    } catch (err) {
      errors++;
      console.error(`  ❌ ${p.game_name}#${p.tag_line} — Erreur: ${err.message}`);
    }
  }

  console.log(`🔑 Migration terminée : ${updated} mis à jour, ${errors} erreur(s).`);
}

module.exports = { refreshAllPuuids };

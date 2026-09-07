const db = require('../database');
const { getAccountByPuuid, getSoloQueueData } = require('../riot');
const { calculateAbsoluteLp } = require('../lpHelper');

async function takeSnapshotOnly(client) {
  const participants = db.prepare('SELECT * FROM participants').all();
  if (participants.length === 0) return;

  const today = new Date().toISOString().split('T')[0];
  let saved = 0;

  for (const p of participants) {
    try {
      try {
        const account = await getAccountByPuuid(p.puuid, p.region);
        if (account && account.gameName) {
            db.prepare('UPDATE participants SET game_name = ?, tag_line = ? WHERE puuid = ?')
              .run(account.gameName, account.tagLine, p.puuid);
        }
      } catch (err) {}

      let absLp = 0, wins = 0, losses = 0;
      try {
        const soloQ = await getSoloQueueData(p.puuid, p.region);
        if (soloQ) {
            absLp = calculateAbsoluteLp(soloQ);
            wins = soloQ.wins;
            losses = soloQ.losses;
        } else {
            const last = db.prepare('SELECT absolute_lp, wins, losses FROM daily_snapshots WHERE puuid = ? ORDER BY date DESC LIMIT 1').get(p.puuid);
            if (last) {
                absLp = last.absolute_lp;
                wins = last.wins;
                losses = last.losses;
            }
        }
      } catch (e) {
          const last = db.prepare('SELECT absolute_lp, wins, losses FROM daily_snapshots WHERE puuid = ? ORDER BY date DESC LIMIT 1').get(p.puuid);
          if (last) {
              absLp = last.absolute_lp;
              wins = last.wins;
              losses = last.losses;
          }
      }

      db.prepare(`
        INSERT INTO daily_snapshots (puuid, date, absolute_lp, total_games, wins, losses)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(puuid, date) DO UPDATE SET
          absolute_lp=excluded.absolute_lp, total_games=excluded.total_games,
          wins=excluded.wins, losses=excluded.losses
      `).run(p.puuid, today, absLp, wins + losses, wins, losses);

      saved++;
    } catch (e) {
      console.error(`Snapshot erreur PUUID ${p.puuid}:`, e.message);
    }
  }

  db.prepare(`INSERT INTO settings (key, value) VALUES ('last_snapshot_date', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(today);
  console.log(`📸 Snapshot sauvegardé (${saved}/${participants.length} joueurs) — ${today}`);
}

async function executeSnapshotAndPost(client) {
  const participants = db.prepare('SELECT * FROM participants').all();
  if (participants.length === 0) return;

  const today = new Date().toISOString().split('T')[0];

  for (const p of participants) {
    try {
      try {
        const account = await getAccountByPuuid(p.puuid, p.region);
        if (account && account.gameName) {
            db.prepare('UPDATE participants SET game_name = ?, tag_line = ? WHERE puuid = ?')
              .run(account.gameName, account.tagLine, p.puuid);
            p.game_name = account.gameName;
            p.tag_line = account.tagLine;
        }
      } catch (e) {}

      let absLp = 0, wins = 0, losses = 0;
      try {
          const soloQ = await getSoloQueueData(p.puuid, p.region);
          if (soloQ) {
              absLp = calculateAbsoluteLp(soloQ);
              wins = soloQ.wins;
              losses = soloQ.losses;
          } else {
              const last = db.prepare('SELECT absolute_lp, wins, losses FROM daily_snapshots WHERE puuid = ? ORDER BY date DESC LIMIT 1').get(p.puuid);
              if (last) {
                  absLp = last.absolute_lp;
                  wins = last.wins;
                  losses = last.losses;
              }
          }
      } catch (e) {
          const last = db.prepare('SELECT absolute_lp, wins, losses FROM daily_snapshots WHERE puuid = ? ORDER BY date DESC LIMIT 1').get(p.puuid);
          if (last) {
              absLp = last.absolute_lp;
              wins = last.wins;
              losses = last.losses;
          }
      }
      
      const totalGames = wins + losses;

      db.prepare(`
        INSERT INTO daily_snapshots (puuid, date, absolute_lp, total_games, wins, losses)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(puuid, date) DO UPDATE SET
          absolute_lp=excluded.absolute_lp, total_games=excluded.total_games,
          wins=excluded.wins, losses=excluded.losses
      `).run(p.puuid, today, absLp, totalGames, wins, losses);

    } catch (e) {
      console.error(`Erreur PUUID ${p.puuid}:`, e.message);
    }
  }

  db.prepare(`INSERT INTO settings (key, value) VALUES ('last_snapshot_date', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(today);
}

module.exports = { executeSnapshotAndPost, takeSnapshotOnly };
const cron = require('node-cron');
const { takeSnapshotOnly } = require('../services/snapshotService');
const { sendLeaderboard } = require('../services/leaderboardManager');
const db = require('../database');

const TEAM_EMOJIS = { eau: '💧', terre: '🌍', feu: '🔥', air: '💨' };

function initSnapshotJob(client) {
    // S'exécute à 02:00, 08:00, 14:00 et 20:00
    cron.schedule('0 2,8,14,20 * * *', async () => {
        const event = db.prepare('SELECT * FROM race_event WHERE is_active = 1').get();
        if (!event) return;
        
        const channel = await client.channels.fetch(event.channel_id).catch(() => null);
        if (!channel) return;

        const hour = new Date().getHours();
        
        // Calcul pour savoir si nous sommes le tout dernier jour de l'événement
        const startDate = new Date(event.start_date);
        const now = new Date();
        const diffDays = Math.floor(Math.abs(now - startDate) / (1000 * 60 * 60 * 24));
        const isLastDay = diffDays >= (event.duration_days - 1);

        if (hour === 20) {
            console.log(`📸 [20:00] Figeage des données Riot en base...`);
            await takeSnapshotOnly(client); 

            if (isLastDay) {
                console.log('🏁 [20:00] Dernier jour - Clôture automatique de la course !');
                await announceWinner(channel);
                await sendLeaderboard(client, channel, 'final', 'CLASSEMENT FINAL');
                
                // Fin de l'événement
                db.prepare('UPDATE race_event SET is_active = 0 WHERE is_active = 1').run();
            } else {
                console.log('📊 [20:00] Bilan quotidien...');
                await sendLeaderboard(client, channel, 'daily', 'BILAN DU JOUR');
            }
        } else {
            console.log(`⏱️ [${hour}:00] Classement temporaire...`);
            await sendLeaderboard(client, channel, 'daily', `POINT DE ${hour}H00`);
        }
    });
}

async function announceWinner(channel) {
    const participants = db.prepare('SELECT * FROM participants').all();
    let bestPlayer = null;
    let maxPlayerGain = -9999;
    const teamScores = { eau: 0, terre: 0, feu: 0, air: 0 };

    for (const p of participants) {
        const snaps = db.prepare('SELECT absolute_lp FROM daily_snapshots WHERE puuid = ? ORDER BY date ASC').all(p.puuid);
        if (snaps.length < 2) continue;
        
        const gain = snaps[snaps.length - 1].absolute_lp - snaps[0].absolute_lp;
        
        if (gain > maxPlayerGain) { 
            maxPlayerGain = gain; 
            bestPlayer = p; 
        }
        
        if (gain > 0 && teamScores[p.team] !== undefined) {
            teamScores[p.team] += gain;
        }
    }

    const sorted = Object.entries(teamScores).sort((a, b) => b[1] - a[1]);
    const [winnerTeamId, winnerScore] = sorted[0];
    const [, secondScore] = sorted[1] || [null, 0];
    const emoji = TEAM_EMOJIS[winnerTeamId] || '🏆';

    const message = `
🏁 **FIN DE LA COURSE AUX LP !** 🏁

🏆 **ÉQUIPE GAGNANTE :** **${emoji} ${winnerTeamId.toUpperCase()}** (${winnerScore} LP amassés contre ${secondScore} LP pour la 2e place) !
⭐ **MVP DU TOURNOI :** **${bestPlayer ? bestPlayer.game_name : 'Inconnu'}** avec une ascension fulgurante de **+${maxPlayerGain} LP** !

*Génération du tableau final des scores ci-dessous...*
`;
    await channel.send(message);
}

module.exports = { initSnapshotJob };
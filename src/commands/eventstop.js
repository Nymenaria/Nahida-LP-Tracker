const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../database');
const { sendLeaderboard } = require('../services/leaderboardManager');

const TEAM_EMOJIS = { eau: '💧', terre: '🌍', feu: '🔥', air: '💨' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eventstop')
    .setDescription('Admin - Termine officiellement la course et annonce les résultats')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const event = db.prepare('SELECT * FROM race_event WHERE is_active = 1').get();
    if (!event) return interaction.reply({ content: "Aucune course n'est active.", flags: MessageFlags.Ephemeral });

    await interaction.reply({ content: "🏆 Clôture de l'événement en cours...", ephemeral: false });

    // 1. Fermeture de l'event
    db.prepare('UPDATE race_event SET is_active = 0 WHERE is_active = 1').run();

    // 2. Calcul du MVP et de l'équipe gagnante
    const participants = db.prepare('SELECT * FROM participants').all();
    let bestPlayer = null;
    let maxPlayerGain = -9999;

    const allTeams = ['eau', 'terre', 'feu', 'air'];
    const teamScores = {};
    for (const t of allTeams) teamScores[t] = 0;

    for (const p of participants) {
        const snaps = db.prepare('SELECT absolute_lp FROM daily_snapshots WHERE puuid = ? ORDER BY date ASC').all(p.puuid);
        if (snaps.length < 2) continue;
        
        const gain = snaps[snaps.length - 1].absolute_lp - snaps[0].absolute_lp;
        
        if (gain > maxPlayerGain) {
            maxPlayerGain = gain;
            bestPlayer = p;
        }

        if (gain > 0 && allTeams.includes(p.team)) {
            teamScores[p.team] += gain;
        }
    }

    // Équipe avec le plus de LP
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
    await interaction.channel.send(message);

    // 3. Envoi du Classement Final
    await sendLeaderboard(interaction.client, interaction.channel, 'final');
  }
};

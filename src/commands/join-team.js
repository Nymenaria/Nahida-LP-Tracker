const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../database');
const { getAccountData, getSoloQueueData, getSummonerData } = require('../riot');
const { calculateAbsoluteLp } = require('../lpHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rejoindre')
    .setDescription('Rejoins une équipe pour la Course aux LP')
    .addStringOption(opt => opt.setName('pseudo').setDescription('Ton Riot ID (ex: Lilou)').setRequired(true))
    .addStringOption(opt => opt.setName('tag').setDescription('Ton tag (ex: EUW)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('equipe')
        .setDescription('Ton équipe')
        .setRequired(true)
        .addChoices(
          { name: '💧 Eau', value: 'eau' },
          { name: '🌍 Terre', value: 'terre' },
          { name: '🔥 Feu', value: 'feu' },
          { name: '💨 Air', value: 'air' }
        )
    )
    .addStringOption(opt =>
      opt.setName('region')
        .setDescription('Serveur LoL (Défaut: EUW)')
        .setRequired(false)
        .addChoices(
          { name: 'EUW', value: 'euw1' },
          { name: 'NA', value: 'na1' },
          { name: 'EUNE', value: 'eun1' }
        )
    ),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const pseudo = interaction.options.getString('pseudo');
    const tag = interaction.options.getString('tag').replace('#', '');
    const requestedTeam = interaction.options.getString('equipe');
    const region = interaction.options.getString('region') || 'euw1';

    try {
      const account = await getAccountData(pseudo, tag, region);
      const soloQ = await getSoloQueueData(account.puuid, region);
      const summoner = await getSummonerData(account.puuid, region);
      
      const wins = soloQ ? soloQ.wins : 0;
      const losses = soloQ ? soloQ.losses : 0;
      const totalGames = wins + losses;
      const winrate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
      const level = summoner.summonerLevel;

      if (totalGames < 20) {
          return await interaction.editReply(`❌ **Inscription refusée** : Ce compte n'est pas autorisé (moins de 20 parties classées). Veuillez contacter **Nymenaria** si vous pensez qu'il s'agit d'une erreur.`);
      }
      if (winrate >= 80) {
          return await interaction.editReply(`❌ **Inscription refusée** : Ce compte n'est pas autorisé. Veuillez contacter **Nymenaria**.`);
      }

      const isHighLevel = level >= 100;
      const isException = totalGames >= 50 && winrate < 60;
      
      if (!isHighLevel && !isException) {
          return await interaction.editReply(`❌ **Inscription refusée** : Ce compte n'est pas autorisé (niveau de compte trop bas). Veuillez contacter **Nymenaria** pour demander une dérogation.`);
      }

      const allTeams = ['eau', 'terre', 'feu', 'air'];
      const teamCounts = {};
      for (const t of allTeams) {
        teamCounts[t] = db.prepare("SELECT COUNT(*) as c FROM participants WHERE team = ?").get(t).c;
      }
      const totalPlayers = Object.values(teamCounts).reduce((a, b) => a + b, 0);
      const avgPerTeam = totalPlayers / 4;
      const differenceThreshold = 2;

      let finalTeam = requestedTeam;
      if (teamCounts[requestedTeam] > avgPerTeam + differenceThreshold) {
        finalTeam = Object.entries(teamCounts).sort((a, b) => a[1] - b[1])[0][0];
      }

      let teamMessage = '';
      if (finalTeam !== requestedTeam) {
          teamMessage = `\n*(Note d'équilibrage : L'équipe ${requestedTeam.toUpperCase()} était surpeuplée, tu as été réassigné chez ${finalTeam.toUpperCase()} !)*`;
      }

      const absLp = calculateAbsoluteLp(soloQ);
      const today = new Date().toISOString().split('T')[0];

      db.prepare(`
        INSERT INTO participants (discord_id, puuid, game_name, tag_line, team, region)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(discord_id) DO UPDATE SET
          puuid=excluded.puuid, 
          game_name=excluded.game_name, 
          tag_line=excluded.tag_line,
          team=excluded.team, 
          region=excluded.region
      `).run(interaction.user.id, account.puuid, account.gameName, account.tagLine, finalTeam, region);

      db.prepare(`
        INSERT INTO daily_snapshots (puuid, date, absolute_lp, total_games, wins, losses)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(puuid, date) DO UPDATE SET 
          absolute_lp=excluded.absolute_lp, 
          total_games=excluded.total_games,
          wins=excluded.wins,
          losses=excluded.losses
      `).run(account.puuid, today, absLp, totalGames, wins, losses);

      await interaction.editReply(`✅ Tu as rejoint l'équipe **${finalTeam.toUpperCase()}** en tant que **${account.gameName}#${account.tagLine}** !${teamMessage}`);
    
    } catch (e) {
      // ⚠️ Log de diagnostic pour cerner immédiatement l'erreur de l'API Riot
      console.error(`⚠️ Échec Riot API pour ${pseudo}#${tag} :`, e.message);
      
      if (e.name === 'SqliteError') {
         if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
             await interaction.editReply('❌ Ce compte Riot est déjà utilisé par un autre joueur de la course !');
         } else {
             await interaction.editReply('❌ Erreur de base de données lors de l\'inscription.');
         }
      } else {
         await interaction.editReply('❌ Erreur : Compte Riot introuvable, profil masqué, ou erreur de clé API.');
      }
    }
  }
};
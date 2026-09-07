const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../database');
const { getAccountData, getSoloQueueData } = require('../riot');
const { calculateAbsoluteLp } = require('../lpHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('force-ajout')
    .setDescription('Admin - Ajoute un joueur manuellement à la course (ignore les règles anti-smurf)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt => opt.setName('membre').setDescription('Le membre Discord').setRequired(true))
    .addStringOption(opt => opt.setName('pseudo').setDescription('Riot ID').setRequired(true))
    .addStringOption(opt => opt.setName('tag').setDescription('Tag (ex: EUW)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('equipe')
        .setDescription('Équipe de destination')
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
    
    const targetUser = interaction.options.getUser('membre');
    const pseudo = interaction.options.getString('pseudo');
    const tag = interaction.options.getString('tag').replace('#', '');
    const team = interaction.options.getString('equipe');
    const region = interaction.options.getString('region') || 'euw1';

    try {
      const account = await getAccountData(pseudo, tag, region);
      const soloQ = await getSoloQueueData(account.puuid, region);
      
      const absLp = calculateAbsoluteLp(soloQ);
      const wins = soloQ ? soloQ.wins : 0;
      const losses = soloQ ? soloQ.losses : 0;
      const totalGames = wins + losses;
      const today = new Date().toISOString().split('T')[0];

      db.prepare(`
        INSERT INTO participants (discord_id, puuid, game_name, tag_line, team, region)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(discord_id) DO UPDATE SET
          puuid=excluded.puuid, game_name=excluded.game_name, tag_line=excluded.tag_line, team=excluded.team, region=excluded.region
      `).run(targetUser.id, account.puuid, account.gameName, account.tagLine, team, region);

      db.prepare(`
        INSERT INTO daily_snapshots (puuid, date, absolute_lp, total_games, wins, losses)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(puuid, date) DO UPDATE SET 
          absolute_lp=excluded.absolute_lp, total_games=excluded.total_games, wins=excluded.wins, losses=excluded.losses
      `).run(account.puuid, today, absLp, totalGames, wins, losses);

      await interaction.editReply(`✅ Ajout forcé réussi : **${targetUser.username}** a rejoint l'équipe **${team.toUpperCase()}** sous le compte **${account.gameName}#${account.tagLine}**.`);
    } catch (e) {
      console.error(e);
      await interaction.editReply('❌ Erreur : Compte Riot introuvable ou déjà lié à une autre personne dans la base de données.');
    }
  }
};
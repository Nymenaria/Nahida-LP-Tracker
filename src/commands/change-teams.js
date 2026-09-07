const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('changer-equipe')
    .setDescription('Admin - Transfère un joueur existant vers une autre équipe')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt => opt.setName('membre').setDescription('Le membre Discord à transférer').setRequired(true))
    .addStringOption(opt =>
      opt.setName('equipe')
        .setDescription('La nouvelle équipe')
        .setRequired(true)
        .addChoices(
          { name: '💧 Eau', value: 'eau' },
          { name: '🌍 Terre', value: 'terre' },
          { name: '🔥 Feu', value: 'feu' },
          { name: '💨 Air', value: 'air' }
        )
    ),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const targetUser = interaction.options.getUser('membre');
    const newTeam = interaction.options.getString('equipe');

    const participant = db.prepare('SELECT game_name, team FROM participants WHERE discord_id = ?').get(targetUser.id);
    
    if (!participant) {
      return interaction.editReply(`❌ Impossible : **${targetUser.username}** n'est pas encore inscrit à la course.`);
    }

    if (participant.team === newTeam) {
      return interaction.editReply(`⚠️ **${participant.game_name}** est déjà enregistré dans l'équipe **${newTeam.toUpperCase()}**.`);
    }

    try {
      db.prepare('UPDATE participants SET team = ? WHERE discord_id = ?').run(newTeam, targetUser.id);
      await interaction.editReply(`✅ Transfert réussi : **${participant.game_name}** a quitté ${participant.team.toUpperCase()} et joue désormais pour l'équipe **${newTeam.toUpperCase()}** !`);
    } catch (e) {
      console.error(e);
      await interaction.editReply('❌ Une erreur est survenue lors de la mise à jour de l\'équipe.');
    }
  }
};
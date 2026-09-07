const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('supprimer-joueur')
    .setDescription('Admin - Retire définitivement un joueur et son historique de la course')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt => opt.setName('membre').setDescription('Le membre Discord à supprimer').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const targetUser = interaction.options.getUser('membre');
    const participant = db.prepare('SELECT puuid, game_name FROM participants WHERE discord_id = ?').get(targetUser.id);
    
    if (!participant) {
      return interaction.editReply(`❌ Impossible : **${targetUser.username}** n'est pas inscrit dans la base de données.`);
    }

    try {
      // Suppression de l'historique LP d'abord, puis du compte participant
      db.prepare('DELETE FROM daily_snapshots WHERE puuid = ?').run(participant.puuid);
      db.prepare('DELETE FROM participants WHERE discord_id = ?').run(targetUser.id);

      await interaction.editReply(`✅ Le compte **${participant.game_name}** (appartenant à ${targetUser.username}) a été entièrement supprimé du système.`);
    } catch (e) {
      console.error(e);
      await interaction.editReply('❌ Une erreur critique est survenue lors de la suppression en base de données.');
    }
  }
};
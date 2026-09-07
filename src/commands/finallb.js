const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { sendLeaderboard } = require('../services/leaderboardManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('finallb')
    .setDescription('Admin - Affiche le classement global actuel (ne termine pas l\'event)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    // deferReply donne 15 minutes au bot pour générer les images sans planter !
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await sendLeaderboard(interaction.client, interaction.channel, 'final');
    await interaction.editReply({ content: "✅ Classement global généré avec succès !" });
  }
};
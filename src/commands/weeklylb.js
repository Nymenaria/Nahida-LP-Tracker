const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { sendLeaderboard } = require('../services/leaderboardManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weeklylb')
    .setDescription('Admin - Affiche le classement hebdomadaire en avance')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    await interaction.reply({ content: "Génération du classement hebdomadaire en cours...", flags: MessageFlags.Ephemeral });
    await sendLeaderboard(interaction.client, interaction.channel, 'weekly');
  }
};

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { sendLeaderboard } = require('../services/leaderboardManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dailylb')
    .setDescription('Admin - Affiche le classement quotidien en avance')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    // deferReply donne 15 minutes au bot pour générer les images sans planter !
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await sendLeaderboard(interaction.client, interaction.channel, 'daily');
    await interaction.editReply({ content: "✅ Classement quotidien généré avec succès !" });
  }
};
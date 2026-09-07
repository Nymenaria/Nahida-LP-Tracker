const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../database');
const { executeSnapshotAndPost } = require('../services/snapshotService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Forcer la mise à jour du leaderboard (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const participants = db.prepare('SELECT COUNT(*) as count FROM participants').get().count;
    
    // Chaque joueur = 2 requêtes (Account + League) espacées de 1.3s = 2.6 secondes par joueur
    const estimatedSeconds = Math.ceil(participants * 2.6);

    await interaction.reply({ 
      content: `⏳ **Refresh forcé en cours...**\nTemps estimé pour vérifier ${participants} joueurs : **~${estimatedSeconds} secondes**.\n*(Le prochain refresh automatique est repoussé de 24h)*`,
      flags: MessageFlags.Ephemeral
    });

    // On lance la machine
    await executeSnapshotAndPost(interaction.client);

    await interaction.editReply({ 
      content: `✅ **Refresh terminé !** Le classement a été envoyé dans le salon d'annonce.`
    });
  }
};

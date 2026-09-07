const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('start-race')
    .setDescription('Démarre une nouvelle Course aux LP (sauvegarde les données précédentes)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // 1. L'option OBLIGATOIRE en premier
    .addChannelOption(opt =>
      opt.setName('salon')
        .setDescription('Salon pour les résumés quotidiens')
        .setRequired(true)
    )
    // 2. L'option FACULTATIVE à la fin
    .addIntegerOption(opt =>
      opt.setName('jours')
        .setDescription('Durée de l\'événement en jours (défaut : 3)')
        .setRequired(false)
        .setMinValue(1)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const days = interaction.options.getInteger('jours') ?? 3;
    const channel = interaction.options.getChannel('salon');

    // 1. Backup de la base actuelle
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(__dirname, `../../lptracker_backup_${timestamp}.sqlite`);
    try {
      await db.backup(backupPath);
    } catch (e) {
      console.error('Erreur backup DB:', e.message);
      return interaction.editReply('❌ Impossible de créer la sauvegarde. Course annulée par sécurité.');
    }

    // 2. Réinitialisation propre des données (participants + snapshots + settings)
    db.prepare('DELETE FROM participants').run();
    db.prepare('DELETE FROM daily_snapshots').run();
    db.prepare('DELETE FROM settings').run();

    // 3. Clôture des anciens events + création du nouveau
    db.prepare('UPDATE race_event SET is_active = 0').run();
    db.prepare(`
      INSERT INTO race_event (start_date, duration_days, channel_id, is_active)
      VALUES (?, ?, ?, 1)
    `).run(new Date().toISOString(), days, channel.id);

    await interaction.editReply(
      `🏁 **Course aux LP lancée !**\n` +
      `- Durée : **${days} jour(s)**\n` +
      `- Annonces dans : ${channel}\n` +
      `- Backup créé : \`lptracker_backup_${timestamp}.sqlite\`\n\n` +
      `📅 **Planning automatique :**\n` +
      `> 🕕 6h / 12h / 18h UTC → Daily Temporaire\n` +
      `> 🕛 0h UTC → Bilan du Jour (Résultats Finaux au jour ${days})`
    );
  }
};
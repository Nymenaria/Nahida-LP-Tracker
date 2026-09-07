const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeleft')
    .setDescription('Affiche le temps restant pour la Course aux LP'),
  async execute(interaction) {
    const event = db.prepare('SELECT start_date, duration_weeks FROM race_event WHERE is_active = 1').get();
    
    if (!event) {
        return interaction.reply({ content: "Il n'y a aucune course active en ce moment.", flags: MessageFlags.Ephemeral });
    }

    const startDate = new Date(event.start_date);
    const endDate = new Date(startDate.getTime() + event.duration_weeks * 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    
    const diffTime = Math.abs(endDate - now);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    await interaction.reply(`⏳ **Temps restant :** Il reste **${diffDays} jours et ${diffHours} heures** avant la fin de la Course aux LP !`);
  }
};

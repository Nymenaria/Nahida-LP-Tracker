const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../database');
const { getSoloQueueData, getSummonerData } = require('../riot');
const { calculateAbsoluteLp, getRankFromAbsLp } = require('../lpHelper');
const { generatePlayerCard } = require('../utils/canvasUtils');
const { getDDragonVersion } = require('../utils/ddragonCache');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profil')
    .setDescription('Affiche une carte de profil et l\'évolution depuis le début de la course')
    .addUserOption(opt => 
        opt.setName('membre')
           .setDescription('Le membre Discord dont tu veux voir le profil (optionnel)')
           .setRequired(false)
    ),
  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre') || interaction.user;

    const participant = db.prepare('SELECT * FROM participants WHERE discord_id = ?').get(targetUser.id);
    if (!participant) {
        const errorMessage = targetUser.id === interaction.user.id 
            ? "❌ Tu n'es pas inscrit à la Course aux LP. Utilise `/rejoindre`." 
            : `❌ **${targetUser.username}** n'est pas inscrit à la Course aux LP.`;
        return interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply();

    try {
        let liveAbsLp = 0;
        let liveWins = 0;
        let liveLosses = 0;
        let rankText = 'UNRANKED';
        let rankTier = 'UNRANKED';
        
        let avatarUrl = 'https://ddragon.leagueoflegends.com/cdn/14.8.1/img/profileicon/0.png';

        const soloQ = await getSoloQueueData(participant.puuid, participant.region);
        if (soloQ) {
            liveAbsLp = calculateAbsoluteLp(soloQ);
            liveWins = soloQ.wins;
            liveLosses = soloQ.losses;
            rankText = getRankFromAbsLp(liveAbsLp);
            rankTier = rankText.split(' ')[0];
        }

        try {
            const summoner = await getSummonerData(participant.puuid, participant.region);
            if (summoner && summoner.profileIconId !== undefined) {
                const latestVersion = await getDDragonVersion();
                avatarUrl = `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/profileicon/${summoner.profileIconId}.png`;
            }
        } catch (e) {
            console.log(`Impossible de charger l'icône de ${participant.game_name}, utilisation de l'image par défaut.`);
        }

        const firstSnap = db.prepare('SELECT * FROM daily_snapshots WHERE puuid = ? ORDER BY date ASC LIMIT 1').get(participant.puuid);
        
        const baselineAbsLp = firstSnap ? firstSnap.absolute_lp : liveAbsLp;
        const baselineWins = firstSnap ? firstSnap.wins : liveWins;
        const baselineLosses = firstSnap ? firstSnap.losses : liveLosses;

        const lpGain = liveAbsLp - baselineAbsLp; 
        const eventWins = Math.max(0, liveWins - baselineWins);
        const eventLosses = Math.max(0, liveLosses - baselineLosses);

        const playerData = {
            gameName: participant.game_name,
            tagLine: participant.tag_line,
            discordUsername: targetUser.username,
            avatarUrl: avatarUrl,
            lpGain: lpGain,
            eventWins: eventWins,
            eventLosses: eventLosses,
            rankText: rankText,
            rankTier: rankTier,
            team: participant.team
        };

        const buffer = await generatePlayerCard(playerData);
        await interaction.editReply({ files: [{ attachment: buffer, name: 'profil.png' }] });

    } catch (error) {
        console.error(error);
        await interaction.editReply("❌ Une erreur est survenue lors de la génération de la carte profil.");
    }
  }
};
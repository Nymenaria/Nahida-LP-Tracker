const db = require('../database');
const fs = require('fs');
const path = require('path');
const { AttachmentBuilder } = require('discord.js');
const { getSoloQueueData, getSummonerData } = require('../riot');
const { calculateAbsoluteLp, getRankFromAbsLp } = require('../lpHelper');
const { generateTeamRecap, generatePlayerRow } = require('../utils/canvasLeaderboard');

const TEAMS = [
    { id: 'eau',   bannerFile: 'waterBanner.png', name: 'TEAM EAU' },
    { id: 'terre', bannerFile: 'earthBanner.png', name: 'TEAM TERRE' },
    { id: 'feu',   bannerFile: 'fireBanner.png',  name: 'TEAM FEU' },
    { id: 'air',   bannerFile: 'airBanner.png',   name: 'TEAM AIR' }
];

async function sendLeaderboard(client, targetChannel, timeframe = 'daily', titleOverride = null) {
    const participants = db.prepare('SELECT * FROM participants').all();
    if (participants.length === 0) {
        if (targetChannel.send) await targetChannel.send("Aucun participant inscrit.");
        return;
    }

    let titleSuffix = titleOverride || 'QUOTIDIEN';
    if (!titleOverride) {
        if (timeframe === 'weekly') titleSuffix = 'HEBDOMADAIRE';
        if (timeframe === 'final') titleSuffix = 'CLASSEMENT FINAL';
    }

    const snapshotResults = [];
    let latestVersion = '14.8.1';
    try {
        const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        latestVersion = (await res.json())[0];
    } catch(e) {}

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    for (const p of participants) {
        const snaps = db.prepare('SELECT * FROM daily_snapshots WHERE puuid = ? ORDER BY date DESC').all(p.puuid);
        if (snaps.length === 0) continue; 

        let latestSnap = snaps[0];
        let liveAbsLp = latestSnap.absolute_lp;
        let liveWins = latestSnap.wins;
        let liveLosses = latestSnap.losses;
        let rankText = getRankFromAbsLp(liveAbsLp);
        let rankTier = rankText.split(' ')[0];
        
        try {
            const soloQ = await getSoloQueueData(p.puuid, p.region);
            if (soloQ) {
                liveAbsLp = calculateAbsoluteLp(soloQ);
                liveWins = soloQ.wins;
                liveLosses = soloQ.losses;
                rankText = getRankFromAbsLp(liveAbsLp);
                rankTier = rankText.split(' ')[0];
            }
        } catch (e) {}

        let baseline = latestSnap; 
        if (timeframe === 'daily') {
            const pastSnaps = snaps.filter(s => s.date <= yesterdayStr);
            if (pastSnaps.length > 0) baseline = pastSnaps[0];
            else baseline = snaps[snaps.length - 1]; 
        } else if (timeframe === 'weekly') {
            baseline = snaps.length > 7 ? snaps[7] : snaps[snaps.length - 1];
        }

        const gain = liveAbsLp - baseline.absolute_lp;
        const eventWins = Math.max(0, liveWins - baseline.wins);
        const eventLosses = Math.max(0, liveLosses - baseline.losses);

        const discordUser = await client.users.fetch(p.discord_id).catch(() => ({ username: 'Inconnu' }));
        
        snapshotResults.push({
            ...p, 
            discord_username: discordUser.username, 
            gain, 
            eventWins, 
            eventLosses,
            absLp: liveAbsLp, 
            rankText, 
            rankTier
        });
    }

    // Boucle sur chaque équipe (l'équipe s'affiche MÊME si elle est à 0 membre)
    for (const t of TEAMS) {
        const allTeamMembers = snapshotResults.filter(p => p.team === t.id);

        let playersToDisplay = allTeamMembers;
        if (timeframe !== 'final') {
            playersToDisplay = playersToDisplay.filter(p => (p.eventWins + p.eventLosses) > 0);
        }
        
        playersToDisplay = playersToDisplay.sort((a, b) => b.gain - a.gain);

        let totalWins = 0, totalLosses = 0, teamEvolution = 0, totalAbsLp = 0;
        
        playersToDisplay.forEach(p => {
            totalWins += p.eventWins; 
            totalLosses += p.eventLosses;
            if (p.gain > 0) teamEvolution += p.gain; 
        });

        allTeamMembers.forEach(p => { totalAbsLp += p.absLp; });

        const teamGames = totalWins + totalLosses;
        const teamStats = {
            games: teamGames,
            winrate: teamGames > 0 ? Math.round((totalWins / teamGames) * 100) : 0,
            evo: teamEvolution, 
            // Sécurité mathématique si 0 membre pour éviter une erreur NaN
            avgRank: allTeamMembers.length > 0 ? getRankFromAbsLp(totalAbsLp / allTeamMembers.length) : 'NON CLASSÉ'
        };

        // 1. BANNIÈRE DE LA TEAM (STATS ETC.) -> Récapitulatif
        const recapBuffer = await generateTeamRecap(t.id, teamStats, titleSuffix);
        await targetChannel.send({ files: [new AttachmentBuilder(recapBuffer, { name: 'recap.png' })] });

        // 2. JOUEURS DE LA TEAM (#1 à #5 maximum) -> Images
        const top5 = playersToDisplay.slice(0, 5);
        for (let i = 0; i < top5.length; i++) {
            const p = top5[i];
            try {
                const summoner = await getSummonerData(p.puuid, p.region);
                p.avatarUrl = `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/profileicon/${summoner.profileIconId}.png`;
            } catch (e) {}

            const playerBuffer = await generatePlayerRow(t.id, p, i + 1);
            await targetChannel.send({ files: [new AttachmentBuilder(playerBuffer, { name: `p${i}.png` })] });
        }

        // 3. JUSTE DU TEXTE POUR LE RESTE DE LA TEAM
        const rest = playersToDisplay.slice(5);
        if (rest.length > 0) {
            let textContent = `**Suite du classement - ${t.name} :**\n`;
            rest.forEach((p, index) => {
                const rank = 6 + index;
                const gainStr = p.gain >= 0 ? `+${p.gain}` : `${p.gain}`;
                textContent += `**#${rank}** ${p.game_name}#${p.tag_line} — **${gainStr} LP** *(Parties : ${p.eventWins + p.eventLosses})*\n`;
            });
            await targetChannel.send({ content: textContent });
        }

        // 4. BANNIÈRE DE LA TEAM (waterBanner.png, etc.)
        const bannerPath = path.join(process.cwd(), 'src', 'images', t.bannerFile);
        if (fs.existsSync(bannerPath)) {
            // L'utilisation de fs.readFileSync sécurise l'envoi de l'image
            const buffer = fs.readFileSync(bannerPath);
            await targetChannel.send({ files: [new AttachmentBuilder(buffer, { name: t.bannerFile })] });
        } else {
            console.error(`[Erreur] Image introuvable au chemin : ${bannerPath}`);
        }
    }
}

module.exports = { sendLeaderboard };
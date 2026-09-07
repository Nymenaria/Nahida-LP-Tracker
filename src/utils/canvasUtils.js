const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

const fontPathRegular = path.join(process.cwd(), 'src', 'fonts', 'TREBUC.TTF');
const fontPathBold = path.join(process.cwd(), 'src', 'fonts', 'TREBUCBD.TTF');

if (fs.existsSync(fontPathRegular)) GlobalFonts.registerFromPath(fontPathRegular, 'Trebuchet MS');
if (fs.existsSync(fontPathBold)) GlobalFonts.registerFromPath(fontPathBold, 'Trebuchet MS'); 

const TEAM_CONFIG = {
    eau: { color: '#3498db', name: "TRIBU DE L'EAU" },
    terre: { color: '#2ecc71', name: "ROYAUME DE LA TERRE" },
    feu: { color: '#e74c3c', name: "NATION DU FEU" },
    air: { color: '#f1c40f', name: "NOMADES DE L'AIR" }
};

async function getRankEmblem(tier) {
    if (!tier || tier === 'UNRANKED') return null;
    let t = String(tier).toLowerCase();

    const translations = {
        'fer': 'iron', 'argent': 'silver', 'or': 'gold', 'platine': 'platinum',
        'émeraude': 'emerald', 'emeraude': 'emerald', 'diamant': 'diamond',
        'master+': 'master', 'non': 'unranked'
    };

    if (translations[t]) t = translations[t];
    if (t === 'platinum') t = 'platinium';

    const rankPath = path.join(process.cwd(), 'src', 'images', 'rank', `${t}.png`);
    try {
        if (fs.existsSync(rankPath)) return await loadImage(fs.readFileSync(rankPath));
    } catch (e) {}
    return null;
}

async function generatePlayerCard(player) {
    const canvas = createCanvas(800, 240);
    const ctx = canvas.getContext('2d');
    const mainFont = '"Trebuchet MS"'; 
    const config = TEAM_CONFIG[player.team] || { color: '#ffffff' };

    ctx.fillStyle = '#1e1f22';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const canvaImagesPath = path.join(process.cwd(), 'src', 'images', 'canvaImages');
    if (fs.existsSync(canvaImagesPath)) {
        const files = fs.readdirSync(canvaImagesPath).filter(f => f.includes('star') && f.endsWith('.png'));
        if (files.length > 0) {
            ctx.globalAlpha = 0.25;
            for (let i = 0; i < 8; i++) {
                try {
                    const img = await loadImage(fs.readFileSync(path.join(canvaImagesPath, files[Math.floor(Math.random() * files.length)])));
                    ctx.drawImage(img, Math.random() * 800, Math.random() * 240, Math.random() * 50 + 30, Math.random() * 50 + 30);
                } catch (e) {}
            }
            ctx.globalAlpha = 1.0;
        }
    }

    ctx.fillStyle = 'rgba(49, 51, 56, 0.8)';
    ctx.beginPath(); ctx.roundRect(20, 20, 760, 200, 15); ctx.fill();

    ctx.fillStyle = config.color;
    ctx.beginPath(); ctx.roundRect(20, 20, 8, 200, 15); ctx.fill();

    if (player.avatarUrl) {
        try {
            const res = await fetch(player.avatarUrl);
            if (res.ok) {
                const arrayBuffer = await res.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const avatar = await loadImage(buffer);

                ctx.save();
                ctx.beginPath(); ctx.arc(130, 120, 60, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
                ctx.drawImage(avatar, 70, 60, 120, 120);
                ctx.restore();

                ctx.lineWidth = 4; ctx.strokeStyle = config.color;
                ctx.beginPath(); ctx.arc(130, 120, 60, 0, Math.PI * 2); ctx.stroke();
            }
        } catch (e) {}
    }

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    const lolName = player.gameName ? String(player.gameName).toUpperCase() : 'JOUEUR';
    const tag = player.tagLine ? String(player.tagLine).toUpperCase() : 'TAG';
    const discordName = player.discordUsername ? String(player.discordUsername).toUpperCase() : 'DISCORD';

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 28px ${mainFont}`;
    ctx.fillText(`${lolName}#${tag} | ${discordName}`, 220, 65);

    const games = (player.eventWins || 0) + (player.eventLosses || 0);
    const wr = games > 0 ? Math.round(((player.eventWins || 0) / games) * 100) : 0;

    ctx.fillStyle = '#b5bac1';
    ctx.font = `22px ${mainFont}`;
    ctx.fillText(`Parties : ${games} (${player.eventWins || 0}V - ${player.eventLosses || 0}D)   |   Winrate : ${wr}%`, 220, 110);

    const lpGain = typeof player.lpGain === 'number' ? player.lpGain : 0;
    
    ctx.fillStyle = '#b5bac1';
    ctx.font = `24px ${mainFont}`;
    const evoText = `Évolution : `;
    ctx.fillText(evoText, 220, 155);
    const evoWidth = ctx.measureText(evoText).width;

    ctx.fillStyle = lpGain >= 0 ? '#2ecc71' : '#e74c3c';
    ctx.font = `bold 26px ${mainFont}`;
    ctx.fillText(`${lpGain >= 0 ? '+' : ''}${lpGain} LP`, 220 + evoWidth, 155);

    const rankTextSafe = player.rankText ? String(player.rankText).toUpperCase() : 'UNRANKED';
    const rankEmblem = await getRankEmblem(player.rankTier);

    if (rankEmblem) {
        ctx.drawImage(rankEmblem, 220, 170, 40, 40);
        ctx.fillStyle = '#b5bac1';
        ctx.font = `bold 20px ${mainFont}`;
        ctx.fillText(rankTextSafe, 270, 198);
    } else {
        ctx.fillStyle = '#b5bac1';
        ctx.font = `bold 20px ${mainFont}`;
        ctx.fillText(rankTextSafe, 220, 198);
    }

    return canvas.toBuffer('image/png');
}

module.exports = { generatePlayerCard };
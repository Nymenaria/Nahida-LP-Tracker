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
    if (!tier) return null;
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

async function generateTeamRecap(team, stats, timeframeTitle = 'QUOTIDIEN') {
    const canvas = createCanvas(800, 160);
    const ctx = canvas.getContext('2d');
    const mainFont = '"Trebuchet MS"';
    const config = TEAM_CONFIG[team] || { color: '#ffffff', name: 'ÉQUIPE INCONNUE' };

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
                    ctx.drawImage(img, Math.random() * 800, Math.random() * 160, Math.random() * 50 + 30, Math.random() * 50 + 30);
                } catch (e) {}
            }
            ctx.globalAlpha = 1.0;
        }
    }

    ctx.fillStyle = 'rgba(49, 51, 56, 0.8)';
    ctx.beginPath(); ctx.roundRect(20, 15, 760, 130, 15); ctx.fill();
    
    ctx.fillStyle = config.color;
    ctx.beginPath(); ctx.roundRect(20, 15, 8, 130, 15); ctx.fill();

    ctx.textBaseline = 'alphabetic'; 
    ctx.textAlign = 'left';

    const title = `${config.name} - ${timeframeTitle}`;
    let titleX = 45;

    if (fs.existsSync(canvaImagesPath)) {
        const files = fs.readdirSync(canvaImagesPath).filter(f => f.includes('star') && f.endsWith('.png'));
        if (files.length > 0) {
            const randomFile = files[Math.floor(Math.random() * files.length)];
            try {
                const starIcon = await loadImage(fs.readFileSync(path.join(canvaImagesPath, randomFile)));
                ctx.drawImage(starIcon, 42, 28, 32, 32); 
                titleX = 85;
            } catch (e) {}
        }
    }

    ctx.fillStyle = config.color;
    ctx.font = `bold 26px ${mainFont}`;
    ctx.fillText(title, titleX, 55);

    ctx.fillStyle = '#ffffff';
    ctx.font = `20px ${mainFont}`;
    ctx.fillText(`Parties : ${stats.games || 0}  |  Winrate : ${stats.winrate || 0}%  |  Élo Moyen : ${stats.avgRank || 'NON CLASSÉ'}`, 45, 95);
    
    const evo = stats.evo || 0;
    ctx.fillStyle = evo >= 0 ? '#2ecc71' : '#e74c3c';
    ctx.font = `bold 22px ${mainFont}`;
    ctx.fillText(`Évolution Totale : ${evo >= 0 ? '+' : ''}${evo} LP`, 45, 125);

    return canvas.toBuffer('image/png');
}

async function generatePlayerRow(team, p, index) {
    const canvas = createCanvas(800, 140);
    const ctx = canvas.getContext('2d');
    const mainFont = '"Trebuchet MS"';
    const config = TEAM_CONFIG[team] || { color: '#ffffff' };

    ctx.fillStyle = '#1e1f22';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const canvaImagesPath = path.join(process.cwd(), 'src', 'images', 'canvaImages');
    if (fs.existsSync(canvaImagesPath)) {
        const files = fs.readdirSync(canvaImagesPath).filter(f => f.includes('star') && f.endsWith('.png'));
        if (files.length > 0) {
            ctx.globalAlpha = 0.25;
            for (let i = 0; i < 5; i++) {
                try {
                    const img = await loadImage(fs.readFileSync(path.join(canvaImagesPath, files[Math.floor(Math.random() * files.length)])));
                    ctx.drawImage(img, Math.random() * 800, Math.random() * 140, Math.random() * 40 + 20, Math.random() * 40 + 20);
                } catch (e) {}
            }
            ctx.globalAlpha = 1.0;
        }
    }

    ctx.fillStyle = 'rgba(49, 51, 56, 0.7)';
    ctx.beginPath(); ctx.roundRect(20, 10, 760, 120, 15); ctx.fill();

    const medalColor = index === 1 ? '#f1c40f' : index === 2 ? '#bdc3c7' : index === 3 ? '#cd7f32' : config.color;
    ctx.fillStyle = medalColor;
    ctx.beginPath(); ctx.roundRect(20, 10, 8, 120, 15); ctx.fill();

    ctx.textBaseline = 'alphabetic'; 
    ctx.textAlign = 'left';

    ctx.font = `bold 28px ${mainFont}`;
    ctx.fillText(`#${index}`, 42, 80);

    if (p.avatarUrl) {
        try {
            const res = await fetch(p.avatarUrl);
            if (res.ok) {
                const arrayBuffer = await res.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const avatar = await loadImage(buffer);

                ctx.save();
                ctx.beginPath(); ctx.arc(140, 70, 40, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
                ctx.drawImage(avatar, 100, 30, 80, 80);
                ctx.restore();
                ctx.lineWidth = 3; ctx.strokeStyle = medalColor; ctx.stroke();
            }
        } catch (e) {}
    }

    const lolName = p.game_name ? String(p.game_name).toUpperCase() : 'JOUEUR';
    const tag = p.tag_line ? String(p.tag_line).toUpperCase() : 'TAG';
    const discordName = p.discord_username ? String(p.discord_username).toUpperCase() : 'DISCORD';
    
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 22px ${mainFont}`;
    ctx.fillText(`${lolName}#${tag} | ${discordName}`, 200, 55);

    const lpGain = typeof p.gain === 'number' ? p.gain : 0;
    const games = (p.eventWins || 0) + (p.eventLosses || 0);
    const wr = games > 0 ? Math.round(((p.eventWins || 0) / games) * 100) : 0;

    ctx.fillStyle = lpGain >= 0 ? '#2ecc71' : '#e74c3c';
    ctx.font = `bold 24px ${mainFont}`;
    const lpString = `${lpGain >= 0 ? '+' : ''}${lpGain} LP`;
    ctx.fillText(lpString, 200, 95);
    
    const lpWidth = ctx.measureText(lpString).width;
    ctx.fillStyle = '#b5bac1';
    ctx.font = `20px ${mainFont}`;
    ctx.fillText(`   |   Parties : ${games} (${wr}%)`, 200 + lpWidth, 94);

    const rankTextSafe = p.rankText ? String(p.rankText).toUpperCase() : 'UNRANKED';
    const rankEmblem = await getRankEmblem(p.rankTier);
    
    ctx.font = `bold 18px ${mainFont}`;
    const rankWidth = ctx.measureText(rankTextSafe).width;

    if (rankEmblem) {
        const textX = 750 - rankWidth;
        ctx.fillStyle = '#b5bac1';
        ctx.fillText(rankTextSafe, textX, 76);
        ctx.drawImage(rankEmblem, textX - 55, 48, 45, 45);
    } else {
        ctx.fillStyle = '#b5bac1';
        ctx.fillText(rankTextSafe, 750 - rankWidth, 76);
    }

    return canvas.toBuffer('image/png');
}

module.exports = { generateTeamRecap, generatePlayerRow };
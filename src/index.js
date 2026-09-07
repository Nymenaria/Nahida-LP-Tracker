require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, REST, Routes, Collection } = require('discord.js');
const { initSnapshotJob } = require('./jobs/snapshotJob');
const { refreshAllPuuids } = require('./jobs/refreshPuuids');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Création d'une Collection pour stocker les commandes de manière dynamique
client.commands = new Collection();
const commandsJSON = [];

// 1. Lecture dynamique de tous les fichiers dans le dossier "commands"
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    // On vérifie que le fichier est bien une commande valide
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commandsJSON.push(command.data.toJSON());
    } else {
        console.log(`[ATTENTION] La commande ${file} n'a pas les propriétés "data" ou "execute" requises.`);
    }
}

// 2. Démarrage du bot (utilisation de clientReady pour contrer l'avertissement)
client.once('clientReady', async () => {
    console.log(`Connecté : ${client.user.tag}`);
  
    // Migration auto des PUUIDs à chaque démarrage (gère le changement de clé API Riot)
    try {
        await refreshAllPuuids();
    } catch (err) {
        console.error('⚠️ Erreur migration PUUIDs (non bloquant) :', err.message);
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  
    try {
        console.log('♻️  Purge des commandes globales...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: [] } // On vide le cache global pour éviter les doublons fantômes
        );

        console.log(`🚀 Déploiement de ${commandsJSON.length} commandes sur le serveur ID : ${process.env.SERVER_ID}...`);
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.SERVER_ID),
            { body: commandsJSON }
        );
        
        console.log('✅ Commandes rechargées avec succès !');
    } catch (error) {
        console.error('❌ Erreur lors du rechargement des commandes :', error);
    }

    // Démarrage des cron jobs
    initSnapshotJob(client);
});

// 3. Gestion des interactions avec sécurité anti-crash
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
  
    const command = client.commands.get(interaction.commandName);
  
    if (!command) {
        console.error(`Aucune commande ne correspond à ${interaction.commandName}.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`❌ Erreur critique dans la commande ${interaction.commandName}:`, error.message);
        
        // SÉCURITÉ : Vérifier si l'interaction a déjà eu une réponse pour éviter le crash 40060
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: '❌ Une erreur est survenue lors de l\'exécution.', flags: 64 });
            } else {
                await interaction.reply({ content: '❌ Une erreur est survenue lors de l\'exécution.', flags: 64 });
            }
        } catch (e) {
            console.error('Impossible d\'envoyer le message d\'erreur (interaction expirée) :', e.message);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
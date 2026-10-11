require('dotenv').config();

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
  const archivos = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));
  for (const archivo of archivos) {
    const comando = require(path.join(commandsPath, archivo));
    if (comando.data) {
      commands.push(comando.data.toJSON());
    }
  }
}

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('Faltan DISCORD_TOKEN o CLIENT_ID en las variables de entorno.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log(`[AEGIS] Registrando ${commands.length} comandos…`);

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      console.log(`[AEGIS] Comandos registrados en el servidor ${guildId}.`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), {
        body: commands,
      });
      console.log('[AEGIS] Comandos registrados de forma global.');
    }
  } catch (error) {
    console.error('[AEGIS] Error al registrar comandos:', error);
  }
})();

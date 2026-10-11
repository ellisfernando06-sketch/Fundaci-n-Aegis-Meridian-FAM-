require('dotenv').config();

const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  Events,
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const { getDb } = require('./db');
const { cargarHandlers, manejarInteraccion } = require('./handlers/interacciones');
const auditoria = require('./services/auditoria');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();

function cargarComandos() {
  const commandsPath = path.join(__dirname, 'commands');
  if (!fs.existsSync(commandsPath)) return;

  const archivos = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));
  for (const archivo of archivos) {
    const comando = require(path.join(commandsPath, archivo));
    if (comando.data && comando.execute) {
      client.commands.set(comando.data.name, comando);
    }
  }
}

client.once(Events.ClientReady, (c) => {
  getDb();
  cargarComandos();
  cargarHandlers();

  console.log(`[AEGIS] Conectado como ${c.user.tag}`);
  auditoria.registrar('SISTEMA', 'BOT.INICIO', `Sesión iniciada · ${c.user.tag}`);
});

client.on(Events.InteractionCreate, (interaction) => {
  manejarInteraccion(interaction);
});

client.on(Events.Error, (error) => {
  console.error('[Discord Error]', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('[AEGIS] Falta DISCORD_TOKEN en las variables de entorno.');
  process.exit(1);
}

client.login(token);

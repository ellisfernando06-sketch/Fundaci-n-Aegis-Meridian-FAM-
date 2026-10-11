require('dotenv').config();

const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const { getDb } = require('./db');
const { cargarHandlers, manejarInteraccion } = require('./handlers/interacciones');
const auditoria = require('./services/auditoria');

console.log('[AEGIS] Iniciando…');
console.log('[AEGIS] Node', process.version);
console.log('[AEGIS] DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? 'definido' : 'FALTA');
console.log('[AEGIS] CLIENT_ID:', process.env.CLIENT_ID || 'no definido');
console.log('[AEGIS] GUILD_ID:', process.env.GUILD_ID || 'no definido');
console.log('[AEGIS] DATABASE_PATH:', process.env.DATABASE_PATH || 'data/aegis.db');

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
  if (!fs.existsSync(commandsPath)) {
    console.log('[AEGIS] Carpeta commands no encontrada');
    return [];
  }

  const body = [];
  const archivos = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));
  for (const archivo of archivos) {
    try {
      const comando = require(path.join(commandsPath, archivo));
      if (comando.data && comando.execute) {
        client.commands.set(comando.data.name, comando);
        body.push(comando.data.toJSON());
        console.log('[AEGIS] Comando cargado:', comando.data.name);
      }
    } catch (err) {
      console.error('[AEGIS] Error cargando comando', archivo, err);
    }
  }
  return body;
}

async function registrarComandos(commandBody) {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!clientId || !commandBody.length) {
    console.log('[AEGIS] Registro de comandos omitido (falta CLIENT_ID o no hay comandos)');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandBody });
      console.log(`[AEGIS] ${commandBody.length} comandos registrados en el servidor ${guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commandBody });
      console.log(`[AEGIS] ${commandBody.length} comandos registrados de forma global`);
    }
  } catch (err) {
    console.error('[AEGIS] Error al registrar comandos:', err.message || err);
  }
}

client.once(Events.ClientReady, async (c) => {
  try {
    getDb();
    console.log('[AEGIS] Base de datos lista');
  } catch (err) {
    console.error('[AEGIS] Error abriendo la base de datos:', err);
  }

  const commandBody = cargarComandos();
  cargarHandlers();
  console.log('[AEGIS] Handlers de componentes cargados');

  await registrarComandos(commandBody);

  console.log(`[AEGIS] EN LÍNEA como ${c.user.tag} (${c.user.id})`);
  try {
    auditoria.registrar('SISTEMA', 'BOT.INICIO', `Sesión iniciada · ${c.user.tag}`);
  } catch (_) {}
});

client.on(Events.InteractionCreate, (interaction) => {
  manejarInteraccion(interaction);
});

client.on(Events.Error, (error) => {
  console.error('[Discord Error]', error);
});

client.on(Events.ShardDisconnect, (event) => {
  console.warn('[AEGIS] Desconectado:', event);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('[AEGIS] Falta DISCORD_TOKEN. Añádelo en Variables de Railway y redespliega.');
  process.exit(1);
}

client.login(token).catch((err) => {
  console.error('[AEGIS] No se pudo iniciar sesión en Discord:', err.message || err);
  console.error('[AEGIS] Revisa que el token sea correcto y que el bot esté invitado al servidor.');
  process.exit(1);
});

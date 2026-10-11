require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('[AEGIS] Iniciando…');
console.log('[AEGIS] Node', process.version);
console.log('[AEGIS] DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? 'definido (' + process.env.DISCORD_TOKEN.length + ' chars)' : 'FALTA');
console.log('[AEGIS] CLIENT_ID:', process.env.CLIENT_ID || 'no definido');
console.log('[AEGIS] GUILD_ID:', process.env.GUILD_ID || 'no definido');
console.log('[AEGIS] DATABASE_PATH:', process.env.DATABASE_PATH || 'data/aegis.db');
console.log('[AEGIS] PORT:', process.env.PORT || '3000');

// ---------------------------------------------------------------------------
// 1) Health server PRIMERO (antes de better-sqlite3 / discord.js)
//    Railway mata el proceso si no abre un puerto HTTP.
// ---------------------------------------------------------------------------
let botStatus = 'arrancando';
let botTag = null;

const PORT = Number(process.env.PORT) || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: botStatus,
    bot: botTag || 'conectando',
    uptime: Math.floor(process.uptime()),
  }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[AEGIS] Health server en 0.0.0.0:${PORT}`);
});

server.on('error', (err) => {
  console.error('[AEGIS] Health server error:', err.message);
});

// ---------------------------------------------------------------------------
// 2) Carga controlada del resto
// ---------------------------------------------------------------------------
async function main() {
  let Client, Collection, GatewayIntentBits, Partials, Events, REST, Routes;
  try {
    const djs = require('discord.js');
    Client = djs.Client;
    Collection = djs.Collection;
    GatewayIntentBits = djs.GatewayIntentBits;
    Partials = djs.Partials;
    Events = djs.Events;
    REST = djs.REST;
    Routes = djs.Routes;
    console.log('[AEGIS] discord.js cargado');
  } catch (err) {
    botStatus = 'error_discord_js';
    console.error('[AEGIS] No se pudo cargar discord.js:', err);
    return;
  }

  let getDb, cargarHandlers, manejarInteraccion, auditoria;
  try {
    getDb = require('./db').getDb;
    console.log('[AEGIS] Módulo DB cargado');
  } catch (err) {
    botStatus = 'error_db_module';
    console.error('[AEGIS] FATAL: no se pudo cargar better-sqlite3 / db:', err);
    console.error('[AEGIS] Causa típica: fallo al compilar el módulo nativo en el build.');
    return;
  }

  try {
    const handlers = require('./handlers/interacciones');
    cargarHandlers = handlers.cargarHandlers;
    manejarInteraccion = handlers.manejarInteraccion;
    auditoria = require('./services/auditoria');
  } catch (err) {
    botStatus = 'error_handlers';
    console.error('[AEGIS] Error cargando handlers:', err);
    return;
  }

  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    botStatus = 'sin_token';
    console.error('[AEGIS] Falta DISCORD_TOKEN en Variables de Railway.');
    return;
  }

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
    if (!fs.existsSync(commandsPath)) return [];
    const body = [];
    for (const archivo of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
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
        console.log(`[AEGIS] ${commandBody.length} comandos registrados en guild ${guildId}`);
      } else {
        await rest.put(Routes.applicationCommands(clientId), { body: commandBody });
        console.log(`[AEGIS] ${commandBody.length} comandos registrados globalmente`);
      }
    } catch (err) {
      console.error('[AEGIS] Error registrando comandos:', err.message || err);
    }
  }

  client.once(Events.ClientReady, async (c) => {
    botTag = c.user.tag;
    botStatus = 'online';

    try {
      getDb();
      console.log('[AEGIS] Base de datos lista');
    } catch (err) {
      console.error('[AEGIS] Error abriendo DB (el bot sigue en línea):', err);
    }

    const commandBody = cargarComandos();
    try {
      cargarHandlers();
      console.log('[AEGIS] Handlers cargados');
    } catch (err) {
      console.error('[AEGIS] Error handlers:', err);
    }

    await registrarComandos(commandBody);
    console.log(`[AEGIS] EN LÍNEA como ${c.user.tag} (${c.user.id})`);

    try {
      auditoria.registrar('SISTEMA', 'BOT.INICIO', `Sesión iniciada · ${c.user.tag}`);
    } catch (_) {}
  });

  client.on(Events.InteractionCreate, (interaction) => {
    try {
      manejarInteraccion(interaction);
    } catch (err) {
      console.error('[AEGIS] Interaction error:', err);
    }
  });

  client.on(Events.Error, (error) => console.error('[Discord Error]', error));
  client.on(Events.ShardDisconnect, (event) => {
    botStatus = 'desconectado';
    console.warn('[AEGIS] Gateway desconectado:', event?.code, event?.reason || '');
  });
  client.on(Events.ShardReconnecting, () => {
    botStatus = 'reconectando';
    console.log('[AEGIS] Reconectando…');
  });

  process.on('unhandledRejection', (reason) => console.error('[Unhandled Rejection]', reason));
  process.on('uncaughtException', (err) => console.error('[Uncaught Exception]', err));

  try {
    await client.login(token);
    console.log('[AEGIS] Login enviado al gateway');
  } catch (err) {
    botStatus = 'error_login';
    console.error('[AEGIS] Login fallido:', err.message || err);
    console.error('[AEGIS] Revisa: token válido, bot invitado, Server Members Intent activado.');
  }
}

main().catch((err) => {
  botStatus = 'error_fatal';
  console.error('[AEGIS] Error fatal en main():', err);
});

/**
 * Fundacion Aegis-Meridian · Bot de Discord
 * Health server primero; bot despues.
 */

const http = require('http');

let botStatus = 'starting';
let botReadyAt = null;

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      status: botStatus,
      readyAt: botReadyAt,
      uptime: process.uptime(),
    }));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('[AEGIS] Health server en puerto', PORT);
});

server.on('error', (err) => {
  console.error('[AEGIS] Health server error', err);
});

async function main() {
  require('dotenv').config();

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
  } catch (err) {
    botStatus = 'error_discord_js';
    console.error('[AEGIS] No se pudo cargar discord.js', err);
    return;
  }

  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    botStatus = 'error_no_token';
    console.error('[AEGIS] Falta DISCORD_TOKEN');
    return;
  }

  try {
    require('./db').getDb();
  } catch (err) {
    console.error('[AEGIS] DB init', err);
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Channel],
  });

  client.commands = new Collection();

  // Cargar comandos
  const fs = require('fs');
  const path = require('path');
  const commandsPath = path.join(__dirname, 'commands');
  if (fs.existsSync(commandsPath)) {
    for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
      try {
        const cmd = require(path.join(commandsPath, file));
        if (cmd?.data?.name) {
          client.commands.set(cmd.data.name, cmd);
          console.log('[AEGIS] Comando:', cmd.data.name);
        }
      } catch (err) {
        console.error('[AEGIS] Error comando', file, err);
      }
    }
  }

  const { cargarHandlers, manejarInteraccion } = require('./handlers/interacciones');
  cargarHandlers();

  client.once(Events.ClientReady, async (c) => {
    botStatus = 'online';
    botReadyAt = new Date().toISOString();
    console.log('[AEGIS] Listo como', c.user.tag);

    // Registrar slash commands
    try {
      const rest = new REST({ version: '10' }).setToken(token);
      const body = [...client.commands.values()].map((cmd) => cmd.data.toJSON());
      const clientId = process.env.CLIENT_ID || c.user.id;
      const guildId = process.env.GUILD_ID;
      if (guildId) {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
        console.log('[AEGIS] Comandos de guild registrados:', body.length);
      } else {
        await rest.put(Routes.applicationCommands(clientId), { body });
        console.log('[AEGIS] Comandos globales registrados:', body.length);
      }
    } catch (err) {
      console.error('[AEGIS] Registro de comandos', err);
    }
  });

  // Fase 5: cuarentena al entrar (Visitante)
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      const { aplicarCuarentena } = require('./services/roles');
      await aplicarCuarentena(member.guild, member);
      console.log('[AEGIS] Cuarentena aplicada a', member.user.tag);
    } catch (err) {
      console.error('[AEGIS] GuildMemberAdd', err);
    }
  });

  client.on(Events.InteractionCreate, (interaction) => {
    manejarInteraccion(interaction).catch((err) => {
      console.error('[Interaccion]', err);
    });
  });

  client.on(Events.Error, (error) => console.error('[Discord Error]', error));
  client.on(Events.ShardDisconnect, (event) => {
    botStatus = 'disconnected';
    console.warn('[AEGIS] Shard disconnect', event);
  });
  client.on(Events.ShardReconnecting, () => {
    botStatus = 'reconnecting';
    console.log('[AEGIS] Reconectando…');
  });

  process.on('unhandledRejection', (reason) => console.error('[Unhandled Rejection]', reason));
  process.on('uncaughtException', (err) => console.error('[Uncaught Exception]', err));

  try {
    await client.login(token);
  } catch (err) {
    botStatus = 'error_login';
    console.error('[AEGIS] Login fallido', err);
  }
}

main().catch((err) => {
  console.error('[AEGIS] Fatal', err);
  botStatus = 'fatal';
});

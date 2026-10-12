/**
 * Tickets de soporte · texto y voz
 * Panel institucional Fundacion Aegis-Meridian
 */

const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { getDb, nextId, getConfig, setConfig } = require('../db');
const { embedBase, COLORES, MARCA } = require('../utils/plantillas');
const { sanitizar, truncar } = require('../utils/helpers');
const auditoria = require('./auditoria');
const { actorTexto } = require('./solicitudes');

function asegurarTabla() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      tipo TEXT NOT NULL,
      canal_id TEXT,
      voz_id TEXT,
      autor_id TEXT NOT NULL,
      estado TEXT DEFAULT 'abierto',
      motivo TEXT,
      cerrado_por TEXT,
      creado_en TEXT DEFAULT (datetime('now')),
      cerrado_en TEXT
    );
  `);
}

function esStaff(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions?.has(PermissionFlagsBits.ManageChannels)) return true;
  if (member.permissions?.has(PermissionFlagsBits.ModerateMembers)) return true;
  const nombres = ['helper', 'soporte', 'soporte tecnico', 'admin', 'moderacion', 'administrador'];
  return member.roles.cache.some((r) =>
    nombres.some((n) => r.name.toLowerCase().includes(n))
  );
}

function iconoInstitucional(client, guild) {
  const custom = process.env.AEGIS_LOGO_URL || getConfig('logo_url');
  if (custom) return custom;
  if (guild?.iconURL) return guild.iconURL({ size: 128 });
  if (client?.user) return client.user.displayAvatarURL({ size: 128 });
  return null;
}

async function asegurarCategoriaTickets(guild) {
  const nombre = '✦ TICKETS';
  let cat = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === nombre
  );
  if (!cat) {
    cat = await guild.channels.create({
      name: nombre,
      type: ChannelType.GuildCategory,
      reason: 'Aegis · categoria de tickets',
    });
  }
  return cat;
}

/**
 * Panel publico profesional.
 * @param {{ client?, guild? }} ctx
 */
function panelEmbed(ctx = {}) {
  const icon = iconoInstitucional(ctx.client, ctx.guild);

  return embedBase({
    color: COLORES.institucional,
    author: {
      name: `${MARCA.nombre}`,
      iconURL: icon || undefined,
    },
    titulo: 'Mesa de Asistencia',
    descripcion:
      `*${MARCA.lema}*\n\n` +
      'Canal oficial de atencion al personal y a la comunidad.\n' +
      'Elige el tipo de solicitud. Un agente de **Soporte** o **Administracion** respondera en un canal privado.\n\n' +
      '─────────────────────────────',
    campos: [
      {
        name: '╭─  Consulta general',
        value:
          'Dudas de rangos, verificacion, acceso a areas o funcionamiento del servidor.\n' +
          '→ Boton **Soporte**',
        inline: false,
      },
      {
        name: '╭─  Reporte formal',
        value:
          'Conducta indebida, abuso de poder o incidencias que requieran revision disciplinaria.\n' +
          '→ Boton **Reporte**',
        inline: false,
      },
      {
        name: '╭─  Sala de voz privada',
        value:
          'Conversacion en tiempo real con el staff (canal de voz + control por texto).\n' +
          '→ Boton **Ticket de voz**',
        inline: false,
      },
      {
        name: '─────────────────────────────',
        value:
          '**Normas de uso**\n' +
          '· Un solo ticket abierto por persona\n' +
          '· Mantén el tono institucional\n' +
          '· No uses reportes para consultas triviales\n' +
          '· El historial puede transcribirse a logs de mando',
        inline: false,
      },
    ],
    thumbnail: icon || undefined,
    footer: 'Mesa de Asistencia',
    footerIcon: icon || undefined,
  });
}

function panelBotones() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('tickets:abrir:soporte')
      .setLabel('Soporte')
      .setEmoji('💠')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('tickets:abrir:reporte')
      .setLabel('Reporte')
      .setEmoji('🛡️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('tickets:abrir:voz')
      .setLabel('Ticket de voz')
      .setEmoji('🎙️')
      .setStyle(ButtonStyle.Secondary),
  );
}

function controlesTicket(ticketId, ctx = {}) {
  const icon = iconoInstitucional(ctx.client, ctx.guild);
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`tickets:agregar_menu:${ticketId}`)
        .setLabel('Agregar persona')
        .setEmoji('➕')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`tickets:transcribir:${ticketId}`)
        .setLabel('Transcribir')
        .setEmoji('📄')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`tickets:cerrar:${ticketId}`)
        .setLabel('Cerrar ticket')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

function embedAperturaTicket({ id, tipo, memberId, vozId, client, guild }) {
  const icon = iconoInstitucional(client, guild);
  const esVoz = tipo === 'voz';
  const campos = [
    { name: 'Referencia', value: `\`${id}\``, inline: true },
    { name: 'Modalidad', value: esVoz ? 'Voz + control' : tipo, inline: true },
    { name: 'Estado', value: '● Abierto', inline: true },
    { name: 'Solicitante', value: `<@${memberId}>`, inline: true },
  ];
  if (vozId) {
    campos.push({ name: 'Sala de voz', value: `<#${vozId}>`, inline: true });
  }
  campos.push({
    name: 'Instrucciones',
    value: esVoz
      ? 'Unete a la sala de voz. El staff puede incorporar a terceros y archivar la conversacion de control.'
      : 'Describe tu caso con claridad. El personal de Soporte o Administracion tomara el hilo.',
    inline: false,
  });

  return embedBase({
    color: COLORES.institucional,
    author: { name: MARCA.nombre, iconURL: icon || undefined },
    titulo: esVoz ? 'Ticket de voz abierto' : 'Ticket abierto',
    descripcion: `*${MARCA.lema}*`,
    campos,
    thumbnail: icon || undefined,
    footer: 'Mesa de Asistencia',
    footerIcon: icon || undefined,
  });
}

async function crearTicketTexto(guild, member, tipo, client) {
  asegurarTabla();
  const db = getDb();
  const id = nextId('TKT');
  const cat = await asegurarCategoriaTickets(guild);

  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
  ];

  if (guild.members.me) {
    overwrites.push({
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

  const canal = await guild.channels.create({
    name: `︱🎫・${tipo}-${id.toLowerCase()}`,
    type: ChannelType.GuildText,
    parent: cat.id,
    permissionOverwrites: overwrites,
    reason: `Aegis · ticket ${id}`,
  });

  for (const [, rol] of guild.roles.cache) {
    if (rol.managed || rol.id === guild.id) continue;
    if (
      rol.permissions.has(PermissionFlagsBits.Administrator) ||
      rol.permissions.has(PermissionFlagsBits.ManageChannels) ||
      rol.permissions.has(PermissionFlagsBits.ModerateMembers)
    ) {
      await canal.permissionOverwrites.edit(rol.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      }).catch(() => {});
    }
  }

  db.prepare(`
    INSERT INTO tickets (id, tipo, canal_id, autor_id, estado, motivo)
    VALUES (?, ?, ?, ?, 'abierto', ?)
  `).run(id, tipo, canal.id, member.id, tipo);

  auditoria.registrar(member.id, 'TICKET.ABRIR', { id, tipo, canal: canal.id });

  await canal.send({
    content: `<@${member.id}>`,
    embeds: [embedAperturaTicket({ id, tipo, memberId: member.id, client, guild })],
    components: controlesTicket(id, { client, guild }),
  });

  return { id, canal };
}

async function crearTicketVoz(guild, member, client) {
  asegurarTabla();
  const db = getDb();
  const id = nextId('TKT');
  const cat = await asegurarCategoriaTickets(guild);

  const texto = await guild.channels.create({
    name: `︱🎫・voz-${id.toLowerCase()}`,
    type: ChannelType.GuildText,
    parent: cat.id,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ],
    reason: `Aegis · ticket voz ${id}`,
  });

  const voz = await guild.channels.create({
    name: `︱🎙️・ticket-${id.toLowerCase()}`,
    type: ChannelType.GuildVoice,
    parent: cat.id,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel] },
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
        ],
      },
    ],
    reason: `Aegis · VC ticket ${id}`,
  });

  for (const [, rol] of guild.roles.cache) {
    if (rol.managed || rol.id === guild.id) continue;
    if (
      rol.permissions.has(PermissionFlagsBits.Administrator) ||
      rol.permissions.has(PermissionFlagsBits.ManageChannels) ||
      rol.permissions.has(PermissionFlagsBits.ModerateMembers)
    ) {
      await texto.permissionOverwrites.edit(rol.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      }).catch(() => {});
      await voz.permissionOverwrites.edit(rol.id, {
        ViewChannel: true,
        Connect: true,
        Speak: true,
      }).catch(() => {});
    }
  }

  db.prepare(`
    INSERT INTO tickets (id, tipo, canal_id, voz_id, autor_id, estado, motivo)
    VALUES (?, 'voz', ?, ?, ?, 'abierto', 'voz')
  `).run(id, texto.id, voz.id, member.id);

  auditoria.registrar(member.id, 'TICKET.ABRIR_VOZ', { id, texto: texto.id, voz: voz.id });

  await texto.send({
    content: `<@${member.id}>`,
    embeds: [embedAperturaTicket({
      id, tipo: 'voz', memberId: member.id, vozId: voz.id, client, guild,
    })],
    components: controlesTicket(id, { client, guild }),
  });

  return { id, canal: texto, voz };
}

async function agregarPersona(guild, ticketId, userId, actor) {
  asegurarTabla();
  const db = getDb();
  const t = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  if (!t || t.estado !== 'abierto') throw new Error('Ticket no disponible');

  const texto = t.canal_id ? await guild.channels.fetch(t.canal_id).catch(() => null) : null;
  const voz = t.voz_id ? await guild.channels.fetch(t.voz_id).catch(() => null) : null;

  if (texto) {
    await texto.permissionOverwrites.edit(userId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });
  }
  if (voz) {
    await voz.permissionOverwrites.edit(userId, {
      ViewChannel: true,
      Connect: true,
      Speak: true,
    });
  }

  auditoria.registrar(actor.id, 'TICKET.AGREGAR', {
    ticketId,
    usuario: userId,
    actor: actorTexto(actor),
  });

  if (texto) {
    const icon = iconoInstitucional(null, guild);
    await texto.send({
      embeds: [
        embedBase({
          color: COLORES.medicina,
          author: { name: MARCA.nombre, iconURL: icon || undefined },
          titulo: 'Acceso concedido',
          descripcion: `<@${userId}> ha sido incorporado a este expediente por ${actorTexto(actor)}.`,
          footer: 'Mesa de Asistencia',
          footerIcon: icon || undefined,
        }),
      ],
    }).catch(() => {});
  }

  return t;
}

async function construirTranscripcion(channel) {
  const mensajes = [];
  let lastId;
  for (let i = 0; i < 10; i++) {
    const batch = await channel.messages.fetch({ limit: 100, ...(lastId ? { before: lastId } : {}) });
    if (!batch.size) break;
    for (const m of batch.values()) mensajes.push(m);
    lastId = batch.last().id;
    if (batch.size < 100) break;
  }
  mensajes.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const lineas = mensajes.map((m) => {
    const hora = new Date(m.createdTimestamp).toISOString();
    const autor = m.author?.tag || m.author?.id || '?';
    const texto = sanitizar(m.content || '');
    const adj = m.attachments?.size
      ? ' [adjuntos: ' + [...m.attachments.values()].map((a) => a.url).join(' ') + ']'
      : '';
    return `[${hora}] ${autor}: ${texto}${adj}`;
  });

  return lineas.join('\n') || '(Sin mensajes)';
}

async function enviarTranscripcion(guild, ticket, transcripcion, actor) {
  const canalLogId = getConfig('canal_log_tickets') || getConfig('canal_log_auditoria');
  if (!canalLogId) return null;
  const log = await guild.channels.fetch(canalLogId).catch(() => null);
  if (!log || !log.isTextBased()) return null;

  const icon = iconoInstitucional(null, guild);
  const header =
    `**Expediente** \`${ticket.id}\` · ${ticket.tipo}\n` +
    `**Solicitante:** <@${ticket.autor_id}>\n` +
    `**Archivado por:** ${actorTexto(actor)}\n\n`;

  const cuerpo = truncar(header + '```\n' + transcripcion + '\n```', 3900);

  await log.send({
    embeds: [
      embedBase({
        color: COLORES.institucional,
        author: { name: MARCA.nombre, iconURL: icon || undefined },
        titulo: `Archivo de ticket · ${ticket.id}`,
        descripcion: cuerpo,
        footer: 'Mesa de Asistencia · Archivo',
        footerIcon: icon || undefined,
      }),
    ],
  });

  if (transcripcion.length > 3500) {
    const { AttachmentBuilder } = require('discord.js');
    const buf = Buffer.from(transcripcion, 'utf8');
    await log.send({
      content: `Transcripcion completa · ${ticket.id}`,
      files: [new AttachmentBuilder(buf, { name: `${ticket.id}.txt` })],
    }).catch(() => {});
  }

  return canalLogId;
}

async function transcribir(guild, ticketId, actor, { cerrar = false } = {}) {
  asegurarTabla();
  const db = getDb();
  const t = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
  if (!t) throw new Error('Ticket no encontrado');

  const canal = t.canal_id ? await guild.channels.fetch(t.canal_id).catch(() => null) : null;
  let texto = '(Sin canal de texto)';
  if (canal && canal.isTextBased()) {
    texto = await construirTranscripcion(canal);
  }

  await enviarTranscripcion(guild, t, texto, actor);

  if (cerrar) {
    db.prepare(`
      UPDATE tickets SET estado = 'cerrado', cerrado_por = ?, cerrado_en = datetime('now')
      WHERE id = ?
    `).run(actor.id, ticketId);

    if (t.voz_id) {
      const voz = await guild.channels.fetch(t.voz_id).catch(() => null);
      if (voz) await voz.delete('Aegis · cierre de ticket').catch(() => {});
    }
    if (canal) {
      const icon = iconoInstitucional(null, guild);
      setTimeout(() => {
        canal.delete('Aegis · cierre de ticket').catch(() => {});
      }, 5000);
      await canal.send({
        embeds: [
          embedBase({
            color: COLORES.denegado,
            author: { name: MARCA.nombre, iconURL: icon || undefined },
            titulo: 'Expediente cerrado',
            descripcion:
              `Cerrado por ${actorTexto(actor)}.\n` +
              'La transcripcion fue enviada al archivo de mando.\n' +
              'Este canal se eliminara en unos segundos.',
            footer: 'Mesa de Asistencia',
            footerIcon: icon || undefined,
          }),
        ],
        components: [],
      }).catch(() => {});
    }
  }

  auditoria.registrar(actor.id, cerrar ? 'TICKET.CERRAR' : 'TICKET.TRANSCRIBIR', {
    ticketId,
    actor: actorTexto(actor),
  });

  return t;
}

module.exports = {
  asegurarTabla,
  esStaff,
  panelEmbed,
  panelBotones,
  controlesTicket,
  crearTicketTexto,
  crearTicketVoz,
  agregarPersona,
  transcribir,
  setConfig,
  iconoInstitucional,
};

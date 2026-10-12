/**
 * Tickets de soporte · texto y voz
 * Mesa de Asistencia institucional · Fundación Aegis-Meridian
 */

const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { getDb, nextId, getConfig, setConfig } = require('../db');
const { embedBase, COLORES, MARCA, logoUrl, bannerUrl } = require('../utils/plantillas');
const { sanitizar, truncar } = require('../utils/helpers');
const auditoria = require('./auditoria');
const { actorTexto } = require('./solicitudes');

const TIPOS = {
  soporte: { label: 'Soporte', emoji: '💠', color: COLORES.seguridad },
  reporte: { label: 'Reporte', emoji: '🛡️', color: COLORES.sancion },
  finanzas: { label: 'Finanzas', emoji: '💰', color: COLORES.oro },
  area: { label: 'Área / Acceso', emoji: '🗂️', color: COLORES.inteligencia },
  voz: { label: 'Voz', emoji: '🎙️', color: COLORES.cupula },
};

/** Cargos del organigrama que atienden tickets (prioridad: roles_map). */
const CARGOS_STAFF_TICKET = [
  'SP.TECNICO',
  'SP.TECNICO_PRUEBA',
  'ST.ADMIN_JEFE',
  'ST.ADMIN_SENIOR',
  'ST.ADMIN_PRUEBA',
  'ST.FUNDADOR',
  'ST.CO_CALIDAD',
  'ST.CO_ESTRATEGIA',
];

/** Fragmentos de nombre de rol para detectar staff si no hay mapa. */
const NOMBRES_STAFF = [
  'soporte tecnico',
  'soporte técnico',
  'soporte',
  'helper',
  'admin en jefe',
  'administrador en jefe',
  'admin senior',
  'administrador senior',
  'admin en prueba',
  'administrador en prueba',
  'moderacion',
  'moderación',
];

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

  const db = getDb();
  for (const key of CARGOS_STAFF_TICKET) {
    const row = db.prepare('SELECT role_id FROM roles_map WHERE cargo_key = ?').get(key);
    if (row?.role_id && member.roles.cache.has(row.role_id)) return true;
  }

  return member.roles.cache.some((r) => {
    const n = r.name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    return NOMBRES_STAFF.some((frag) => n.includes(frag.normalize('NFD').replace(/\p{M}/gu, '')));
  });
}

/**
 * Roles de staff a notificar y con acceso al ticket.
 * Prioriza roles_map (SP.TECNICO, etc.) y luego coincidencia por nombre.
 */
function resolverRolesStaff(guild) {
  const ids = new Set();
  const db = getDb();

  for (const key of CARGOS_STAFF_TICKET) {
    const row = db.prepare('SELECT role_id FROM roles_map WHERE cargo_key = ?').get(key);
    if (row?.role_id && guild.roles.cache.has(row.role_id)) {
      ids.add(row.role_id);
    }
  }

  for (const [, rol] of guild.roles.cache) {
    if (rol.managed || rol.id === guild.id) continue;
    const n = rol.name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    if (NOMBRES_STAFF.some((frag) => n.includes(frag.normalize('NFD').replace(/\p{M}/gu, '')))) {
      ids.add(rol.id);
    }
    if (
      rol.permissions.has(PermissionFlagsBits.Administrator) ||
      rol.permissions.has(PermissionFlagsBits.ManageChannels) ||
      rol.permissions.has(PermissionFlagsBits.ModerateMembers)
    ) {
      ids.add(rol.id);
    }
  }

  return [...ids].map((id) => guild.roles.cache.get(id)).filter(Boolean);
}

function mencionesStaff(roles) {
  if (!roles.length) return '';
  // Limitar menciones para no spamear (soporte + admin primero)
  const priorizados = roles
    .slice()
    .sort((a, b) => {
      const score = (r) => {
        const n = r.name.toLowerCase();
        if (n.includes('soporte')) return 0;
        if (n.includes('admin')) return 1;
        return 2;
      };
      return score(a) - score(b);
    })
    .slice(0, 6);
  return priorizados.map((r) => `<@&${r.id}>`).join(' ');
}

function iconoInstitucional(client, guild) {
  return logoUrl(client, guild);
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

/** Nombre de canal seguro (Discord limita caracteres especiales). */
function nombreCanalTicket(tipo, id) {
  const limpio = String(id).toLowerCase().replace(/[^a-z0-9-]/g, '');
  const t = String(tipo).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  return `ticket-${t}-${limpio}`.slice(0, 90);
}

function panelEmbed(ctx = {}) {
  const icon = iconoInstitucional(ctx.client, ctx.guild);
  const banner = bannerUrl();

  return embedBase({
    color: COLORES.institucional,
    author: {
      name: `${MARCA.nombre} · ${MARCA.corto}`,
      iconURL: icon || undefined,
    },
    titulo: '▣ Mesa de Asistencia',
    descripcion:
      `*${MARCA.lema}*\n\n` +
      'Canal oficial de atención al personal y a la comunidad de la **Fundación Aegis-Meridian**.\n' +
      'Selecciona el tipo de solicitud. Un agente de **Soporte Técnico** o **Administración** responderá en un canal privado.\n\n' +
      '─────────────────────────────',
    campos: [
      {
        name: '╭─  💠  Consulta general',
        value:
          'Dudas de rangos, verificación Roblox, acceso a áreas o funcionamiento del servidor.\n' +
          '→ Botón **Soporte** · atiende **Soporte Técnico**',
        inline: false,
      },
      {
        name: '╭─  🛡️  Reporte formal',
        value:
          'Conducta indebida, abuso de poder o incidencias que requieran revisión disciplinaria.\n' +
          '→ Botón **Reporte** · atiende **Administración / Soporte**',
        inline: false,
      },
      {
        name: '╭─  💰  Finanzas / Nómina',
        value:
          'Consultas de saldo, transferencias pendientes, nómina o reclamaciones económicas.\n' +
          '→ Botón **Finanzas**',
        inline: false,
      },
      {
        name: '╭─  🗂️  Área / Acceso',
        value:
          'Solicitud de reasignación de área, claves o permisos de canal.\n' +
          '→ Botón **Área**',
        inline: false,
      },
      {
        name: '╭─  🎙️  Sala de voz privada',
        value:
          'Conversación en tiempo real con el staff (canal de voz + control por texto).\n' +
          '→ Botón **Ticket de voz**',
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
    image: banner || undefined,
    footer: MARCA.division,
    footerIcon: icon || undefined,
  });
}

function panelBotones() {
  return [
    new ActionRowBuilder().addComponents(
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
        .setCustomId('tickets:abrir:finanzas')
        .setLabel('Finanzas')
        .setEmoji('💰')
        .setStyle(ButtonStyle.Success),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('tickets:abrir:area')
        .setLabel('Área / Acceso')
        .setEmoji('🗂️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('tickets:abrir:voz')
        .setLabel('Ticket de voz')
        .setEmoji('🎙️')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function controlesTicket(ticketId) {
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
  const meta = TIPOS[tipo] || TIPOS.soporte;
  const esVoz = tipo === 'voz';
  const campos = [
    { name: 'Referencia', value: `\`${id}\``, inline: true },
    { name: 'Modalidad', value: `${meta.emoji} ${meta.label}`, inline: true },
    { name: 'Estado', value: '● Abierto', inline: true },
    { name: 'Solicitante', value: `<@${memberId}>`, inline: true },
  ];
  if (vozId) {
    campos.push({ name: 'Sala de voz', value: `<#${vozId}>`, inline: true });
  }

  let instrucciones;
  if (esVoz) {
    instrucciones = 'Únete a la sala de voz. El staff puede incorporar a terceros y archivar la conversación de control.';
  } else if (tipo === 'finanzas') {
    instrucciones =
      'Indica el **ID de movimiento** (si aplica), el concepto y el importe reclamado.\n' +
      'Adjunta capturas del DM de firma o del historial si las tienes.';
  } else if (tipo === 'area') {
    instrucciones =
      'Especifica el área o clave solicitada y el motivo.\n' +
      'Un cofundador o director revisará la solicitud.';
  } else if (tipo === 'reporte') {
    instrucciones =
      'Describe los hechos con fecha, involucrados y evidencias.\n' +
      'Evita acusaciones sin base; el historial se archiva.';
  } else {
    instrucciones =
      'Describe tu caso con claridad.\n' +
      'El personal de **Soporte Técnico** o Administración atenderá este hilo.';
  }

  campos.push({ name: 'Instrucciones', value: instrucciones, inline: false });
  campos.push({
    name: 'Atención',
    value: 'Notificado: **Soporte Técnico** y staff con acceso a tickets.',
    inline: false,
  });

  return embedBase({
    color: meta.color || COLORES.institucional,
    author: { name: MARCA.nombre, iconURL: icon || undefined },
    titulo: esVoz ? 'Ticket de voz abierto' : `Ticket abierto · ${meta.label}`,
    descripcion: `*${MARCA.lema}*`,
    campos,
    thumbnail: icon || undefined,
    footer: MARCA.division,
    footerIcon: icon || undefined,
  });
}

async function aplicarAccesoStaff(channel, rolesStaff, esVoz = false) {
  for (const rol of rolesStaff) {
    try {
      if (esVoz) {
        await channel.permissionOverwrites.edit(rol.id, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
        });
      } else {
        await channel.permissionOverwrites.edit(rol.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          EmbedLinks: true,
        });
      }
    } catch (err) {
      console.warn('[Tickets] overwrite rol', rol.name, err.message);
    }
  }
}

async function crearTicketTexto(guild, member, tipo, client) {
  asegurarTabla();
  const db = getDb();
  const id = nextId('TKT');
  const cat = await asegurarCategoriaTickets(guild);
  const rolesStaff = resolverRolesStaff(guild);

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

  for (const rol of rolesStaff) {
    overwrites.push({
      id: rol.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    });
  }

  const canal = await guild.channels.create({
    name: nombreCanalTicket(tipo, id),
    type: ChannelType.GuildText,
    parent: cat.id,
    permissionOverwrites: overwrites,
    reason: `Aegis · ticket ${id}`,
  });

  db.prepare(`
    INSERT INTO tickets (id, tipo, canal_id, autor_id, estado, motivo)
    VALUES (?, ?, ?, ?, 'abierto', ?)
  `).run(id, tipo, canal.id, member.id, tipo);

  auditoria.registrar(member.id, 'TICKET.ABRIR', { id, tipo, canal: canal.id });

  const ping = mencionesStaff(rolesStaff);
  const content = ping
    ? `${ping}\nSolicitante: <@${member.id}>`
    : `<@${member.id}>`;

  await canal.send({
    content,
    embeds: [embedAperturaTicket({ id, tipo, memberId: member.id, client, guild })],
    components: controlesTicket(id),
    allowedMentions: {
      roles: rolesStaff.map((r) => r.id),
      users: [member.id],
    },
  });

  return { id, canal, rolesStaff };
}

async function crearTicketVoz(guild, member, client) {
  asegurarTabla();
  const db = getDb();
  const id = nextId('TKT');
  const cat = await asegurarCategoriaTickets(guild);
  const rolesStaff = resolverRolesStaff(guild);

  const overwritesTexto = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
  ];
  const overwritesVoz = [
    { id: guild.id, deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel] },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ],
    },
  ];

  if (guild.members.me) {
    overwritesTexto.push({
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
    overwritesVoz.push({
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.ManageChannels,
      ],
    });
  }

  for (const rol of rolesStaff) {
    overwritesTexto.push({
      id: rol.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
    overwritesVoz.push({
      id: rol.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ],
    });
  }

  const texto = await guild.channels.create({
    name: nombreCanalTicket('voz', id),
    type: ChannelType.GuildText,
    parent: cat.id,
    permissionOverwrites: overwritesTexto,
    reason: `Aegis · ticket voz ${id}`,
  });

  const voz = await guild.channels.create({
    name: `voz-${String(id).toLowerCase().replace(/[^a-z0-9-]/g, '')}`.slice(0, 90),
    type: ChannelType.GuildVoice,
    parent: cat.id,
    permissionOverwrites: overwritesVoz,
    reason: `Aegis · VC ticket ${id}`,
  });

  db.prepare(`
    INSERT INTO tickets (id, tipo, canal_id, voz_id, autor_id, estado, motivo)
    VALUES (?, 'voz', ?, ?, ?, 'abierto', 'voz')
  `).run(id, texto.id, voz.id, member.id);

  auditoria.registrar(member.id, 'TICKET.ABRIR_VOZ', { id, texto: texto.id, voz: voz.id });

  const ping = mencionesStaff(rolesStaff);
  const content = ping
    ? `${ping}\nSolicitante: <@${member.id}>`
    : `<@${member.id}>`;

  await texto.send({
    content,
    embeds: [embedAperturaTicket({
      id, tipo: 'voz', memberId: member.id, vozId: voz.id, client, guild,
    })],
    components: controlesTicket(id),
    allowedMentions: {
      roles: rolesStaff.map((r) => r.id),
      users: [member.id],
    },
  });

  return { id, canal: texto, voz, rolesStaff };
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
          footer: MARCA.division,
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
        footer: `${MARCA.division} · Archivo`,
        footerIcon: icon || undefined,
      }),
    ],
  });

  if (transcripcion.length > 3500) {
    const { AttachmentBuilder } = require('discord.js');
    const buf = Buffer.from(transcripcion, 'utf8');
    await log.send({
      content: `Transcripción completa · ${ticket.id}`,
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
              'La transcripción fue enviada al archivo de mando.\n' +
              'Este canal se eliminará en unos segundos.',
            footer: MARCA.division,
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
  TIPOS,
  resolverRolesStaff,
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

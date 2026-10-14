const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb, nextId } = require('../db');
const auditoria = require('../services/auditoria');
const { cargosMapeados, esAdminDiscord } = require('../services/acceso');
const { embedBase, COLORES } = require('../utils/plantillas');
const { sanitizar, truncar } = require('../utils/helpers');
const { getTodosCargos } = require('../data/organigrama');
const rolesSvc = require('../services/roles');
const { actorTexto } = require('../services/solicitudes');

const prefix = 'postulacion';
const CANAL_POSTULACIONES = '1559071665231765567';
const CARGOS_REVISION = ['ST.FUNDADOR', 'ST.CO_CALIDAD', 'ST.CO_ESTRATEGIA'];

function asegurarTabla() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS postulaciones (
      id TEXT PRIMARY KEY,
      discord_id TEXT NOT NULL,
      personaje TEXT NOT NULL,
      area TEXT NOT NULL,
      experiencia TEXT,
      motivacion TEXT,
      disponibilidad TEXT,
      estado TEXT DEFAULT 'Pendiente',
      revisado_por TEXT,
      motivo_rechazo TEXT,
      cargo_otorgado TEXT,
      msg_id TEXT,
      canal_id TEXT,
      creado_en TEXT DEFAULT (datetime('now'))
    )
  `);
  try { getDb().exec('ALTER TABLE postulaciones ADD COLUMN motivo_rechazo TEXT'); } catch (_) {}
  try { getDb().exec('ALTER TABLE postulaciones ADD COLUMN cargo_otorgado TEXT'); } catch (_) {}
  try { getDb().exec('ALTER TABLE postulaciones ADD COLUMN msg_id TEXT'); } catch (_) {}
  try { getDb().exec('ALTER TABLE postulaciones ADD COLUMN canal_id TEXT'); } catch (_) {}
}

function puedeRevisar(interaction) {
  if (esAdminDiscord(interaction)) return true;
  const cargos = new Set(cargosMapeados(interaction.member));
  return CARGOS_REVISION.some((c) => cargos.has(c));
}

function botonesRevision(id) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`postulacion:aprobar:${id}`).setLabel('Aprobar').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`postulacion:negar:${id}`).setLabel('Negar').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`postulacion:entrevistar:${id}`).setLabel('Entrevistar').setStyle(ButtonStyle.Primary),
    ),
  ];
}

function embedPostulacion(row) {
  const color =
    row.estado === 'Aprobada' ? COLORES.medicina
      : row.estado === 'Negada' ? COLORES.denegado
        : row.estado === 'Entrevista' ? COLORES.seguridad
          : COLORES.oro;
  const campos = [
    { name: 'Aspirante', value: `<@${row.discord_id}>`, inline: true },
    { name: 'Personaje', value: row.personaje, inline: true },
    { name: 'Area aspirada', value: row.area, inline: true },
    { name: 'Disponibilidad', value: row.disponibilidad || '—', inline: true },
    { name: 'Estado', value: row.estado, inline: true },
    { name: 'Experiencia RP', value: truncar(row.experiencia || '—', 900), inline: false },
    { name: 'Motivacion', value: truncar(row.motivacion || '—', 600), inline: false },
  ];
  if (row.revisado_por) campos.push({ name: 'Revisado por', value: row.revisado_por, inline: true });
  if (row.cargo_otorgado) campos.push({ name: 'Cargo otorgado', value: row.cargo_otorgado, inline: true });
  if (row.motivo_rechazo) campos.push({ name: 'Motivo de negacion', value: truncar(row.motivo_rechazo, 500), inline: false });
  return embedBase({
    color,
    author: true,
    titulo: `Postulacion · ${row.id}`,
    descripcion: row.estado === 'Pendiente' ? 'Revision por **Fundador** o **Cofundadores**.' : `Estado: **${row.estado}**`,
    campos,
    footer: 'Postulaciones',
  });
}

function menuCargos(id, pagina = 0) {
  const todos = (typeof getTodosCargos === 'function' ? getTodosCargos() : []).filter(
    (c) => c && c.key && !c.separador && c.nombre
  );
  const pageSize = 25;
  const totalPag = Math.max(1, Math.ceil(todos.length / pageSize));
  const p = Math.max(0, Math.min(pagina, totalPag - 1));
  const slice = todos.slice(p * pageSize, p * pageSize + pageSize);
  const select = new StringSelectMenuBuilder()
    .setCustomId(`postulacion:cargo:${id}:${p}`)
    .setPlaceholder(`Cargo a otorgar (pag. ${p + 1}/${totalPag})`)
    .addOptions(slice.map((c) => ({
      label: String(c.nombre).slice(0, 100),
      description: String(c.key).slice(0, 100),
      value: c.key,
    })));
  const rows = [new ActionRowBuilder().addComponents(select)];
  if (totalPag > 1) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`postulacion:pagina:${id}:${p - 1}`).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(p <= 0),
      new ButtonBuilder().setCustomId(`postulacion:pagina:${id}:${p + 1}`).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(p >= totalPag - 1),
    ));
  }
  return rows;
}

async function actualizarMensajePublico(guild, row) {
  if (!row.canal_id || !row.msg_id || !guild) return;
  try {
    const ch = await guild.channels.fetch(row.canal_id).catch(() => null);
    const msg = ch ? await ch.messages.fetch(row.msg_id).catch(() => null) : null;
    if (!msg) return;
    const cerrado = row.estado === 'Aprobada' || row.estado === 'Negada';
    await msg.edit({
      content:
        row.estado === 'Aprobada' ? `Postulacion **${row.id}** · **Aprobada** · <@${row.discord_id}>`
          : row.estado === 'Negada' ? `Postulacion **${row.id}** · **Negada** · <@${row.discord_id}>`
            : row.estado === 'Entrevista' ? `Postulacion **${row.id}** · **En entrevista** · <@${row.discord_id}>`
              : `Postulacion **${row.id}** · <@${row.discord_id}>`,
      embeds: [embedPostulacion(row)],
      components: cerrado ? [] : botonesRevision(row.id),
    });
  } catch (err) {
    console.warn('[postulacion msg]', err.message);
  }
}

async function handle(interaction, accion, args) {
  asegurarTabla();

  if (accion === 'enviar') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const personaje = sanitizar(interaction.fields.getTextInputValue('personaje'));
    const area = sanitizar(interaction.fields.getTextInputValue('area'));
    const experiencia = sanitizar(interaction.fields.getTextInputValue('experiencia'));
    const motivacion = sanitizar(interaction.fields.getTextInputValue('motivacion'));
    const disponibilidad = sanitizar(interaction.fields.getTextInputValue('disponibilidad') || '—');
    const id = nextId('POS');
    getDb().prepare(`
      INSERT INTO postulaciones (id, discord_id, personaje, area, experiencia, motivacion, disponibilidad)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, interaction.user.id, personaje, area, experiencia, motivacion, disponibilidad);
    auditoria.registrar(interaction.user.id, 'POSTULACION.ENVIAR', { id, area });
    const row = getDb().prepare('SELECT * FROM postulaciones WHERE id = ?').get(id);
    let publicado = false;
    if (interaction.guild) {
      const ch = await interaction.guild.channels.fetch(CANAL_POSTULACIONES).catch(() => null);
      if (ch?.isTextBased()) {
        const msg = await ch.send({
          content: `Nueva postulacion **${id}** · <@${interaction.user.id}>`,
          embeds: [embedPostulacion(row)],
          components: botonesRevision(id),
        });
        getDb().prepare('UPDATE postulaciones SET msg_id = ?, canal_id = ? WHERE id = ?').run(msg.id, ch.id, id);
        publicado = true;
      }
    }
    await interaction.editReply({
      embeds: [embedBase({
        color: COLORES.medicina,
        titulo: 'Postulacion enviada',
        descripcion: `Tu hoja de vida (**${id}**) fue registrada` + (publicado ? ' en el canal de la Fundacion.' : '.') + '\nEspera revision.',
        footer: 'Postulaciones',
      })],
    });
    return;
  }

  const id = args[0];
  if (!id) {
    await interaction.reply({ content: 'Postulacion no encontrada.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }
  const row = getDb().prepare('SELECT * FROM postulaciones WHERE id = ?').get(id);
  if (!row) {
    await interaction.reply({ content: 'La postulacion no existe.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  if (['aprobar', 'negar', 'entrevistar', 'pagina', 'cargo', 'negar_motivo'].includes(accion)) {
    if (!puedeRevisar(interaction) && accion !== 'negar_motivo') {
      // negar_motivo also needs check
    }
    if (!puedeRevisar(interaction)) {
      await interaction.reply({
        content: 'Solo el **Fundador** o un **Cofundador** puede revisar postulaciones.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  if (accion === 'aprobar') {
    if (row.estado !== 'Pendiente' && row.estado !== 'Entrevista') {
      await interaction.reply({ content: `Estado actual: **${row.estado}**.`, flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({
      embeds: [embedBase({
        color: COLORES.oro,
        titulo: `Aprobar · ${id}`,
        descripcion: `Aspirante: <@${row.discord_id}> · **${row.personaje}**\nElige el **cargo** a otorgar en el menu.`,
        footer: 'Postulaciones',
      })],
      components: menuCargos(id, 0),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (accion === 'pagina') {
    const pagina = parseInt(args[1], 10) || 0;
    await interaction.update({ components: menuCargos(id, pagina) }).catch(() => {});
    return;
  }

  if (accion === 'cargo') {
    const cargoKey = interaction.values?.[0];
    if (!cargoKey) {
      await interaction.reply({ content: 'No se selecciono cargo.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferUpdate().catch(() => {});
    const member = await interaction.guild.members.fetch(row.discord_id).catch(() => null);
    if (!member) {
      await interaction.followUp({ content: 'Miembro no encontrado en el servidor.', flags: MessageFlags.Ephemeral });
      return;
    }
    let cargoNombre = cargoKey;
    try {
      await rolesSvc.asignarCargo(
        interaction.guild,
        member,
        cargoKey,
        actorTexto(interaction.user),
        `Postulacion ${id} aprobada`
      );
      const todos = typeof getTodosCargos === 'function' ? getTodosCargos() : [];
      const found = todos.find((c) => c.key === cargoKey);
      if (found) cargoNombre = found.nombre;
    } catch (err) {
      await interaction.followUp({ content: `No se pudo otorgar el rol: ${err.message}`, flags: MessageFlags.Ephemeral });
      return;
    }
    const revisor = actorTexto(interaction.user);
    getDb().prepare(`UPDATE postulaciones SET estado = 'Aprobada', revisado_por = ?, cargo_otorgado = ? WHERE id = ?`)
      .run(revisor, cargoNombre, id);
    auditoria.registrar(interaction.user.id, 'POSTULACION.APROBAR', { id, miembro: row.discord_id, cargoKey });
    const actualizado = getDb().prepare('SELECT * FROM postulaciones WHERE id = ?').get(id);
    await actualizarMensajePublico(interaction.guild, actualizado);
    await interaction.followUp({
      embeds: [embedBase({
        color: COLORES.medicina,
        titulo: 'Postulacion aprobada',
        descripcion: `**${id}** · <@${row.discord_id}>\nCargo: **${cargoNombre}**\nPuedes emitir el contrato con \`/contrato\` si corresponde.`,
        footer: 'Postulaciones',
      })],
      flags: MessageFlags.Ephemeral,
    });
    try {
      const user = await interaction.client.users.fetch(row.discord_id);
      await user.send({ embeds: [embedBase({
        color: COLORES.medicina,
        titulo: 'Postulacion aprobada',
        descripcion: `Tu postulacion **${id}** fue aprobada.\nCargo asignado: **${cargoNombre}**.`,
        footer: 'Postulaciones',
      })] });
    } catch (_) {}
    return;
  }

  if (accion === 'negar') {
    if (row.estado !== 'Pendiente' && row.estado !== 'Entrevista') {
      await interaction.reply({ content: `Estado: **${row.estado}**.`, flags: MessageFlags.Ephemeral });
      return;
    }
    const modal = new ModalBuilder().setCustomId(`postulacion:negar_motivo:${id}`).setTitle('Negar postulacion');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('motivo')
        .setLabel('Motivo de la negacion')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500),
    ));
    await interaction.showModal(modal);
    return;
  }

  if (accion === 'negar_motivo') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const motivo = sanitizar(interaction.fields.getTextInputValue('motivo'));
    getDb().prepare(`UPDATE postulaciones SET estado = 'Negada', revisado_por = ?, motivo_rechazo = ? WHERE id = ?`)
      .run(actorTexto(interaction.user), motivo, id);
    auditoria.registrar(interaction.user.id, 'POSTULACION.NEGAR', { id });
    const actualizado = getDb().prepare('SELECT * FROM postulaciones WHERE id = ?').get(id);
    await actualizarMensajePublico(interaction.guild, actualizado);
    await interaction.editReply({
      embeds: [embedBase({
        color: COLORES.denegado,
        titulo: 'Postulacion negada',
        descripcion: `**${id}** · Motivo registrado y notificado al aspirante.`,
        footer: 'Postulaciones',
      })],
    });
    try {
      const user = await interaction.client.users.fetch(row.discord_id);
      await user.send({ embeds: [embedBase({
        color: COLORES.denegado,
        titulo: 'Postulacion no aceptada',
        descripcion: `Tu postulacion **${id}** no fue aceptada.\n\n**Motivo:**\n${motivo}`,
        footer: 'Postulaciones',
      })] });
    } catch (_) {}
    return;
  }

  if (accion === 'entrevistar') {
    if (row.estado === 'Aprobada' || row.estado === 'Negada') {
      await interaction.reply({ content: `Estado: **${row.estado}**.`, flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guild = interaction.guild;
    const ticketId = nextId('TKT');
    const nombre = `entrevista-${String(row.personaje).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.slice(0, 90);
    const overwrites = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: row.discord_id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
      { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
    ];
    const canal = await guild.channels.create({
      name: nombre,
      type: ChannelType.GuildText,
      topic: `Entrevista ${id} · ${ticketId}`,
      permissionOverwrites: overwrites,
      reason: `Entrevista ${id}`,
    });
    getDb().prepare(`UPDATE postulaciones SET estado = 'Entrevista', revisado_por = ? WHERE id = ?`)
      .run(actorTexto(interaction.user), id);
    try {
      getDb().exec(`CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY, tipo TEXT NOT NULL, canal_id TEXT, voz_id TEXT,
        autor_id TEXT NOT NULL, estado TEXT DEFAULT 'abierto', motivo TEXT,
        cerrado_por TEXT, creado_en TEXT DEFAULT (datetime('now')), cerrado_en TEXT
      )`);
      getDb().prepare(`INSERT INTO tickets (id, tipo, canal_id, autor_id, estado, motivo) VALUES (?, 'entrevista', ?, ?, 'abierto', ?)`) 
        .run(ticketId, canal.id, row.discord_id, `Postulacion ${id}`);
    } catch (e) { console.warn(e.message); }
    auditoria.registrar(interaction.user.id, 'POSTULACION.ENTREVISTA', { id, ticket: ticketId });
    await canal.send({
      content: `<@${row.discord_id}> · ${interaction.user}`,
      embeds: [embedBase({
        color: COLORES.seguridad,
        author: true,
        titulo: `Entrevista · ${id}`,
        descripcion: `Ticket **${ticketId}**\nPersonaje: **${row.personaje}** · Area: **${row.area}**`,
        campos: [
          { name: 'Experiencia', value: truncar(row.experiencia || '—', 800), inline: false },
          { name: 'Motivacion', value: truncar(row.motivacion || '—', 500), inline: false },
        ],
        footer: 'Entrevistas',
      })],
    });
    const actualizado = getDb().prepare('SELECT * FROM postulaciones WHERE id = ?').get(id);
    await actualizarMensajePublico(guild, actualizado);
    await interaction.editReply({
      embeds: [embedBase({
        color: COLORES.seguridad,
        titulo: 'Entrevista abierta',
        descripcion: `Canal: ${canal} · Ticket **${ticketId}**`,
        footer: 'Postulaciones',
      })],
    });
    try {
      const user = await interaction.client.users.fetch(row.discord_id);
      await user.send({ embeds: [embedBase({
        color: COLORES.seguridad,
        titulo: 'Entrevista de postulacion',
        descripcion: `Tu postulacion **${id}** paso a entrevista.\nCanal: ${canal}`,
        footer: 'Postulaciones',
      })] });
    } catch (_) {}
    return;
  }

  await interaction.reply({ content: 'Accion no reconocida.', flags: MessageFlags.Ephemeral }).catch(() => {});
}

module.exports = { prefix, handle, CANAL_POSTULACIONES };

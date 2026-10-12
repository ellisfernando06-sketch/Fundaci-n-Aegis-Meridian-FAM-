const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb } = require('../db');
const {
  actorTexto,
  nombreArea,
  embedSolicitud,
} = require('../services/solicitudes');
const {
  promoverAMiembro,
  setArea,
  asegurarPerfil,
} = require('../services/roles');
const auditoria = require('../services/auditoria');
const { embedBase, COLORES } = require('../utils/plantillas');
const { ORGANIGRAMA } = require('../data/organigrama');
const { sanitizar } = require('../utils/helpers');

const prefix = 'solicitudes';

function puedeRevisar(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
  // Cofundadores / fundador por roles_map
  const keys = ['ST.FUNDADOR', 'ST.CO_CALIDAD', 'ST.CO_ESTRATEGIA', 'DIR.GENERAL'];
  const map = getDb().prepare('SELECT cargo_key, role_id FROM roles_map WHERE cargo_key IN (?,?,?,?)').all(...keys);
  return map.some((r) => interaction.member?.roles?.cache?.has(r.role_id));
}

async function handle(interaction, accion, args) {
  switch (accion) {
    case 'aprobar':
      return onAprobar(interaction, args[0]);
    case 'denegar':
      return mostrarModalDenegar(interaction, args[0]);
    case 'denegar_submit':
      return onDenegarSubmit(interaction, args[0]);
    case 'reasignar':
      return onReasignarMenu(interaction, args[0]);
    case 'reasignar_area':
      return mostrarModalReasignar(interaction, args[0], interaction.values?.[0]);
    case 'reasignar_submit':
      return onReasignarSubmit(interaction, args[0], args[1]);
    default:
      await interaction.reply({
        content: 'Accion no reconocida.',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
  }
}

async function onAprobar(interaction, solId) {
  if (!puedeRevisar(interaction)) {
    await interaction.reply({
      content: 'Solo cofundadores o direccion pueden revisar solicitudes.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();
  const db = getDb();
  const sol = db.prepare('SELECT * FROM solicitudes_area WHERE id = ?').get(solId);
  if (!sol || sol.estado !== 'Pendiente') {
    await interaction.followUp({
      content: 'La solicitud no existe o ya fue resuelta.',
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
    return;
  }

  const member = await interaction.guild.members.fetch(sol.solicitante_id).catch(() => null);
  if (!member) {
    await interaction.followUp({
      content: 'El solicitante ya no esta en el servidor.',
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
    return;
  }

  const revisor = actorTexto(interaction.user);
  await promoverAMiembro(interaction.guild, member, sol.area, revisor);

  db.prepare(`
    UPDATE solicitudes_area SET estado = 'Aprobada', revisado_por = ? WHERE id = ?
  `).run(revisor, solId);

  auditoria.registrar(interaction.user.id, 'SOLICITUD.APROBAR', {
    solId,
    solicitante: sol.solicitante_id,
    area: sol.area,
  });

  const actualizada = db.prepare('SELECT * FROM solicitudes_area WHERE id = ?').get(solId);
  await interaction.editReply({
    embeds: [embedSolicitud(actualizada, {
      motivoRevision: `Aprobada por ${revisor}`,
    })],
    components: [],
  });

  try {
    await member.send({
      embeds: [embedBase({
        color: COLORES.medicina,
        titulo: 'Solicitud aprobada',
        descripcion:
          `Tu ingreso a **${nombreArea(sol.area)}** fue aprobado.\n\n` +
          `**Aprobado por:** ${revisor}`,
        footer: 'Solicitudes',
      })],
    });
  } catch (_) {}
}

async function mostrarModalDenegar(interaction, solId) {
  if (!puedeRevisar(interaction)) {
    await interaction.reply({
      content: 'Solo cofundadores o direccion pueden revisar solicitudes.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const modal = new ModalBuilder()
    .setCustomId(`solicitudes:denegar_submit:${solId}`)
    .setTitle('Denegar solicitud');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('motivo')
        .setLabel('Motivo de la denegacion')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500),
    ),
  );
  await interaction.showModal(modal);
}

async function onDenegarSubmit(interaction, solId) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const db = getDb();
  const sol = db.prepare('SELECT * FROM solicitudes_area WHERE id = ?').get(solId);
  if (!sol || sol.estado !== 'Pendiente') {
    await interaction.editReply({ content: 'La solicitud no existe o ya fue resuelta.' });
    return;
  }

  const motivo = sanitizar(interaction.fields.getTextInputValue('motivo'));
  const revisor = actorTexto(interaction.user);

  db.prepare(`
    UPDATE solicitudes_area SET estado = 'Denegada', revisado_por = ?, motivo = ? WHERE id = ?
  `).run(revisor, motivo, solId);

  auditoria.registrar(interaction.user.id, 'SOLICITUD.DENEGAR', {
    solId,
    solicitante: sol.solicitante_id,
    motivo,
  });

  const actualizada = db.prepare('SELECT * FROM solicitudes_area WHERE id = ?').get(solId);

  // Actualizar mensaje original si es posible
  try {
    if (sol.msg_id && interaction.message) {
      await interaction.message.edit({
        embeds: [embedSolicitud(actualizada, { motivoRevision: motivo })],
        components: [],
      }).catch(() => {});
    }
  } catch (_) {}

  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.denegado,
      titulo: 'Solicitud denegada',
      campos: [
        { name: 'ID', value: solId, inline: true },
        { name: 'Denegada por', value: revisor, inline: true },
        { name: 'Motivo', value: motivo, inline: false },
      ],
      footer: 'Solicitudes',
    })],
  });

  const member = await interaction.guild.members.fetch(sol.solicitante_id).catch(() => null);
  if (member) {
    try {
      await member.send({
        embeds: [embedBase({
          color: COLORES.denegado,
          titulo: 'Solicitud denegada',
          descripcion:
            `Tu solicitud de ingreso fue denegada.\n\n` +
            `**Denegada por:** ${revisor}\n**Motivo:** ${motivo}`,
          footer: 'Solicitudes',
        })],
      });
    } catch (_) {}
  }
}

async function onReasignarMenu(interaction, solId) {
  if (!puedeRevisar(interaction)) {
    await interaction.reply({
      content: 'Solo cofundadores o direccion pueden revisar solicitudes.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const opciones = Object.entries(ORGANIGRAMA)
    .filter(([k]) => !['insurgencia'].includes(k))
    .slice(0, 25)
    .map(([key, rama]) => ({
      label: rama.nombre.slice(0, 100),
      value: key,
      description: `Reasignar a ${rama.nombre}`.slice(0, 100),
    }));

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`solicitudes:reasignar_area:${solId}`)
      .setPlaceholder('Selecciona la nueva area')
      .addOptions(opciones),
  );

  await interaction.reply({
    embeds: [embedBase({
      color: COLORES.cupula,
      titulo: 'Reasignar area',
      descripcion: `Solicitud **${solId}**. Elige el area y luego indica el motivo.`,
      footer: 'Solicitudes',
    })],
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

async function mostrarModalReasignar(interaction, solId, areaNueva) {
  const modal = new ModalBuilder()
    .setCustomId(`solicitudes:reasignar_submit:${solId}:${areaNueva}`)
    .setTitle('Reasignar y aprobar');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('motivo')
        .setLabel('Motivo de la reasignacion')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500),
    ),
  );
  await interaction.showModal(modal);
}

async function onReasignarSubmit(interaction, solId, areaNueva) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const db = getDb();
  const sol = db.prepare('SELECT * FROM solicitudes_area WHERE id = ?').get(solId);
  if (!sol || sol.estado !== 'Pendiente') {
    await interaction.editReply({ content: 'La solicitud no existe o ya fue resuelta.' });
    return;
  }

  const motivo = sanitizar(interaction.fields.getTextInputValue('motivo'));
  const revisor = actorTexto(interaction.user);
  const member = await interaction.guild.members.fetch(sol.solicitante_id).catch(() => null);
  if (!member) {
    await interaction.editReply({ content: 'El solicitante ya no esta en el servidor.' });
    return;
  }

  asegurarPerfil(member.id);
  await promoverAMiembro(interaction.guild, member, areaNueva, revisor);

  db.prepare(`
    UPDATE solicitudes_area
    SET estado = 'Aprobada', area = ?, revisado_por = ?, motivo = ?
    WHERE id = ?
  `).run(areaNueva, revisor, `Reasignada: ${motivo}`, solId);

  auditoria.registrar(interaction.user.id, 'SOLICITUD.REASIGNAR', {
    solId,
    solicitante: sol.solicitante_id,
    areaAnterior: sol.area,
    areaNueva,
    motivo,
  });

  const actualizada = db.prepare('SELECT * FROM solicitudes_area WHERE id = ?').get(solId);

  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Solicitud reasignada y aprobada',
      campos: [
        { name: 'ID', value: solId, inline: true },
        { name: 'Area nueva', value: nombreArea(areaNueva), inline: true },
        { name: 'Aprobado por', value: revisor, inline: false },
        { name: 'Motivo', value: motivo, inline: false },
      ],
      footer: 'Solicitudes',
    })],
  });

  try {
    await member.send({
      embeds: [embedBase({
        color: COLORES.medicina,
        titulo: 'Solicitud aprobada (area reasignada)',
        descripcion:
          `Fuiste asignado a **${nombreArea(areaNueva)}**.\n\n` +
          `**Aprobado por:** ${revisor}\n**Motivo:** ${motivo}`,
        footer: 'Solicitudes',
      })],
    });
  } catch (_) {}
}

module.exports = { prefix, handle };

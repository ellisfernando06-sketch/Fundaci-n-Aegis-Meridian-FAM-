const {
  ActionRowBuilder,
  UserSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');
const {
  esStaff,
  crearTicketTexto,
  crearTicketVoz,
  agregarPersona,
  transcribir,
  asegurarTabla,
} = require('../services/tickets');
const { embedBase, COLORES } = require('../utils/plantillas');
const { getDb } = require('../db');

const prefix = 'tickets';

async function handle(interaction, accion, args) {
  asegurarTabla();

  switch (accion) {
    case 'abrir':
      return onAbrir(interaction, args[0]);
    case 'agregar_menu':
      return onAgregarMenu(interaction, args[0]);
    case 'agregar':
      return onAgregar(interaction, args[0]);
    case 'transcribir':
      return onTranscribir(interaction, args[0], false);
    case 'cerrar':
      return onTranscribir(interaction, args[0], true);
    default:
      await interaction.reply({
        content: 'Accion de ticket no reconocida.',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
  }
}

async function onAbrir(interaction, tipo) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Un ticket abierto por usuario
  const db = getDb();
  const abierto = db.prepare(
    "SELECT id, canal_id FROM tickets WHERE autor_id = ? AND estado = 'abierto' LIMIT 1"
  ).get(interaction.user.id);
  if (abierto) {
    await interaction.editReply({
      embeds: [embedBase({
        color: COLORES.amarillo,
        titulo: 'Ticket ya abierto',
        descripcion: `Ya tienes el ticket **${abierto.id}** en <#${abierto.canal_id}>.`,
        footer: 'Tickets',
      })],
    });
    return;
  }

  try {
    if (tipo === 'voz') {
      const r = await crearTicketVoz(interaction.guild, interaction.member);
      await interaction.editReply({
        embeds: [embedBase({
          color: COLORES.medicina,
          titulo: 'Ticket de voz creado',
          descripcion: `**${r.id}** · canal <#${r.canal.id}> · voz <#${r.voz.id}>`,
          footer: 'Tickets',
        })],
      });
      return;
    }

    const tipoFinal = tipo === 'reporte' ? 'reporte' : 'soporte';
    const r = await crearTicketTexto(interaction.guild, interaction.member, tipoFinal);
    await interaction.editReply({
      embeds: [embedBase({
        color: COLORES.medicina,
        titulo: 'Ticket creado',
        descripcion: `**${r.id}** · <#${r.canal.id}>`,
        footer: 'Tickets',
      })],
    });
  } catch (err) {
    await interaction.editReply({
      embeds: [embedBase({
        color: COLORES.denegado,
        titulo: 'No se pudo crear el ticket',
        descripcion: String(err.message || err).slice(0, 400),
        footer: 'Tickets',
      })],
    });
  }
}

async function onAgregarMenu(interaction, ticketId) {
  if (!esStaff(interaction.member)) {
    await interaction.reply({
      content: 'Solo administradores o helpers pueden agregar personas.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const row = new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`tickets:agregar:${ticketId}`)
      .setPlaceholder('Selecciona a quien agregar')
      .setMinValues(1)
      .setMaxValues(1),
  );

  await interaction.reply({
    embeds: [embedBase({
      color: COLORES.cupula,
      titulo: 'Agregar persona al ticket',
      descripcion: `Ticket **${ticketId}**. Elige un miembro del servidor.`,
      footer: 'Tickets',
    })],
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

async function onAgregar(interaction, ticketId) {
  if (!esStaff(interaction.member)) {
    await interaction.reply({
      content: 'Solo administradores o helpers pueden agregar personas.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();
  const userId = interaction.values[0];

  try {
    await agregarPersona(interaction.guild, ticketId, userId, interaction.user);
    await interaction.followUp({
      embeds: [embedBase({
        color: COLORES.medicina,
        titulo: 'Persona agregada',
        descripcion: `<@${userId}> ahora tiene acceso al ticket **${ticketId}**.`,
        footer: 'Tickets',
      })],
      flags: MessageFlags.Ephemeral,
    });
  } catch (err) {
    await interaction.followUp({
      content: String(err.message || err).slice(0, 300),
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
  }
}

async function onTranscribir(interaction, ticketId, cerrar) {
  if (!esStaff(interaction.member)) {
    await interaction.reply({
      content: 'Solo administradores o helpers pueden transcribir o cerrar tickets.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    await transcribir(interaction.guild, ticketId, interaction.user, { cerrar });
    await interaction.editReply({
      embeds: [embedBase({
        color: COLORES.medicina,
        titulo: cerrar ? 'Ticket cerrado' : 'Transcripcion enviada',
        descripcion: cerrar
          ? `**${ticketId}** cerrado. Transcripcion en el canal de logs.`
          : `Transcripcion de **${ticketId}** enviada a logs.`,
        footer: 'Tickets',
      })],
    });
  } catch (err) {
    await interaction.editReply({
      embeds: [embedBase({
        color: COLORES.denegado,
        titulo: 'Operacion no completada',
        descripcion: String(err.message || err).slice(0, 400),
        footer: 'Tickets',
      })],
    });
  }
}

module.exports = { prefix, handle };

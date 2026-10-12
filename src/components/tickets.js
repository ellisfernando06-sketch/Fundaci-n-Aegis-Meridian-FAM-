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
  iconoInstitucional,
  TIPOS,
} = require('../services/tickets');
const { embedBase, COLORES, MARCA } = require('../utils/plantillas');
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
        content: 'Acción de ticket no reconocida.',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
  }
}

async function onAbrir(interaction, tipo) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const icon = iconoInstitucional(interaction.client, interaction.guild);

  const db = getDb();
  const abierto = db.prepare(
    "SELECT id, canal_id FROM tickets WHERE autor_id = ? AND estado = 'abierto' LIMIT 1"
  ).get(interaction.user.id);
  if (abierto) {
    await interaction.editReply({
      embeds: [embedBase({
        color: COLORES.amarillo,
        author: { name: MARCA.nombre, iconURL: icon || undefined },
        titulo: 'Expediente ya abierto',
        descripcion: `Ya dispones del ticket **${abierto.id}** en <#${abierto.canal_id}>.`,
        footer: MARCA.division,
        footerIcon: icon || undefined,
      })],
    });
    return;
  }

  try {
    if (tipo === 'voz') {
      const r = await crearTicketVoz(interaction.guild, interaction.member, interaction.client);
      await interaction.editReply({
        embeds: [embedBase({
          color: COLORES.institucional,
          author: { name: MARCA.nombre, iconURL: icon || undefined },
          titulo: 'Ticket de voz abierto',
          descripcion:
            `Referencia **${r.id}**\n` +
            `Control: <#${r.canal.id}>\n` +
            `Sala: <#${r.voz.id}>`,
          footer: MARCA.division,
          footerIcon: icon || undefined,
        })],
      });
      return;
    }

    const tipoFinal = TIPOS[tipo] ? tipo : 'soporte';
    const r = await crearTicketTexto(
      interaction.guild,
      interaction.member,
      tipoFinal,
      interaction.client
    );
    const meta = TIPOS[tipoFinal] || TIPOS.soporte;
    await interaction.editReply({
      embeds: [embedBase({
        color: meta.color || COLORES.institucional,
        author: { name: MARCA.nombre, iconURL: icon || undefined },
        titulo: `Ticket abierto · ${meta.label}`,
        descripcion: `Referencia **${r.id}** · <#${r.canal.id}>`,
        footer: MARCA.division,
        footerIcon: icon || undefined,
      })],
    });
  } catch (err) {
    await interaction.editReply({
      embeds: [embedBase({
        color: COLORES.denegado,
        author: { name: MARCA.nombre, iconURL: icon || undefined },
        titulo: 'No se pudo abrir el ticket',
        descripcion: String(err.message || err).slice(0, 400),
        footer: MARCA.division,
        footerIcon: icon || undefined,
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

  const icon = iconoInstitucional(interaction.client, interaction.guild);
  const row = new ActionRowBuilder().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`tickets:agregar:${ticketId}`)
      .setPlaceholder('Selecciona al miembro')
      .setMinValues(1)
      .setMaxValues(1),
  );

  await interaction.reply({
    embeds: [embedBase({
      color: COLORES.institucional,
      author: { name: MARCA.nombre, iconURL: icon || undefined },
      titulo: 'Incorporar personal al expediente',
      descripcion: `Ticket **${ticketId}**. Elige un miembro del servidor.`,
      footer: MARCA.division,
      footerIcon: icon || undefined,
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
  const icon = iconoInstitucional(interaction.client, interaction.guild);

  try {
    await agregarPersona(interaction.guild, ticketId, userId, interaction.user);
    await interaction.followUp({
      embeds: [embedBase({
        color: COLORES.medicina,
        author: { name: MARCA.nombre, iconURL: icon || undefined },
        titulo: 'Acceso concedido',
        descripcion: `<@${userId}> incorporado al ticket **${ticketId}**.`,
        footer: MARCA.division,
        footerIcon: icon || undefined,
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
  const icon = iconoInstitucional(interaction.client, interaction.guild);
  try {
    await transcribir(interaction.guild, ticketId, interaction.user, { cerrar });
    await interaction.editReply({
      embeds: [embedBase({
        color: COLORES.institucional,
        author: { name: MARCA.nombre, iconURL: icon || undefined },
        titulo: cerrar ? 'Expediente cerrado' : 'Transcripción archivada',
        descripcion: cerrar
          ? `**${ticketId}** cerrado. Copia en el canal de archivo.`
          : `Transcripción de **${ticketId}** enviada a logs.`,
        footer: MARCA.division,
        footerIcon: icon || undefined,
      })],
    });
  } catch (err) {
    await interaction.editReply({
      embeds: [embedBase({
        color: COLORES.denegado,
        author: { name: MARCA.nombre, iconURL: icon || undefined },
        titulo: 'Operación no completada',
        descripcion: String(err.message || err).slice(0, 400),
        footer: MARCA.division,
        footerIcon: icon || undefined,
      })],
    });
  }
}

module.exports = { prefix, handle };

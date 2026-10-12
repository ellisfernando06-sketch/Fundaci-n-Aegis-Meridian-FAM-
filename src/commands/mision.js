const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb } = require('../db');
const {
  PRIORIDADES_MISION,
  ESTADOS_MISION,
  embedMision,
  crearMision,
  actualizarMision,
} = require('../services/operaciones');
const { embedBase, COLORES } = require('../utils/plantillas');
const { truncar } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mision')
    .setDescription('Asignacion y seguimiento de misiones')
    .addSubcommand((s) =>
      s.setName('asignar')
        .setDescription('Asigna una nueva mision')
        .addStringOption((o) => o.setName('objetivo').setDescription('Objetivo de la mision').setRequired(true))
        .addStringOption((o) =>
          o.setName('prioridad').setDescription('Prioridad').setRequired(false)
            .addChoices(...PRIORIDADES_MISION.map((p) => ({ name: p, value: p })))
        )
        .addStringOption((o) => o.setName('unidad').setDescription('Unidad asignada').setRequired(false))
        .addUserOption((o) => o.setName('lider').setDescription('Lider de la mision').setRequired(false))
        .addStringOption((o) =>
          o.setName('anomalia').setDescription('Anomalia vinculada').setRequired(false).setAutocomplete(true)
        )
        .addStringOption((o) => o.setName('fecha_limite').setDescription('Fecha limite (texto)').setRequired(false))
    )
    .addSubcommand((s) =>
      s.setName('ver')
        .setDescription('Consulta una mision')
        .addStringOption((o) => o.setName('id').setDescription('ID MIS-xxxx').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((s) =>
      s.setName('listar')
        .setDescription('Lista misiones')
        .addStringOption((o) =>
          o.setName('estado').setDescription('Filtrar por estado').setRequired(false)
            .addChoices(...ESTADOS_MISION.map((e) => ({ name: e, value: e })))
        )
    )
    .addSubcommand((s) =>
      s.setName('actualizar')
        .setDescription('Actualiza el estado u otros datos de una mision')
        .addStringOption((o) => o.setName('id').setDescription('ID MIS-xxxx').setRequired(true).setAutocomplete(true))
        .addStringOption((o) =>
          o.setName('estado').setDescription('Nuevo estado').setRequired(false)
            .addChoices(...ESTADOS_MISION.map((e) => ({ name: e, value: e })))
        )
        .addStringOption((o) =>
          o.setName('prioridad').setDescription('Prioridad').setRequired(false)
            .addChoices(...PRIORIDADES_MISION.map((p) => ({ name: p, value: p })))
        )
        .addUserOption((o) => o.setName('lider').setDescription('Lider').setRequired(false))
        .addStringOption((o) => o.setName('objetivo').setDescription('Objetivo').setRequired(false))
        .addStringOption((o) => o.setName('unidad').setDescription('Unidad').setRequired(false))
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const q = String(focused.value || '').toLowerCase();
    if (focused.name === 'id') {
      const rows = getDb().prepare(
        'SELECT id, prioridad, estado FROM misiones ORDER BY creado_en DESC LIMIT 40'
      ).all();
      return interaction.respond(
        rows
          .filter((r) => !q || r.id.toLowerCase().includes(q))
          .slice(0, 25)
          .map((r) => ({ name: `${r.id} · ${r.prioridad} · ${r.estado}`.slice(0, 100), value: r.id }))
      );
    }
    if (focused.name === 'anomalia') {
      const rows = getDb().prepare(
        'SELECT id, nombre FROM anomalias ORDER BY creado_en DESC LIMIT 40'
      ).all();
      return interaction.respond(
        rows
          .filter((r) => !q || r.id.toLowerCase().includes(q) || r.nombre.toLowerCase().includes(q))
          .slice(0, 25)
          .map((r) => ({ name: `${r.id} · ${r.nombre}`.slice(0, 100), value: r.id }))
      );
    }
    return interaction.respond([]);
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'asignar') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
        await interaction.reply({
          content: 'No tienes autorizacion para asignar misiones.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const lider = interaction.options.getUser('lider');
        const m = crearMision({
          objetivo: interaction.options.getString('objetivo'),
          prioridad: interaction.options.getString('prioridad') || 'Normal',
          unidad: interaction.options.getString('unidad'),
          liderId: lider?.id,
          anomaliaId: interaction.options.getString('anomalia'),
          autorizadaPor: interaction.user.tag,
          fechaLimite: interaction.options.getString('fecha_limite'),
        });
        await interaction.editReply({ embeds: [embedMision(m)] });
      } catch (err) {
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'Mision no asignada',
            descripcion: String(err.message || err).slice(0, 500),
            footer: 'Misiones',
          })],
        });
      }
      return;
    }

    if (sub === 'ver') {
      const id = interaction.options.getString('id');
      const m = db.prepare('SELECT * FROM misiones WHERE id = ?').get(id);
      if (!m) {
        await interaction.reply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'No encontrada',
            descripcion: `No existe la mision \`${id}\`.`,
            footer: 'Misiones',
          })],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({ embeds: [embedMision(m)], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'listar') {
      const estado = interaction.options.getString('estado');
      const rows = estado
        ? db.prepare('SELECT * FROM misiones WHERE estado = ? ORDER BY creado_en DESC LIMIT 25').all(estado)
        : db.prepare('SELECT * FROM misiones ORDER BY creado_en DESC LIMIT 25').all();
      const desc = rows.length
        ? rows.map((r) =>
          `**${r.id}** · ${r.prioridad} · ${r.estado}${r.anomalia_id ? ` · ${r.anomalia_id}` : ''}`
        ).join('\n')
        : 'Sin misiones.';
      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.seguridad,
          titulo: 'Misiones',
          descripcion: truncar(desc, 4000),
          footer: 'Misiones',
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'actualizar') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
        await interaction.reply({
          content: 'No tienes autorizacion para actualizar misiones.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const lider = interaction.options.getUser('lider');
        const m = actualizarMision(
          interaction.options.getString('id'),
          {
            estado: interaction.options.getString('estado') || undefined,
            prioridad: interaction.options.getString('prioridad') || undefined,
            lider_id: lider ? lider.id : undefined,
            objetivo: interaction.options.getString('objetivo') || undefined,
            unidad: interaction.options.getString('unidad') || undefined,
          },
          interaction.user.id
        );
        await interaction.editReply({ embeds: [embedMision(m)] });
      } catch (err) {
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'Actualizacion no completada',
            descripcion: String(err.message || err).slice(0, 500),
            footer: 'Misiones',
          })],
        });
      }
    }
  },
};

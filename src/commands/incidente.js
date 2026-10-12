const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb } = require('../db');
const {
  GRAVEDADES,
  ESTADOS_INCIDENTE,
  embedIncidente,
  crearIncidente,
  actualizarIncidente,
} = require('../services/operaciones');
const { embedBase, COLORES } = require('../utils/plantillas');
const { truncar } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('incidente')
    .setDescription('Registro y gestion de incidentes')
    .addSubcommand((s) =>
      s.setName('reportar')
        .setDescription('Reporta un incidente')
        .addStringOption((o) =>
          o.setName('gravedad').setDescription('Gravedad').setRequired(true)
            .addChoices(...GRAVEDADES.map((g) => ({ name: g, value: g })))
        )
        .addStringOption((o) => o.setName('resumen').setDescription('Resumen del incidente').setRequired(true))
        .addStringOption((o) => o.setName('ubicacion').setDescription('Ubicacion').setRequired(false))
        .addStringOption((o) => o.setName('unidad').setDescription('Unidad interviniente').setRequired(false))
        .addStringOption((o) =>
          o.setName('anomalia').setDescription('ID de anomalia vinculada').setRequired(false).setAutocomplete(true)
        )
    )
    .addSubcommand((s) =>
      s.setName('ver')
        .setDescription('Consulta un incidente')
        .addStringOption((o) => o.setName('id').setDescription('ID INC-xxxx').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((s) =>
      s.setName('listar')
        .setDescription('Lista incidentes')
        .addStringOption((o) =>
          o.setName('estado').setDescription('Filtrar por estado').setRequired(false)
            .addChoices(...ESTADOS_INCIDENTE.map((e) => ({ name: e, value: e })))
        )
    )
    .addSubcommand((s) =>
      s.setName('actualizar')
        .setDescription('Actualiza estado o datos de un incidente')
        .addStringOption((o) => o.setName('id').setDescription('ID INC-xxxx').setRequired(true).setAutocomplete(true))
        .addStringOption((o) =>
          o.setName('estado').setDescription('Nuevo estado').setRequired(false)
            .addChoices(...ESTADOS_INCIDENTE.map((e) => ({ name: e, value: e })))
        )
        .addStringOption((o) =>
          o.setName('gravedad').setDescription('Gravedad').setRequired(false)
            .addChoices(...GRAVEDADES.map((g) => ({ name: g, value: g })))
        )
        .addStringOption((o) => o.setName('resumen').setDescription('Resumen').setRequired(false))
        .addStringOption((o) => o.setName('ubicacion').setDescription('Ubicacion').setRequired(false))
        .addStringOption((o) =>
          o.setName('anomalia').setDescription('Anomalia vinculada').setRequired(false).setAutocomplete(true)
        )
    )
    .addSubcommand((s) =>
      s.setName('cerrar')
        .setDescription('Cierra un incidente')
        .addStringOption((o) => o.setName('id').setDescription('ID INC-xxxx').setRequired(true).setAutocomplete(true))
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const q = String(focused.value || '').toLowerCase();
    if (focused.name === 'id') {
      const rows = getDb().prepare(
        'SELECT id, gravedad, estado FROM incidentes ORDER BY creado_en DESC LIMIT 40'
      ).all();
      return interaction.respond(
        rows
          .filter((r) => !q || r.id.toLowerCase().includes(q))
          .slice(0, 25)
          .map((r) => ({ name: `${r.id} · ${r.gravedad} · ${r.estado}`.slice(0, 100), value: r.id }))
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

    if (sub === 'reportar') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const i = crearIncidente({
          gravedad: interaction.options.getString('gravedad'),
          resumen: interaction.options.getString('resumen'),
          ubicacion: interaction.options.getString('ubicacion'),
          unidad: interaction.options.getString('unidad'),
          anomaliaId: interaction.options.getString('anomalia'),
          reportadoPor: interaction.user.id,
        });
        await interaction.editReply({ embeds: [embedIncidente(i)] });
      } catch (err) {
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'Reporte no registrado',
            descripcion: String(err.message || err).slice(0, 500),
            footer: 'Incidentes',
          })],
        });
      }
      return;
    }

    if (sub === 'ver') {
      const id = interaction.options.getString('id');
      const i = db.prepare('SELECT * FROM incidentes WHERE id = ?').get(id);
      if (!i) {
        await interaction.reply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'No encontrado',
            descripcion: `No existe el incidente \`${id}\`.`,
            footer: 'Incidentes',
          })],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({ embeds: [embedIncidente(i)], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'listar') {
      const estado = interaction.options.getString('estado');
      const rows = estado
        ? db.prepare('SELECT * FROM incidentes WHERE estado = ? ORDER BY creado_en DESC LIMIT 25').all(estado)
        : db.prepare('SELECT * FROM incidentes ORDER BY creado_en DESC LIMIT 25').all();
      const desc = rows.length
        ? rows.map((r) =>
          `**${r.id}** · ${r.gravedad} · ${r.estado}${r.anomalia_id ? ` · ${r.anomalia_id}` : ''}`
        ).join('\n')
        : 'Sin incidentes.';
      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.seguridad,
          titulo: 'Incidentes',
          descripcion: truncar(desc, 4000),
          footer: 'Incidentes',
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'actualizar' || sub === 'cerrar') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
        await interaction.reply({
          content: 'No tienes autorizacion para modificar incidentes.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const id = interaction.options.getString('id');
        let campos;
        if (sub === 'cerrar') {
          campos = {
            estado: 'Cerrado',
            cerrado_por: interaction.user.id,
            cerrado_en: new Date().toISOString(),
          };
        } else {
          campos = {
            estado: interaction.options.getString('estado') || undefined,
            gravedad: interaction.options.getString('gravedad') || undefined,
            resumen: interaction.options.getString('resumen') || undefined,
            ubicacion: interaction.options.getString('ubicacion') || undefined,
            anomalia_id: interaction.options.getString('anomalia') || undefined,
          };
        }
        const i = actualizarIncidente(id, campos, interaction.user.id);
        await interaction.editReply({ embeds: [embedIncidente(i)] });
      } catch (err) {
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'Operacion no completada',
            descripcion: String(err.message || err).slice(0, 500),
            footer: 'Incidentes',
          })],
        });
      }
    }
  },
};

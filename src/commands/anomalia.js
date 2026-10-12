const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb } = require('../db');
const {
  ESTADOS_ANOMALIA,
  clasesDisponibles,
  sitiosDisponibles,
  embedAnomalia,
  crearAnomalia,
  actualizarAnomalia,
} = require('../services/operaciones');
const { embedBase, COLORES } = require('../utils/plantillas');
const { truncar } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anomalia')
    .setDescription('Registro y gestion de anomalias (FAM)')
    .addSubcommand((s) =>
      s.setName('registrar')
        .setDescription('Registra una nueva anomalia')
        .addStringOption((o) => o.setName('nombre').setDescription('Designacion o nombre').setRequired(true))
        .addStringOption((o) =>
          o.setName('clase').setDescription('Clase de contencion').setRequired(true).setAutocomplete(true)
        )
        .addIntegerOption((o) =>
          o.setName('nivel_acceso').setDescription('Nivel de acceso requerido (0-5)').setRequired(true)
            .setMinValue(0).setMaxValue(5)
        )
        .addStringOption((o) => o.setName('sitio').setDescription('Sitio').setRequired(false).setAutocomplete(true))
        .addStringOption((o) => o.setName('protocolos').setDescription('Protocolos').setRequired(false))
        .addStringOption((o) => o.setName('descripcion').setDescription('Descripcion').setRequired(false))
        .addUserOption((o) => o.setName('investigador').setDescription('Investigador asignado').setRequired(false))
    )
    .addSubcommand((s) =>
      s.setName('ver')
        .setDescription('Consulta una anomalia por ID')
        .addStringOption((o) => o.setName('id').setDescription('ID FAM-xxxx').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((s) =>
      s.setName('listar')
        .setDescription('Lista anomalias registradas')
        .addStringOption((o) =>
          o.setName('estado').setDescription('Filtrar por estado').setRequired(false)
            .addChoices(...ESTADOS_ANOMALIA.map((e) => ({ name: e, value: e })))
        )
    )
    .addSubcommand((s) =>
      s.setName('actualizar')
        .setDescription('Actualiza estado u otros datos de una anomalia')
        .addStringOption((o) => o.setName('id').setDescription('ID FAM-xxxx').setRequired(true).setAutocomplete(true))
        .addStringOption((o) =>
          o.setName('estado').setDescription('Nuevo estado').setRequired(false)
            .addChoices(...ESTADOS_ANOMALIA.map((e) => ({ name: e, value: e })))
        )
        .addStringOption((o) => o.setName('protocolos').setDescription('Protocolos').setRequired(false))
        .addStringOption((o) => o.setName('descripcion').setDescription('Descripcion').setRequired(false))
        .addUserOption((o) => o.setName('investigador').setDescription('Investigador').setRequired(false))
        .addStringOption((o) => o.setName('sitio').setDescription('Sitio').setRequired(false).setAutocomplete(true))
    )
    .addSubcommand((s) =>
      s.setName('incidentes')
        .setDescription('Lista incidentes vinculados a una anomalia')
        .addStringOption((o) => o.setName('id').setDescription('ID FAM-xxxx').setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((s) =>
      s.setName('misiones')
        .setDescription('Lista misiones vinculadas a una anomalia')
        .addStringOption((o) => o.setName('id').setDescription('ID FAM-xxxx').setRequired(true).setAutocomplete(true))
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const q = String(focused.value || '').toLowerCase();

    if (focused.name === 'clase') {
      const clases = clasesDisponibles();
      return interaction.respond(
        clases
          .filter((c) => !q || c.nombre.toLowerCase().includes(q))
          .slice(0, 25)
          .map((c) => ({ name: c.nombre, value: c.nombre }))
      );
    }
    if (focused.name === 'sitio') {
      const sitios = sitiosDisponibles();
      return interaction.respond(
        sitios
          .filter((s) => !q || String(s).toLowerCase().includes(q))
          .slice(0, 25)
          .map((s) => ({ name: String(s).slice(0, 100), value: String(s).slice(0, 100) }))
      );
    }
    if (focused.name === 'id') {
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

    if (sub === 'registrar') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
        await interaction.reply({
          content: 'No tienes autorizacion para registrar anomalias.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const inv = interaction.options.getUser('investigador');
        const a = crearAnomalia({
          nombre: interaction.options.getString('nombre'),
          clase: interaction.options.getString('clase'),
          nivelAcceso: interaction.options.getInteger('nivel_acceso'),
          sitio: interaction.options.getString('sitio'),
          protocolos: interaction.options.getString('protocolos'),
          descripcion: interaction.options.getString('descripcion'),
          investigadorId: inv?.id,
          creadoPor: interaction.user.id,
        });
        await interaction.editReply({ embeds: [embedAnomalia(a)] });
      } catch (err) {
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'Registro no completado',
            descripcion: String(err.message || err).slice(0, 500),
            footer: 'Anomalias',
          })],
        });
      }
      return;
    }

    if (sub === 'ver') {
      const id = interaction.options.getString('id');
      const a = db.prepare('SELECT * FROM anomalias WHERE id = ?').get(id);
      if (!a) {
        await interaction.reply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'No encontrada',
            descripcion: `No existe la anomalia \`${id}\`.`,
            footer: 'Anomalias',
          })],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({ embeds: [embedAnomalia(a)], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === 'listar') {
      const estado = interaction.options.getString('estado');
      const rows = estado
        ? db.prepare('SELECT * FROM anomalias WHERE estado = ? ORDER BY creado_en DESC LIMIT 25').all(estado)
        : db.prepare('SELECT * FROM anomalias ORDER BY creado_en DESC LIMIT 25').all();
      const desc = rows.length
        ? rows.map((r) => `**${r.id}** · ${r.nombre} · ${r.clase} · ${r.estado}`).join('\n')
        : 'Sin registros.';
      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.investigacion,
          titulo: 'Anomalias registradas',
          descripcion: truncar(desc, 4000),
          footer: 'Anomalias',
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'actualizar') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
        await interaction.reply({
          content: 'No tienes autorizacion para actualizar anomalias.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const inv = interaction.options.getUser('investigador');
        const campos = {
          estado: interaction.options.getString('estado') || undefined,
          protocolos: interaction.options.getString('protocolos') || undefined,
          descripcion: interaction.options.getString('descripcion') || undefined,
          sitio: interaction.options.getString('sitio') || undefined,
          investigador_id: inv ? inv.id : undefined,
        };
        const a = actualizarAnomalia(interaction.options.getString('id'), campos, interaction.user.id);
        await interaction.editReply({ embeds: [embedAnomalia(a)] });
      } catch (err) {
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'Actualizacion no completada',
            descripcion: String(err.message || err).slice(0, 500),
            footer: 'Anomalias',
          })],
        });
      }
      return;
    }

    if (sub === 'incidentes' || sub === 'misiones') {
      const id = interaction.options.getString('id');
      const a = db.prepare('SELECT id, nombre FROM anomalias WHERE id = ?').get(id);
      if (!a) {
        await interaction.reply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'No encontrada',
            descripcion: `No existe la anomalia \`${id}\`.`,
            footer: 'Anomalias',
          })],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (sub === 'incidentes') {
        const rows = db.prepare(
          'SELECT id, gravedad, estado, creado_en FROM incidentes WHERE anomalia_id = ? ORDER BY creado_en DESC LIMIT 20'
        ).all(id);
        const desc = rows.length
          ? rows.map((r) => `**${r.id}** · ${r.gravedad} · ${r.estado} · ${r.creado_en}`).join('\n')
          : 'Sin incidentes vinculados.';
        await interaction.reply({
          embeds: [embedBase({
            color: COLORES.seguridad,
            titulo: `Incidentes · ${a.id}`,
            descripcion: truncar(desc, 4000),
            footer: 'Anomalias',
          })],
          flags: MessageFlags.Ephemeral,
        });
      } else {
        const rows = db.prepare(
          'SELECT id, prioridad, estado, creado_en FROM misiones WHERE anomalia_id = ? ORDER BY creado_en DESC LIMIT 20'
        ).all(id);
        const desc = rows.length
          ? rows.map((r) => `**${r.id}** · ${r.prioridad} · ${r.estado} · ${r.creado_en}`).join('\n')
          : 'Sin misiones vinculadas.';
        await interaction.reply({
          embeds: [embedBase({
            color: COLORES.seguridad,
            titulo: `Misiones · ${a.id}`,
            descripcion: truncar(desc, 4000),
            footer: 'Anomalias',
          })],
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};

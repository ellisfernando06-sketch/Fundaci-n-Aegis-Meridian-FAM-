const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb, nextId } = require('../db');
const auditoria = require('../services/auditoria');
const { actorTexto } = require('../services/solicitudes');
const { embedBase, COLORES, MARCA } = require('../utils/plantillas');
const { sanitizar, truncar } = require('../utils/helpers');

const TIPOS_DETENCION = [
  { name: 'Custodia temporal', value: 'Custodia temporal' },
  { name: 'Detencion preventiva', value: 'Detencion preventiva' },
  { name: 'Traslado a celda', value: 'Traslado a celda' },
  { name: 'Liberacion supervisada', value: 'Liberacion supervisada' },
];

function panelEmbed(client, guild) {
  return embedBase({
    color: COLORES.cupula,
    author: true,
    titulo: 'Seguridad Interna',
    descripcion:
      '**Division de Seguridad Interna · F.A.M.**\n' +
      'Registro operativo de detenciones, interrogatorios y seguimiento.\n\n' +
      'Usa los botones para registrar actividad. Solo personal de SI autorizado.',
    campos: [
      {
        name: 'Funciones',
        value:
          '· **Detencion** — registrar custodia o traslado\n' +
          '· **Interrogatorio** — acta breve de interrogatorio\n' +
          '· **Registros** — ultimos movimientos de la division',
        inline: false,
      },
      {
        name: 'Jerarquia SI',
        value:
          'Gerente SI → Jefe → Supervisor → Interrogatorio → Agente de Campo → Agente → Ingreso',
        inline: false,
      },
    ],
    footer: 'Seguridad Interna',
    client,
    guild,
  });
}

function botonesPanel() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('si:detencion_modal')
      .setLabel('Registrar detencion')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('si:interrogatorio_modal')
      .setLabel('Registrar interrogatorio')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('si:registros')
      .setLabel('Ver registros')
      .setStyle(ButtonStyle.Secondary),
  );
}

function asegurarTabla() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS si_registros (
      id TEXT PRIMARY KEY,
      tipo TEXT NOT NULL,
      sujeto_id TEXT NOT NULL,
      agente_id TEXT NOT NULL,
      detalle TEXT,
      ubicacion TEXT,
      estado TEXT DEFAULT 'Activo',
      creado_en TEXT DEFAULT (datetime('now'))
    )
  `);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('si')
    .setDescription('Seguridad Interna · panel y registros operativos')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((s) =>
      s.setName('panel')
        .setDescription('Publica el panel de Seguridad Interna en este canal')
    )
    .addSubcommand((s) =>
      s.setName('detencion')
        .setDescription('Registra una detencion o custodia')
        .addUserOption((o) =>
          o.setName('sujeto').setDescription('Persona detenida').setRequired(true)
        )
        .addStringOption((o) =>
          o.setName('tipo')
            .setDescription('Tipo de detencion')
            .setRequired(true)
            .addChoices(...TIPOS_DETENCION)
        )
        .addStringOption((o) =>
          o.setName('motivo').setDescription('Motivo').setRequired(true)
        )
        .addStringOption((o) =>
          o.setName('ubicacion').setDescription('Ubicacion / celda').setRequired(false)
        )
    )
    .addSubcommand((s) =>
      s.setName('interrogatorio')
        .setDescription('Registra un interrogatorio')
        .addUserOption((o) =>
          o.setName('sujeto').setDescription('Interrogado').setRequired(true)
        )
        .addStringOption((o) =>
          o.setName('resumen').setDescription('Resumen del interrogatorio').setRequired(true)
        )
        .addStringOption((o) =>
          o.setName('resultado')
            .setDescription('Resultado')
            .setRequired(false)
            .addChoices(
              { name: 'Colaborativo', value: 'Colaborativo' },
              { name: 'Hostil', value: 'Hostil' },
              { name: 'Sin informacion', value: 'Sin informacion' },
              { name: 'Pendiente', value: 'Pendiente' },
            )
        )
    )
    .addSubcommand((s) =>
      s.setName('listar')
        .setDescription('Lista los ultimos registros de SI')
    ),

  async execute(interaction) {
    asegurarTabla();
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'panel') {
      await interaction.reply({
        embeds: [panelEmbed(interaction.client, interaction.guild)],
        components: [botonesPanel()],
      });
      auditoria.registrar(interaction.user.id, 'SI.PANEL', {
        canal: interaction.channelId,
      });
      return;
    }

    if (sub === 'listar') {
      const rows = db
        .prepare('SELECT * FROM si_registros ORDER BY creado_en DESC LIMIT 20')
        .all();
      const desc = rows.length
        ? rows
            .map(
              (r) =>
                `**${r.id}** · ${r.tipo} · <@${r.sujeto_id}>\n` +
                `Agente <@${r.agente_id}> · ${r.estado}` +
                (r.ubicacion ? ` · ${sanitizar(r.ubicacion)}` : '') +
                (r.detalle ? `\n${truncar(sanitizar(r.detalle), 120)}` : '')
            )
            .join('\n\n')
        : 'Sin registros de Seguridad Interna.';

      await interaction.reply({
        embeds: [
          embedBase({
            color: COLORES.cupula,
            author: true,
            titulo: 'Registros · Seguridad Interna',
            descripcion: truncar(desc, 4000),
            footer: 'Seguridad Interna',
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'detencion') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const sujeto = interaction.options.getUser('sujeto');
      const tipo = interaction.options.getString('tipo');
      const motivo = sanitizar(interaction.options.getString('motivo'));
      const ubicacion = sanitizar(interaction.options.getString('ubicacion') || '');
      const id = nextId('SID');
      const agente = actorTexto(interaction.user);

      db.prepare(`
        INSERT INTO si_registros (id, tipo, sujeto_id, agente_id, detalle, ubicacion, estado)
        VALUES (?, ?, ?, ?, ?, ?, 'Activo')
      `).run(
        id,
        tipo,
        sujeto.id,
        interaction.user.id,
        motivo,
        ubicacion || null
      );

      auditoria.registrar(interaction.user.id, 'SI.DETENCION', {
        id,
        sujeto: sujeto.id,
        tipo,
      });

      await interaction.editReply({
        embeds: [
          embedBase({
            color: COLORES.sancion,
            author: true,
            titulo: `${id} · Detencion registrada`,
            campos: [
              { name: 'Sujeto', value: `<@${sujeto.id}>`, inline: true },
              { name: 'Tipo', value: tipo, inline: true },
              { name: 'Ubicacion', value: ubicacion || '—', inline: true },
              { name: 'Agente', value: agente, inline: false },
              { name: 'Motivo', value: truncar(motivo, 500), inline: false },
            ],
            footer: 'Seguridad Interna',
          }),
        ],
      });
      return;
    }

    if (sub === 'interrogatorio') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const sujeto = interaction.options.getUser('sujeto');
      const resumen = sanitizar(interaction.options.getString('resumen'));
      const resultado = interaction.options.getString('resultado') || 'Pendiente';
      const id = nextId('SII');
      const agente = actorTexto(interaction.user);

      db.prepare(`
        INSERT INTO si_registros (id, tipo, sujeto_id, agente_id, detalle, ubicacion, estado)
        VALUES (?, 'Interrogatorio', ?, ?, ?, ?, ?)
      `).run(
        id,
        sujeto.id,
        interaction.user.id,
        resumen,
        null,
        resultado
      );

      auditoria.registrar(interaction.user.id, 'SI.INTERROGATORIO', {
        id,
        sujeto: sujeto.id,
        resultado,
      });

      await interaction.editReply({
        embeds: [
          embedBase({
            color: COLORES.cupula,
            author: true,
            titulo: `${id} · Interrogatorio registrado`,
            campos: [
              { name: 'Sujeto', value: `<@${sujeto.id}>`, inline: true },
              { name: 'Resultado', value: resultado, inline: true },
              { name: 'Agente', value: agente, inline: true },
              { name: 'Resumen', value: truncar(resumen, 800), inline: false },
            ],
            footer: 'Seguridad Interna',
          }),
        ],
      });
    }
  },
};

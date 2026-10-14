const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  UserSelectMenuBuilder,
} = require('discord.js');
const { getDb, nextId } = require('../db');
const auditoria = require('../services/auditoria');
const { actorTexto } = require('../services/solicitudes');
const { embedBase, COLORES } = require('../utils/plantillas');
const { sanitizar, truncar } = require('../utils/helpers');
const { cargosMapeados, esAdminDiscord } = require('../services/acceso');

const prefix = 'si';

const CARGOS_SI = [
  'SI.GERENTE',
  'SI.JEFE',
  'SI.SUPERVISOR',
  'SI.INTERROGATORIO',
  'SI.AGENTE_CAMPO',
  'SI.AGENTE',
  'SI.INGRESO',
  'ST.FUNDADOR',
  'ST.CO_CALIDAD',
  'ST.CO_ESTRATEGIA',
  'DIR.GENERAL',
];

function puedeSI(interaction) {
  if (esAdminDiscord(interaction)) return true;
  const cargos = new Set(cargosMapeados(interaction.member));
  return CARGOS_SI.some((c) => cargos.has(c));
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

async function handle(interaction, accion, args) {
  if (!puedeSI(interaction)) {
    await interaction
      .reply({
        content: 'Solo personal de Seguridad Interna o direccion puede usar este panel.',
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
    return;
  }

  asegurarTabla();

  switch (accion) {
    case 'detencion_modal':
      return mostrarModalDetencion(interaction);
    case 'interrogatorio_modal':
      return mostrarModalInterrogatorio(interaction);
    case 'detencion_submit':
      return onDetencionSubmit(interaction);
    case 'interrogatorio_submit':
      return onInterrogatorioSubmit(interaction);
    case 'registros':
      return onRegistros(interaction);
    default:
      await interaction
        .reply({ content: 'Accion no reconocida.', flags: MessageFlags.Ephemeral })
        .catch(() => {});
  }
}

async function mostrarModalDetencion(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('si:detencion_submit')
    .setTitle('Registrar detencion');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('sujeto_id')
        .setLabel('ID Discord del sujeto')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Pegar ID numerico del usuario')
        .setMaxLength(25),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('tipo')
        .setLabel('Tipo (custodia / preventiva / celda)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(60),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('motivo')
        .setLabel('Motivo')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('ubicacion')
        .setLabel('Ubicacion / celda (opcional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(80),
    ),
  );

  await interaction.showModal(modal);
}

async function mostrarModalInterrogatorio(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('si:interrogatorio_submit')
    .setTitle('Registrar interrogatorio');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('sujeto_id')
        .setLabel('ID Discord del sujeto')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Pegar ID numerico del usuario')
        .setMaxLength(25),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('resumen')
        .setLabel('Resumen del interrogatorio')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(800),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('resultado')
        .setLabel('Resultado (colaborativo / hostil / ...)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(40),
    ),
  );

  await interaction.showModal(modal);
}

async function onDetencionSubmit(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const sujetoId = String(interaction.fields.getTextInputValue('sujeto_id') || '').replace(/\D/g, '');
  const tipo = sanitizar(interaction.fields.getTextInputValue('tipo'));
  const motivo = sanitizar(interaction.fields.getTextInputValue('motivo'));
  const ubicacion = sanitizar(interaction.fields.getTextInputValue('ubicacion') || '');

  if (!sujetoId) {
    await interaction.editReply({ content: 'ID de sujeto no valido.' });
    return;
  }

  const id = nextId('SID');
  getDb()
    .prepare(`
      INSERT INTO si_registros (id, tipo, sujeto_id, agente_id, detalle, ubicacion, estado)
      VALUES (?, ?, ?, ?, ?, ?, 'Activo')
    `)
    .run(id, tipo, sujetoId, interaction.user.id, motivo, ubicacion || null);

  auditoria.registrar(interaction.user.id, 'SI.DETENCION', { id, sujeto: sujetoId, tipo });

  await interaction.editReply({
    embeds: [
      embedBase({
        color: COLORES.sancion,
        author: true,
        titulo: `${id} · Detencion registrada`,
        campos: [
          { name: 'Sujeto', value: `<@${sujetoId}>`, inline: true },
          { name: 'Tipo', value: tipo, inline: true },
          { name: 'Ubicacion', value: ubicacion || '—', inline: true },
          { name: 'Agente', value: actorTexto(interaction.user), inline: false },
          { name: 'Motivo', value: truncar(motivo, 500), inline: false },
        ],
        footer: 'Seguridad Interna',
      }),
    ],
  });
}

async function onInterrogatorioSubmit(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const sujetoId = String(interaction.fields.getTextInputValue('sujeto_id') || '').replace(/\D/g, '');
  const resumen = sanitizar(interaction.fields.getTextInputValue('resumen'));
  const resultado = sanitizar(interaction.fields.getTextInputValue('resultado') || 'Pendiente');

  if (!sujetoId) {
    await interaction.editReply({ content: 'ID de sujeto no valido.' });
    return;
  }

  const id = nextId('SII');
  getDb()
    .prepare(`
      INSERT INTO si_registros (id, tipo, sujeto_id, agente_id, detalle, ubicacion, estado)
      VALUES (?, 'Interrogatorio', ?, ?, ?, NULL, ?)
    `)
    .run(id, sujetoId, interaction.user.id, resumen, resultado);

  auditoria.registrar(interaction.user.id, 'SI.INTERROGATORIO', {
    id,
    sujeto: sujetoId,
    resultado,
  });

  await interaction.editReply({
    embeds: [
      embedBase({
        color: COLORES.cupula,
        author: true,
        titulo: `${id} · Interrogatorio registrado`,
        campos: [
          { name: 'Sujeto', value: `<@${sujetoId}>`, inline: true },
          { name: 'Resultado', value: resultado, inline: true },
          { name: 'Agente', value: actorTexto(interaction.user), inline: true },
          { name: 'Resumen', value: truncar(resumen, 800), inline: false },
        ],
        footer: 'Seguridad Interna',
      }),
    ],
  });
}

async function onRegistros(interaction) {
  const rows = getDb()
    .prepare('SELECT * FROM si_registros ORDER BY creado_en DESC LIMIT 15')
    .all();

  const desc = rows.length
    ? rows
        .map(
          (r) =>
            `**${r.id}** · ${r.tipo} · <@${r.sujeto_id}>\n` +
            `Agente <@${r.agente_id}> · ${r.estado}` +
            (r.ubicacion ? ` · ${sanitizar(r.ubicacion)}` : '')
        )
        .join('\n\n')
    : 'Sin registros.';

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
}

module.exports = { prefix, handle };

const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  UserSelectMenuBuilder,
  StringSelectMenuBuilder,
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

const TIPOS_DETENCION = [
  { label: 'Custodia temporal', value: 'Custodia temporal' },
  { label: 'Detencion preventiva', value: 'Detencion preventiva' },
  { label: 'Traslado a celda', value: 'Traslado a celda' },
  { label: 'Liberacion supervisada', value: 'Liberacion supervisada' },
];

const RESULTADOS_INT = [
  { label: 'Colaborativo', value: 'Colaborativo' },
  { label: 'Hostil', value: 'Hostil' },
  { label: 'Sin informacion', value: 'Sin informacion' },
  { label: 'Pendiente', value: 'Pendiente' },
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
      return pedirSujeto(interaction, 'detencion');
    case 'interrogatorio_modal':
      return pedirSujeto(interaction, 'interrogatorio');
    case 'sujeto_detencion':
      return onSujetoDetencion(interaction);
    case 'sujeto_interrogatorio':
      return onSujetoInterrogatorio(interaction);
    case 'tipo_detencion':
      return onTipoDetencion(interaction, args[0]);
    case 'detencion_motivo':
      return onDetencionMotivo(interaction, args[0], args[1]);
    case 'resultado_int':
      return onResultadoInt(interaction, args[0]);
    case 'interrogatorio_resumen':
      return onInterrogatorioResumen(interaction, args[0], args[1]);
    case 'registros':
      return onRegistros(interaction);
    default:
      await interaction
        .reply({ content: 'Accion no reconocida.', flags: MessageFlags.Ephemeral })
        .catch(() => {});
  }
}

/** Paso 1: menu desplegable de usuarios */
async function pedirSujeto(interaction, flujo) {
  const select = new UserSelectMenuBuilder()
    .setCustomId(`si:sujeto_${flujo}`)
    .setPlaceholder('Selecciona al sujeto')
    .setMinValues(1)
    .setMaxValues(1);

  await interaction.reply({
    embeds: [
      embedBase({
        color: COLORES.cupula,
        author: true,
        titulo: flujo === 'detencion' ? 'Registrar detencion' : 'Registrar interrogatorio',
        descripcion: 'Selecciona al sujeto en el menu desplegable.',
        footer: 'Seguridad Interna',
      }),
    ],
    components: [new ActionRowBuilder().addComponents(select)],
    flags: MessageFlags.Ephemeral,
  });
}

/** Paso 2 detencion: tipo */
async function onSujetoDetencion(interaction) {
  const sujeto = interaction.users.first();
  if (!sujeto) {
    await interaction.update({ content: 'No se selecciono sujeto.', embeds: [], components: [] });
    return;
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(`si:tipo_detencion:${sujeto.id}`)
    .setPlaceholder('Tipo de detencion')
    .addOptions(TIPOS_DETENCION);

  await interaction.update({
    embeds: [
      embedBase({
        color: COLORES.sancion,
        author: true,
        titulo: 'Detencion · tipo',
        descripcion: `Sujeto: <@${sujeto.id}>\n\nSelecciona el tipo de detencion.`,
        footer: 'Seguridad Interna',
      }),
    ],
    components: [new ActionRowBuilder().addComponents(select)],
  });
}

/** Paso 3 detencion: modal motivo + ubicacion */
async function onTipoDetencion(interaction, sujetoId) {
  const tipo = interaction.values?.[0] || 'Detencion preventiva';
  const modal = new ModalBuilder()
    .setCustomId(`si:detencion_motivo:${sujetoId}:${encodeURIComponent(tipo)}`)
    .setTitle('Detalles de la detencion');

  modal.addComponents(
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

async function onDetencionMotivo(interaction, sujetoId, tipoEnc) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const tipo = decodeURIComponent(tipoEnc || 'Detencion preventiva');
  const motivo = sanitizar(interaction.fields.getTextInputValue('motivo'));
  const ubicacion = sanitizar(interaction.fields.getTextInputValue('ubicacion') || '');

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

/** Paso 2 interrogatorio: resultado */
async function onSujetoInterrogatorio(interaction) {
  const sujeto = interaction.users.first();
  if (!sujeto) {
    await interaction.update({ content: 'No se selecciono sujeto.', embeds: [], components: [] });
    return;
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(`si:resultado_int:${sujeto.id}`)
    .setPlaceholder('Resultado del interrogatorio')
    .addOptions(RESULTADOS_INT);

  await interaction.update({
    embeds: [
      embedBase({
        color: COLORES.cupula,
        author: true,
        titulo: 'Interrogatorio · resultado',
        descripcion: `Sujeto: <@${sujeto.id}>\n\nSelecciona el resultado preliminar.`,
        footer: 'Seguridad Interna',
      }),
    ],
    components: [new ActionRowBuilder().addComponents(select)],
  });
}

/** Paso 3 interrogatorio: modal resumen */
async function onResultadoInt(interaction, sujetoId) {
  const resultado = interaction.values?.[0] || 'Pendiente';
  const modal = new ModalBuilder()
    .setCustomId(`si:interrogatorio_resumen:${sujetoId}:${encodeURIComponent(resultado)}`)
    .setTitle('Resumen del interrogatorio');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('resumen')
        .setLabel('Resumen')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(800),
    ),
  );

  await interaction.showModal(modal);
}

async function onInterrogatorioResumen(interaction, sujetoId, resultadoEnc) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const resultado = decodeURIComponent(resultadoEnc || 'Pendiente');
  const resumen = sanitizar(interaction.fields.getTextInputValue('resumen'));

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

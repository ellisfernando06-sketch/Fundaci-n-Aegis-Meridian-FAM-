const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb, getConfig, nextId } = require('../db');
const { generarContrato } = require('../services/contrato');
const auditoria = require('../services/auditoria');
const { actorTexto } = require('../services/solicitudes');
const { cargosMapeados, esAdminDiscord } = require('../services/acceso');
const { embedBase, COLORES } = require('../utils/plantillas');
const { sanitizar } = require('../utils/helpers');

const CARGOS_EMISORES = ['ST.FUNDADOR', 'ST.CO_CALIDAD', 'ST.CO_ESTRATEGIA'];

function puedeEmitir(interaction) {
  if (esAdminDiscord(interaction)) return true;
  const cargos = new Set(cargosMapeados(interaction.member));
  return CARGOS_EMISORES.some((c) => cargos.has(c));
}

function asegurarTabla() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS contratos (
      id TEXT PRIMARY KEY,
      miembro_id TEXT NOT NULL,
      personaje TEXT NOT NULL,
      rango TEXT NOT NULL,
      fecha_ingreso TEXT,
      discord_tag TEXT,
      canal_id TEXT,
      msg_id TEXT,
      emitido_por TEXT,
      firma_fundacion_json TEXT,
      firma_miembro_json TEXT,
      estado TEXT DEFAULT 'Pendiente',
      creado_en TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS firmas_digitales (
      discord_id TEXT PRIMARY KEY,
      texto TEXT NOT NULL,
      cargo_etiqueta TEXT,
      creado_en TEXT DEFAULT (datetime('now')),
      actualizado_en TEXT DEFAULT (datetime('now'))
    );
  `);
}

function botonesFirma(contratoId, firmaFund, firmaMiembro) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`contrato:firmar_fundacion:${contratoId}`)
        .setLabel(firmaFund ? 'Fundacion firmada' : 'Firmar · Fundacion')
        .setStyle(firmaFund ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(!!firmaFund),
      new ButtonBuilder()
        .setCustomId(`contrato:firmar_miembro:${contratoId}`)
        .setLabel(firmaMiembro ? 'Miembro firmado' : 'Firmar · Miembro')
        .setStyle(firmaMiembro ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(!!firmaMiembro),
    ),
  ];
}

function embedContrato(row) {
  const ff = row.firma_fundacion_json ? JSON.parse(row.firma_fundacion_json) : null;
  const fm = row.firma_miembro_json ? JSON.parse(row.firma_miembro_json) : null;
  return embedBase({
    color: row.estado === 'Completo' ? COLORES.medicina : COLORES.oro,
    author: true,
    titulo: `Contrato de Ingreso · ${row.id}`,
    descripcion:
      'Documento Word adjunto (no se modifica).\n' +
      'Las firmas digitales se registran con los botones.\n' +
      'Si no tienes firma digital, el bot te pedira crearla al firmar.',
    campos: [
      { name: 'Miembro', value: `<@${row.miembro_id}>`, inline: true },
      { name: 'Personaje', value: row.personaje, inline: true },
      { name: 'Rango / Direccion', value: row.rango, inline: true },
      { name: 'Fecha ingreso', value: row.fecha_ingreso || '—', inline: true },
      { name: 'Estado', value: row.estado, inline: true },
      { name: 'Emitido por', value: row.emitido_por || '—', inline: true },
      {
        name: 'Firma digital · Fundacion',
        value: ff
          ? `✍️ **${ff.texto || ff.nombre}**\n${ff.cargo || ''}\n_${ff.fecha}_`
          : '_Pendiente · Fundador / Cofundador_',
        inline: true,
      },
      {
        name: 'Firma digital · Miembro',
        value: fm
          ? `✍️ **${fm.texto || fm.nombre}**\n_${fm.fecha}_`
          : `_Pendiente · <@${row.miembro_id}>_`,
        inline: true,
      },
    ],
    footer: 'Contratos',
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('contrato')
    .setDescription(
      'Emite Contrato de Ingreso · Solo Fundador y Cofundadores · Firmas digitales por boton'
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption((o) =>
      o.setName('miembro').setDescription('Miembro que firmara el contrato').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('personaje').setDescription('Nombre del personaje').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('rango').setDescription('Rango o direccion').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('fecha').setDescription('Fecha de ingreso').setRequired(false)
    )
    .addChannelOption((o) =>
      o.setName('canal').setDescription('Canal de publicacion (logs/fichas)').setRequired(false)
    ),

  async execute(interaction) {
    if (!puedeEmitir(interaction)) {
      await interaction.reply({
        embeds: [
          embedBase({
            color: COLORES.denegado,
            titulo: 'Acceso denegado',
            descripcion:
              'Solo el **Fundador** o los **Cofundadores** pueden emitir contratos de ingreso.',
            footer: 'Contratos',
          }),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    asegurarTabla();

    const user = interaction.options.getUser('miembro');
    const personaje = sanitizar(interaction.options.getString('personaje'));
    const rango = sanitizar(interaction.options.getString('rango'));
    const fecha =
      interaction.options.getString('fecha') ||
      new Date().toLocaleDateString('es-PA');
    const canalOpt = interaction.options.getChannel('canal');
    const id = nextId('CTR');
    const emisor = actorTexto(interaction.user);

    const buffer = await generarContrato({
      miembro: personaje,
      discord: user.tag || user.username,
      rango,
      fecha,
    });

    getDb()
      .prepare(`
        INSERT INTO contratos (
          id, miembro_id, personaje, rango, fecha_ingreso, discord_tag,
          emitido_por, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendiente')
      `)
      .run(
        id,
        user.id,
        personaje,
        rango,
        fecha,
        user.tag || user.username,
        emisor
      );

    const destId =
      canalOpt?.id ||
      getConfig('canal_fichas') ||
      getConfig('canal_logs') ||
      getConfig('canal_solicitudes');

    const row = getDb().prepare('SELECT * FROM contratos WHERE id = ?').get(id);
    const attachment = new AttachmentBuilder(buffer, {
      name: `Contrato_${id}_${personaje.replace(/\s+/g, '_')}.docx`,
    });

    if (destId) {
      const ch = await interaction.guild.channels.fetch(destId).catch(() => null);
      if (ch?.isTextBased()) {
        const msg = await ch.send({
          content: `Contrato **${id}** · <@${user.id}> · firmas pendientes`,
          embeds: [embedContrato(row)],
          components: botonesFirma(id, null, null),
          files: [attachment],
        });
        getDb()
          .prepare('UPDATE contratos SET canal_id = ?, msg_id = ? WHERE id = ?')
          .run(destId, msg.id, id);
      }
    }

    auditoria.registrar(interaction.user.id, 'CONTRATO.EMITIR', {
      id,
      miembro: user.id,
      personaje,
      rango,
    });

    await interaction.editReply({
      embeds: [
        embedBase({
          color: COLORES.oro,
          author: true,
          titulo: 'Contrato emitido',
          descripcion: destId
            ? `Publicado en <#${destId}>.\n\n` +
              '**Firmar · Fundacion:** Fundador o Cofundador\n' +
              `**Firmar · Miembro:** <@${user.id}>\n\n` +
              'Si alguien no tiene firma digital, al pulsar Firmar el bot le pedira crearla. El Word no se edita.'
            : 'Configura canal de fichas/logs o indica `canal`.',
          campos: [
            { name: 'ID', value: id, inline: true },
            { name: 'Miembro', value: `<@${user.id}>`, inline: true },
          ],
          footer: 'Contratos',
        }),
      ],
      files: destId ? undefined : [attachment],
    });
  },
};

module.exports.botonesFirma = botonesFirma;
module.exports.embedContrato = embedContrato;
module.exports.asegurarTabla = asegurarTabla;
module.exports.CARGOS_EMISORES = CARGOS_EMISORES;

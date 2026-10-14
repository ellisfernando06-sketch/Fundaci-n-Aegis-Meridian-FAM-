const { AttachmentBuilder, MessageFlags } = require('discord.js');
const { getDb } = require('../db');
const { generarContrato } = require('../services/contrato');
const auditoria = require('../services/auditoria');
const { cargosMapeados, esAdminDiscord } = require('../services/acceso');
const { embedBase, COLORES } = require('../utils/plantillas');

const prefix = 'contrato';

const CARGOS_FUNDACION = ['ST.FUNDADOR', 'ST.CO_CALIDAD', 'ST.CO_ESTRATEGIA'];

const CARGO_NOMBRE = {
  'ST.FUNDADOR': 'Fundador de F.A.M.',
  'ST.CO_CALIDAD': 'Cofundador de Calidad y Cumplimiento',
  'ST.CO_ESTRATEGIA': 'Cofundador de Estrategia y Estatuto',
};

function puedeFirmarFundacion(interaction) {
  if (esAdminDiscord(interaction)) return true;
  const cargos = new Set(cargosMapeados(interaction.member));
  return CARGOS_FUNDACION.some((c) => cargos.has(c));
}

function cargoFirmante(interaction) {
  const cargos = new Set(cargosMapeados(interaction.member));
  for (const k of CARGOS_FUNDACION) {
    if (cargos.has(k)) return CARGO_NOMBRE[k] || k;
  }
  if (esAdminDiscord(interaction)) return 'Administracion · F.A.M.';
  return 'Representante de F.A.M.';
}

function botonesFirma(contratoId, firmaFund, firmaMiembro) {
  const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
  } = require('discord.js');
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
      'Documento oficial. Cada parte firma con el boton de su lado.\n' +
      '**Izquierda:** Fundador o Cofundador · **Derecha:** el miembro contratado.',
    campos: [
      { name: 'Miembro', value: `<@${row.miembro_id}>`, inline: true },
      { name: 'Personaje', value: row.personaje, inline: true },
      { name: 'Rango / Direccion', value: row.rango, inline: true },
      { name: 'Fecha ingreso', value: row.fecha_ingreso || '—', inline: true },
      { name: 'Estado', value: row.estado, inline: true },
      { name: 'Emitido por', value: row.emitido_por || '—', inline: true },
      {
        name: 'Firma Fundacion',
        value: ff
          ? `**${ff.nombre}**\n${ff.cargo || ''}\n_${ff.fecha}_`
          : '_Pendiente · solo Fundador / Cofundador_',
        inline: true,
      },
      {
        name: 'Firma Miembro',
        value: fm
          ? `**${fm.nombre}**\n_${fm.fecha}_`
          : `_Pendiente · solo <@${row.miembro_id}>_`,
        inline: true,
      },
    ],
    footer: 'Contratos',
  });
}

async function regenerarYActualizar(interaction, row) {
  const ff = row.firma_fundacion_json ? JSON.parse(row.firma_fundacion_json) : null;
  const fm = row.firma_miembro_json ? JSON.parse(row.firma_miembro_json) : null;

  const buffer = await generarContrato({
    miembro: row.personaje,
    discord: row.discord_tag,
    rango: row.rango,
    fecha: row.fecha_ingreso,
    firmaFundacion: ff,
    firmaMiembro: fm,
  });

  const attachment = new AttachmentBuilder(buffer, {
    name: `Contrato_${row.id}_${String(row.personaje).replace(/\s+/g, '_')}.docx`,
  });

  const completo = !!(ff && fm);
  if (completo) {
    getDb().prepare("UPDATE contratos SET estado = 'Completo' WHERE id = ?").run(row.id);
    row.estado = 'Completo';
  }

  const payload = {
    content: completo
      ? `Contrato **${row.id}** · <@${row.miembro_id}> · **firmado por ambas partes**`
      : `Contrato **${row.id}** · <@${row.miembro_id}> · firmas pendientes`,
    embeds: [embedContrato(row)],
    components: botonesFirma(row.id, ff, fm),
    files: [attachment],
  };

  if (interaction.message) {
    await interaction.message.edit(payload).catch(async () => {
      await interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
    });
  }
}

async function handle(interaction, accion, args) {
  const contratoId = args[0];
  if (!contratoId) {
    await interaction.reply({ content: 'Contrato no encontrado.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

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
    )
  `);

  const row = getDb().prepare('SELECT * FROM contratos WHERE id = ?').get(contratoId);
  if (!row) {
    await interaction.reply({ content: 'El contrato no existe.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  if (accion === 'firmar_fundacion') {
    if (!puedeFirmarFundacion(interaction)) {
      await interaction.reply({
        content: 'Solo el **Fundador** o un **Cofundador** puede firmar por la Fundacion.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (row.firma_fundacion_json) {
      await interaction.reply({
        content: 'La Fundacion ya firmo este contrato.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();

    const firma = {
      nombre: interaction.user.globalName || interaction.user.username,
      cargo: cargoFirmante(interaction),
      discordId: interaction.user.id,
      fecha: new Date().toLocaleString('es-PA'),
    };
    getDb()
      .prepare('UPDATE contratos SET firma_fundacion_json = ? WHERE id = ?')
      .run(JSON.stringify(firma), contratoId);

    auditoria.registrar(interaction.user.id, 'CONTRATO.FIRMA_FUNDACION', { id: contratoId });

    const actualizado = getDb().prepare('SELECT * FROM contratos WHERE id = ?').get(contratoId);
    await regenerarYActualizar(interaction, actualizado);

    await interaction
      .followUp({
        embeds: [
          embedBase({
            color: COLORES.medicina,
            titulo: 'Firma de la Fundacion registrada',
            descripcion: `Tu firma quedo en el **lado izquierdo** del contrato **${contratoId}**.`,
            footer: 'Contratos',
          }),
        ],
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
    return;
  }

  if (accion === 'firmar_miembro') {
    if (interaction.user.id !== row.miembro_id && !esAdminDiscord(interaction)) {
      await interaction.reply({
        content: 'Solo el **miembro contratado** puede firmar en este lado.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (row.firma_miembro_json) {
      await interaction.reply({
        content: 'El miembro ya firmo este contrato.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();

    const firma = {
      nombre: interaction.user.globalName || interaction.user.username,
      cargo: `${row.personaje} · ${row.rango}`,
      discordId: interaction.user.id,
      fecha: new Date().toLocaleString('es-PA'),
    };
    getDb()
      .prepare('UPDATE contratos SET firma_miembro_json = ? WHERE id = ?')
      .run(JSON.stringify(firma), contratoId);

    auditoria.registrar(interaction.user.id, 'CONTRATO.FIRMA_MIEMBRO', { id: contratoId });

    const actualizado = getDb().prepare('SELECT * FROM contratos WHERE id = ?').get(contratoId);
    await regenerarYActualizar(interaction, actualizado);

    await interaction
      .followUp({
        embeds: [
          embedBase({
            color: COLORES.medicina,
            titulo: 'Firma del miembro registrada',
            descripcion: `Tu firma quedo en el **lado derecho** del contrato **${contratoId}**.`,
            footer: 'Contratos',
          }),
        ],
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
  }
}

module.exports = { prefix, handle };

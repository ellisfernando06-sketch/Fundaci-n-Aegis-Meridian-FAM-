const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require('discord.js');
const { getDb } = require('../db');
const auditoria = require('../services/auditoria');
const { cargosMapeados, esAdminDiscord } = require('../services/acceso');
const { embedBase, COLORES } = require('../utils/plantillas');
const { sanitizar } = require('../utils/helpers');

const prefix = 'contrato';

const CARGOS_FUNDACION = ['ST.FUNDADOR', 'ST.CO_CALIDAD', 'ST.CO_ESTRATEGIA'];

const CARGO_NOMBRE = {
  'ST.FUNDADOR': 'Fundador de F.A.M.',
  'ST.CO_CALIDAD': 'Cofundador de Calidad y Cumplimiento',
  'ST.CO_ESTRATEGIA': 'Cofundador de Estrategia y Estatuto',
};

function asegurarTablas() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS firmas_digitales (
      discord_id TEXT PRIMARY KEY,
      texto TEXT NOT NULL,
      cargo_etiqueta TEXT,
      creado_en TEXT DEFAULT (datetime('now')),
      actualizado_en TEXT DEFAULT (datetime('now'))
    );
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
  `);
}

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

function obtenerFirma(discordId) {
  return getDb().prepare('SELECT * FROM firmas_digitales WHERE discord_id = ?').get(discordId) || null;
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
      'Documento oficial adjunto (no se modifica).\n' +
      'Las firmas digitales se registran con los botones.\n' +
      '**Izquierda:** Fundador / Cofundador · **Derecha:** miembro contratado.',
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
          ? `✍️ **${ff.texto}**\n${ff.cargo || ''}\n_${ff.fecha}_ · <@${ff.discordId}>`
          : '_Pendiente_',
        inline: true,
      },
      {
        name: 'Firma digital · Miembro',
        value: fm
          ? `✍️ **${fm.texto}**\n${fm.cargo || ''}\n_${fm.fecha}_ · <@${fm.discordId}>`
          : `_Pendiente · <@${row.miembro_id}>_`,
        inline: true,
      },
    ],
    footer: 'Contratos',
  });
}

/** Modal para crear/actualizar firma digital del usuario */
async function pedirCrearFirma(interaction, retorno) {
  // retorno: fundacion:CTR-0001 | miembro:CTR-0001
  const modal = new ModalBuilder()
    .setCustomId(`contrato:guardar_firma:${retorno}`)
    .setTitle('Crear firma digital');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('texto')
        .setLabel('Tu firma (como quieres que aparezca)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(60)
        .setPlaceholder('Ej. F. Ellis · o tu nombre completo')
        .setValue(
          (interaction.user.globalName || interaction.user.username || '').slice(0, 60)
        ),
    ),
  );

  await interaction.showModal(modal);
}

async function actualizarMensajeContrato(interaction, row) {
  const ff = row.firma_fundacion_json ? JSON.parse(row.firma_fundacion_json) : null;
  const fm = row.firma_miembro_json ? JSON.parse(row.firma_miembro_json) : null;
  const completo = !!(ff && fm);
  if (completo && row.estado !== 'Completo') {
    getDb().prepare("UPDATE contratos SET estado = 'Completo' WHERE id = ?").run(row.id);
    row.estado = 'Completo';
  }

  const payload = {
    content: completo
      ? `Contrato **${row.id}** · <@${row.miembro_id}> · **firmado por ambas partes**`
      : `Contrato **${row.id}** · <@${row.miembro_id}> · firmas pendientes`,
    embeds: [embedContrato(row)],
    components: botonesFirma(row.id, ff, fm),
  };

  if (interaction.message) {
    await interaction.message.edit(payload).catch(() => {});
  }
}

async function aplicarFirma(interaction, row, lado) {
  const firmaDb = obtenerFirma(interaction.user.id);
  if (!firmaDb) {
    // Pedir crear firma y recordar a que lado volver
    await pedirCrearFirma(interaction, `${lado}:${row.id}`);
    return;
  }

  await interaction.deferUpdate();

  const fecha = new Date().toLocaleString('es-PA');
  const payloadFirma = {
    texto: firmaDb.texto,
    cargo:
      lado === 'fundacion'
        ? cargoFirmante(interaction)
        : `${row.personaje} · ${row.rango}`,
    discordId: interaction.user.id,
    fecha,
  };

  if (lado === 'fundacion') {
    getDb()
      .prepare('UPDATE contratos SET firma_fundacion_json = ? WHERE id = ?')
      .run(JSON.stringify(payloadFirma), row.id);
    auditoria.registrar(interaction.user.id, 'CONTRATO.FIRMA_FUNDACION', { id: row.id });
  } else {
    getDb()
      .prepare('UPDATE contratos SET firma_miembro_json = ? WHERE id = ?')
      .run(JSON.stringify(payloadFirma), row.id);
    auditoria.registrar(interaction.user.id, 'CONTRATO.FIRMA_MIEMBRO', { id: row.id });
  }

  const actualizado = getDb().prepare('SELECT * FROM contratos WHERE id = ?').get(row.id);
  await actualizarMensajeContrato(interaction, actualizado);

  await interaction
    .followUp({
      embeds: [
        embedBase({
          color: COLORES.medicina,
          titulo: 'Firma digital aplicada',
          descripcion:
            `Se registro tu firma **${firmaDb.texto}** en el lado de **${lado === 'fundacion' ? 'Fundacion' : 'Miembro'}** del contrato **${row.id}**.\n\nEl documento Word adjunto no se modifica; la firma queda registrada de forma oficial en el sistema.`,
          footer: 'Contratos',
        }),
      ],
      flags: MessageFlags.Ephemeral,
    })
    .catch(() => {});
}

async function handle(interaction, accion, args) {
  asegurarTablas();

  if (accion === 'guardar_firma') {
    // args[0] = fundacion:CTR-xxx | miembro:CTR-xxx | solo
    const retorno = args[0] || 'solo';
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const texto = sanitizar(interaction.fields.getTextInputValue('texto')).slice(0, 60);
    if (!texto) {
      await interaction.editReply({ content: 'La firma no puede estar vacia.' });
      return;
    }

    getDb()
      .prepare(`
        INSERT INTO firmas_digitales (discord_id, texto, actualizado_en)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(discord_id) DO UPDATE SET
          texto = excluded.texto,
          actualizado_en = datetime('now')
      `)
      .run(interaction.user.id, texto);

    auditoria.registrar(interaction.user.id, 'FIRMA.CREAR', { texto });

    // Si venia de un intento de firmar contrato, aplicar de inmediato
    const [lado, contratoId] = String(retorno).split(':');
    if ((lado === 'fundacion' || lado === 'miembro') && contratoId) {
      const row = getDb().prepare('SELECT * FROM contratos WHERE id = ?').get(contratoId);
      if (row) {
        if (lado === 'fundacion' && !puedeFirmarFundacion(interaction)) {
          await interaction.editReply({
            embeds: [
              embedBase({
                color: COLORES.medicina,
                titulo: 'Firma digital guardada',
                descripcion:
                  `Tu firma **${texto}** quedo registrada.\nNo tienes permiso para firmar por la Fundacion en este contrato.`,
                footer: 'Contratos',
              }),
            ],
          });
          return;
        }
        if (lado === 'miembro' && interaction.user.id !== row.miembro_id && !esAdminDiscord(interaction)) {
          await interaction.editReply({
            embeds: [
              embedBase({
                color: COLORES.medicina,
                titulo: 'Firma digital guardada',
                descripcion: `Tu firma **${texto}** quedo registrada.`,
                footer: 'Contratos',
              }),
            ],
          });
          return;
        }

        const fecha = new Date().toLocaleString('es-PA');
        const payloadFirma = {
          texto,
          cargo:
            lado === 'fundacion'
              ? cargoFirmante(interaction)
              : `${row.personaje} · ${row.rango}`,
          discordId: interaction.user.id,
          fecha,
        };
        const col =
          lado === 'fundacion' ? 'firma_fundacion_json' : 'firma_miembro_json';
        getDb()
          .prepare(`UPDATE contratos SET ${col} = ? WHERE id = ?`)
          .run(JSON.stringify(payloadFirma), contratoId);

        auditoria.registrar(
          interaction.user.id,
          lado === 'fundacion' ? 'CONTRATO.FIRMA_FUNDACION' : 'CONTRATO.FIRMA_MIEMBRO',
          { id: contratoId }
        );

        // Actualizar mensaje original del contrato si existe
        const actualizado = getDb().prepare('SELECT * FROM contratos WHERE id = ?').get(contratoId);
        if (row.canal_id && row.msg_id) {
          try {
            const ch = await interaction.guild.channels.fetch(row.canal_id).catch(() => null);
            const msg = ch ? await ch.messages.fetch(row.msg_id).catch(() => null) : null;
            if (msg) {
              const ff = actualizado.firma_fundacion_json
                ? JSON.parse(actualizado.firma_fundacion_json)
                : null;
              const fm = actualizado.firma_miembro_json
                ? JSON.parse(actualizado.firma_miembro_json)
                : null;
              const completo = !!(ff && fm);
              if (completo) {
                getDb()
                  .prepare("UPDATE contratos SET estado = 'Completo' WHERE id = ?")
                  .run(contratoId);
                actualizado.estado = 'Completo';
              }
              await msg.edit({
                content: completo
                  ? `Contrato **${contratoId}** · <@${row.miembro_id}> · **firmado por ambas partes**`
                  : `Contrato **${contratoId}** · <@${row.miembro_id}> · firmas pendientes`,
                embeds: [embedContrato(actualizado)],
                components: botonesFirma(contratoId, ff, fm),
              });
            }
          } catch (err) {
            console.error('[contrato msg]', err.message);
          }
        }

        await interaction.editReply({
          embeds: [
            embedBase({
              color: COLORES.medicina,
              titulo: 'Firma creada y aplicada',
              descripcion:
                `Firma **${texto}** guardada y aplicada al lado **${lado}** del contrato **${contratoId}**.\nEl documento Word no se modifica.`,
              footer: 'Contratos',
            }),
          ],
        });
        return;
      }
    }

    await interaction.editReply({
      embeds: [
        embedBase({
          color: COLORES.medicina,
          titulo: 'Firma digital guardada',
          descripcion:
            `Tu firma **${texto}** quedo registrada.\nLa proxima vez que pulses **Firmar** en un contrato, se usara automaticamente.`,
          footer: 'Contratos',
        }),
      ],
    });
    return;
  }

  const contratoId = args[0];
  if (!contratoId) {
    await interaction.reply({ content: 'Contrato no encontrado.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

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
    return aplicarFirma(interaction, row, 'fundacion');
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
    return aplicarFirma(interaction, row, 'miembro');
  }

  await interaction.reply({ content: 'Accion no reconocida.', flags: MessageFlags.Ephemeral }).catch(() => {});
}

module.exports = { prefix, handle };

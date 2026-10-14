const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  MessageFlags,
} = require('discord.js');
const { getDb } = require('../db');
const { generarContrato } = require('../services/contrato');
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

const pendientesImagen = new Map();

function asegurarTablas() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS firmas_digitales (
      discord_id TEXT PRIMARY KEY,
      texto TEXT,
      imagen_url TEXT,
      tipo_preferido TEXT DEFAULT 'texto',
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
  try { db.exec(`ALTER TABLE firmas_digitales ADD COLUMN imagen_url TEXT`); } catch (_) {}
  try { db.exec(`ALTER TABLE firmas_digitales ADD COLUMN tipo_preferido TEXT DEFAULT 'texto'`); } catch (_) {}
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

function botonesElegirFirma(retorno) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`contrato:firma_texto:${retorno}`)
        .setLabel('Firma de texto')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`contrato:firma_imagen:${retorno}`)
        .setLabel('Subir imagen de firma')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

/** Embed solo estado; las firmas van en el Word */
function embedContrato(row) {
  const ff = row.firma_fundacion_json ? JSON.parse(row.firma_fundacion_json) : null;
  const fm = row.firma_miembro_json ? JSON.parse(row.firma_miembro_json) : null;

  return embedBase({
    color: row.estado === 'Completo' ? COLORES.medicina : COLORES.oro,
    author: true,
    titulo: `Contrato de Ingreso · ${row.id}`,
    descripcion:
      'Las firmas se colocan **solo en el documento Word** adjunto.\n' +
      'Al firmar, el archivo se regenera con tu firma en el lado correspondiente.',
    campos: [
      { name: 'Miembro', value: `<@${row.miembro_id}>`, inline: true },
      { name: 'Personaje', value: row.personaje, inline: true },
      { name: 'Rango / Direccion', value: row.rango, inline: true },
      { name: 'Fecha ingreso', value: row.fecha_ingreso || '—', inline: true },
      { name: 'Estado', value: row.estado, inline: true },
      { name: 'Emitido por', value: row.emitido_por || '—', inline: true },
      {
        name: 'Lado Fundacion',
        value: ff ? `Firmado · <@${ff.discordId}> · _${ff.fecha}_` : '_Pendiente_',
        inline: true,
      },
      {
        name: 'Lado Miembro',
        value: fm ? `Firmado · <@${fm.discordId}> · _${fm.fecha}_` : `_Pendiente · <@${row.miembro_id}>_`,
        inline: true,
      },
    ],
    footer: 'Contratos',
  });
}

async function regenerarWord(row) {
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

  const nombre = `Contrato_${row.id}_${String(row.personaje).replace(/\s+/g, '_')}.docx`;
  return new AttachmentBuilder(buffer, { name: nombre });
}

async function actualizarMensajeContrato(interaction, row) {
  const ff = row.firma_fundacion_json ? JSON.parse(row.firma_fundacion_json) : null;
  const fm = row.firma_miembro_json ? JSON.parse(row.firma_miembro_json) : null;
  const completo = !!(ff && fm);
  if (completo && row.estado !== 'Completo') {
    getDb().prepare("UPDATE contratos SET estado = 'Completo' WHERE id = ?").run(row.id);
    row.estado = 'Completo';
  }

  let files = [];
  try {
    files = [await regenerarWord(row)];
  } catch (err) {
    console.error('[contrato regenerar]', err);
  }

  const payload = {
    content: completo
      ? `Contrato **${row.id}** · <@${row.miembro_id}> · **firmado por ambas partes** (ver Word adjunto)`
      : `Contrato **${row.id}** · <@${row.miembro_id}> · firmas pendientes`,
    embeds: [embedContrato(row)],
    components: botonesFirma(row.id, ff, fm),
    files,
  };

  if (interaction.message) {
    await interaction.message.edit(payload).catch(() => {});
  } else if (row.canal_id && row.msg_id && interaction.guild) {
    try {
      const ch = await interaction.guild.channels.fetch(row.canal_id).catch(() => null);
      const msg = ch ? await ch.messages.fetch(row.msg_id).catch(() => null) : null;
      if (msg) await msg.edit(payload);
    } catch (_) {}
  }
}

async function menuFirma(interaction, retorno) {
  const firma = obtenerFirma(interaction.user.id);
  const tieneTexto = !!(firma && firma.texto);
  const tieneImg = !!(firma && firma.imagen_url);

  if (!tieneTexto && !tieneImg) {
    await interaction.reply({
      embeds: [
        embedBase({
          color: COLORES.oro,
          titulo: 'No tienes firma digital',
          descripcion:
            'Elige como registrar tu firma (se colocara en el Word):\n' +
            '· **Firma de texto**\n· **Subir imagen** de tu firma digitalizada',
          footer: 'Contratos',
        }),
      ],
      components: botonesElegirFirma(retorno),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const rows = [
    new ActionRowBuilder().addComponents(
      ...(tieneTexto
        ? [
            new ButtonBuilder()
              .setCustomId(`contrato:usar_texto:${retorno}`)
              .setLabel('Usar firma de texto')
              .setStyle(ButtonStyle.Success),
          ]
        : []),
      ...(tieneImg
        ? [
            new ButtonBuilder()
              .setCustomId(`contrato:usar_imagen:${retorno}`)
              .setLabel('Usar firma por imagen')
              .setStyle(ButtonStyle.Success),
          ]
        : []),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`contrato:firma_texto:${retorno}`)
        .setLabel(tieneTexto ? 'Cambiar texto' : 'Crear firma de texto')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`contrato:firma_imagen:${retorno}`)
        .setLabel(tieneImg ? 'Cambiar imagen' : 'Subir imagen')
        .setStyle(ButtonStyle.Secondary),
    ),
  ];

  await interaction.reply({
    embeds: [
      embedBase({
        color: COLORES.oro,
        titulo: 'Tu firma digital',
        descripcion:
          (tieneTexto ? `Texto: **${firma.texto}**\n` : '') +
          (tieneImg ? `Imagen: [ver](${firma.imagen_url})\n` : '') +
          '\nSe insertara **solo en el Word** del contrato.',
        footer: 'Contratos',
        thumbnail: tieneImg ? firma.imagen_url : null,
      }),
    ],
    components: rows,
    flags: MessageFlags.Ephemeral,
  });
}

async function aplicarFirmaGuardada(interaction, row, lado, tipo) {
  const firmaDb = obtenerFirma(interaction.user.id);
  if (!firmaDb) {
    await menuFirma(interaction, `${lado}:${row.id}`);
    return;
  }

  const usarImagen = tipo === 'imagen';
  if (usarImagen && !firmaDb.imagen_url) {
    await interaction.reply({
      content: 'No tienes imagen de firma. Usa **Subir imagen**.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (!usarImagen && !firmaDb.texto) {
    await interaction.reply({
      content: 'No tienes firma de texto. Usa **Firma de texto**.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferUpdate().catch(() => {});
  }

  const fecha = new Date().toLocaleString('es-PA');
  const payloadFirma = {
    tipo: usarImagen ? 'imagen' : 'texto',
    texto: firmaDb.texto || null,
    imagenUrl: usarImagen ? firmaDb.imagen_url : null,
    cargo:
      lado === 'fundacion'
        ? cargoFirmante(interaction)
        : `${row.personaje} · ${row.rango}`,
    discordId: interaction.user.id,
    fecha,
  };

  const col = lado === 'fundacion' ? 'firma_fundacion_json' : 'firma_miembro_json';
  getDb()
    .prepare(`UPDATE contratos SET ${col} = ? WHERE id = ?`)
    .run(JSON.stringify(payloadFirma), row.id);

  getDb()
    .prepare(
      `UPDATE firmas_digitales SET tipo_preferido = ?, actualizado_en = datetime('now') WHERE discord_id = ?`
    )
    .run(usarImagen ? 'imagen' : 'texto', interaction.user.id);

  auditoria.registrar(
    interaction.user.id,
    lado === 'fundacion' ? 'CONTRATO.FIRMA_FUNDACION' : 'CONTRATO.FIRMA_MIEMBRO',
    { id: row.id, tipo: payloadFirma.tipo }
  );

  const actualizado = getDb().prepare('SELECT * FROM contratos WHERE id = ?').get(row.id);
  await actualizarMensajeContrato(interaction, actualizado);

  await interaction
    .followUp({
      embeds: [
        embedBase({
          color: COLORES.medicina,
          titulo: 'Firma colocada en el Word',
          descripcion:
            `Tu firma (**${payloadFirma.tipo}**) se inserto en el lado **${lado === 'fundacion' ? 'Fundacion (izquierda)' : 'Miembro (derecha)'}** del documento **${row.id}**.\nDescarga de nuevo el archivo adjunto al mensaje del contrato.`,
          footer: 'Contratos',
        }),
      ],
      flags: MessageFlags.Ephemeral,
    })
    .catch(() => {});
}

async function iniciarSubidaImagen(interaction, retorno) {
  pendientesImagen.set(interaction.user.id, {
    retorno,
    expira: Date.now() + 90_000,
    channelId: interaction.channelId,
  });

  await interaction.reply({
    embeds: [
      embedBase({
        color: COLORES.oro,
        titulo: 'Subir imagen de firma',
        descripcion:
          'Envia **en este canal** una imagen (PNG/JPG/WebP) de tu firma en los proximos **90 segundos**.\n' +
          'Se insertara en el Word al confirmar la firma.',
        footer: 'Contratos',
      }),
    ],
    flags: MessageFlags.Ephemeral,
  });

  const filter = (m) =>
    m.author.id === interaction.user.id &&
    m.attachments.size > 0 &&
    m.attachments.some(
      (a) =>
        (a.contentType || '').startsWith('image/') ||
        /\.(png|jpe?g|webp|gif)$/i.test(a.name || '')
    );

  const collector = interaction.channel.createMessageCollector({
    filter,
    max: 1,
    time: 90_000,
  });

  collector.on('collect', async (msg) => {
    const att =
      msg.attachments.find((a) => (a.contentType || '').startsWith('image/')) ||
      msg.attachments.first();
    if (!att) return;

    const url = att.url || att.proxyURL;
    getDb()
      .prepare(`
        INSERT INTO firmas_digitales (discord_id, imagen_url, tipo_preferido, actualizado_en)
        VALUES (?, ?, 'imagen', datetime('now'))
        ON CONFLICT(discord_id) DO UPDATE SET
          imagen_url = excluded.imagen_url,
          tipo_preferido = 'imagen',
          actualizado_en = datetime('now')
      `)
      .run(interaction.user.id, url);

    pendientesImagen.delete(interaction.user.id);
    auditoria.registrar(interaction.user.id, 'FIRMA.IMAGEN', {});
    await msg.react('✅').catch(() => {});

    const [lado, contratoId] = String(retorno).split(':');
    if ((lado === 'fundacion' || lado === 'miembro') && contratoId) {
      const row = getDb().prepare('SELECT * FROM contratos WHERE id = ?').get(contratoId);
      if (row) {
        if (lado === 'fundacion' && !puedeFirmarFundacion(interaction)) {
          await interaction.followUp({
            content: 'Imagen guardada. Sin permiso para firmar Fundacion.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        if (lado === 'miembro' && interaction.user.id !== row.miembro_id && !esAdminDiscord(interaction)) {
          await interaction.followUp({
            content: 'Imagen de firma guardada.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await aplicarFirmaGuardada(interaction, row, lado, 'imagen');
        return;
      }
    }

    await interaction.followUp({
      embeds: [
        embedBase({
          color: COLORES.medicina,
          titulo: 'Imagen de firma guardada',
          descripcion: 'Quedo registrada. Al firmar un contrato se insertara en el Word.',
          footer: 'Contratos',
          thumbnail: url,
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  });

  collector.on('end', async (collected) => {
    if (collected.size === 0) {
      pendientesImagen.delete(interaction.user.id);
      await interaction
        .followUp({
          content: 'Tiempo agotado. No se recibio imagen.',
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
    }
  });
}

async function pedirModalTexto(interaction, retorno) {
  const modal = new ModalBuilder()
    .setCustomId(`contrato:guardar_texto:${retorno}`)
    .setTitle('Firma de texto');

  const firma = obtenerFirma(interaction.user.id);
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('texto')
        .setLabel('Tu firma (como quieres que aparezca)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(60)
        .setPlaceholder('Ej. F. Ellis')
        .setValue(
          (firma?.texto || interaction.user.globalName || interaction.user.username || '').slice(0, 60)
        ),
    ),
  );

  await interaction.showModal(modal);
}

async function handle(interaction, accion, args) {
  asegurarTablas();
  const retorno = args[0] || 'gestionar';

  if (accion === 'guardar_texto') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const texto = sanitizar(interaction.fields.getTextInputValue('texto')).slice(0, 60);
    if (!texto) {
      await interaction.editReply({ content: 'La firma no puede estar vacia.' });
      return;
    }
    getDb()
      .prepare(`
        INSERT INTO firmas_digitales (discord_id, texto, tipo_preferido, actualizado_en)
        VALUES (?, ?, 'texto', datetime('now'))
        ON CONFLICT(discord_id) DO UPDATE SET
          texto = excluded.texto,
          tipo_preferido = 'texto',
          actualizado_en = datetime('now')
      `)
      .run(interaction.user.id, texto);

    auditoria.registrar(interaction.user.id, 'FIRMA.TEXTO', { texto });

    const [lado, contratoId] = String(retorno).split(':');
    if ((lado === 'fundacion' || lado === 'miembro') && contratoId) {
      const row = getDb().prepare('SELECT * FROM contratos WHERE id = ?').get(contratoId);
      if (row) {
        if (lado === 'fundacion' && !puedeFirmarFundacion(interaction)) {
          await interaction.editReply({ content: `Firma **${texto}** guardada. Sin permiso Fundacion.` });
          return;
        }
        if (lado === 'miembro' && interaction.user.id !== row.miembro_id && !esAdminDiscord(interaction)) {
          await interaction.editReply({ content: `Firma **${texto}** guardada.` });
          return;
        }
        const fecha = new Date().toLocaleString('es-PA');
        const payloadFirma = {
          tipo: 'texto',
          texto,
          imagenUrl: null,
          cargo: lado === 'fundacion' ? cargoFirmante(interaction) : `${row.personaje} · ${row.rango}`,
          discordId: interaction.user.id,
          fecha,
        };
        const col = lado === 'fundacion' ? 'firma_fundacion_json' : 'firma_miembro_json';
        getDb().prepare(`UPDATE contratos SET ${col} = ? WHERE id = ?`).run(JSON.stringify(payloadFirma), contratoId);
        auditoria.registrar(
          interaction.user.id,
          lado === 'fundacion' ? 'CONTRATO.FIRMA_FUNDACION' : 'CONTRATO.FIRMA_MIEMBRO',
          { id: contratoId, tipo: 'texto' }
        );
        const actualizado = getDb().prepare('SELECT * FROM contratos WHERE id = ?').get(contratoId);
        await actualizarMensajeContrato(interaction, actualizado);
        await interaction.editReply({
          embeds: [
            embedBase({
              color: COLORES.medicina,
              titulo: 'Firma colocada en el Word',
              descripcion: `**${texto}** insertada en el lado **${lado}** del documento **${contratoId}**. Descarga el Word adjunto actualizado.`,
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
          titulo: 'Firma de texto guardada',
          descripcion: `**${texto}** registrada. Se usara al firmar contratos (solo en el Word).`,
          footer: 'Contratos',
        }),
      ],
    });
    return;
  }

  if (accion === 'firma_texto') return pedirModalTexto(interaction, retorno);
  if (accion === 'firma_imagen') return iniciarSubidaImagen(interaction, retorno);

  if (accion === 'usar_texto' || accion === 'usar_imagen') {
    const [lado, contratoId] = String(retorno).split(':');
    if (!contratoId || (lado !== 'fundacion' && lado !== 'miembro')) {
      await interaction.reply({ content: 'Contexto invalido.', flags: MessageFlags.Ephemeral });
      return;
    }
    const row = getDb().prepare('SELECT * FROM contratos WHERE id = ?').get(contratoId);
    if (!row) {
      await interaction.reply({ content: 'Contrato no encontrado.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (lado === 'fundacion' && !puedeFirmarFundacion(interaction)) {
      await interaction.reply({ content: 'Sin permiso Fundacion.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (lado === 'miembro' && interaction.user.id !== row.miembro_id && !esAdminDiscord(interaction)) {
      await interaction.reply({ content: 'Solo el miembro contratado.', flags: MessageFlags.Ephemeral });
      return;
    }
    return aplicarFirmaGuardada(interaction, row, lado, accion === 'usar_imagen' ? 'imagen' : 'texto');
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
      await interaction.reply({ content: 'La Fundacion ya firmo este contrato.', flags: MessageFlags.Ephemeral });
      return;
    }
    return menuFirma(interaction, `fundacion:${contratoId}`);
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
      await interaction.reply({ content: 'El miembro ya firmo este contrato.', flags: MessageFlags.Ephemeral });
      return;
    }
    return menuFirma(interaction, `miembro:${contratoId}`);
  }

  await interaction.reply({ content: 'Accion no reconocida.', flags: MessageFlags.Ephemeral }).catch(() => {});
}

module.exports = { prefix, handle };

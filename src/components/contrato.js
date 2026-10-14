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
const rolesSvc = require('../services/roles');
const { getTodosCargos } = require('../data/organigrama');

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
      texto TEXT,
      imagen_url TEXT,
      imagen_b64 TEXT,
      imagen_tipo TEXT,
      tipo_preferido TEXT DEFAULT 'texto',
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
      roles_aplicados INTEGER DEFAULT 0,
      creado_en TEXT DEFAULT (datetime('now'))
    );
  `);
  try { db.exec('ALTER TABLE firmas_digitales ADD COLUMN imagen_url TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE firmas_digitales ADD COLUMN imagen_b64 TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE firmas_digitales ADD COLUMN imagen_tipo TEXT'); } catch (_) {}
  try { db.exec("ALTER TABLE firmas_digitales ADD COLUMN tipo_preferido TEXT DEFAULT 'texto'"); } catch (_) {}
  try { db.exec('ALTER TABLE contratos ADD COLUMN roles_aplicados INTEGER DEFAULT 0'); } catch (_) {}
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
  return esAdminDiscord(interaction) ? 'Administracion · F.A.M.' : 'Representante de F.A.M.';
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
      'Las firmas se colocan **solo en el documento Word**.\n' +
      'Al firmar ambas partes se asigna el rango del contrato.',
    campos: [
      { name: 'Miembro', value: `<@${row.miembro_id}>`, inline: true },
      { name: 'Personaje', value: row.personaje, inline: true },
      { name: 'Rango contratado', value: row.rango, inline: true },
      { name: 'Estado', value: row.estado, inline: true },
      { name: 'Roles aplicados', value: row.roles_aplicados ? 'Si' : 'No', inline: true },
      { name: 'Emitido por', value: row.emitido_por || '—', inline: true },
      { name: 'Lado Fundacion', value: ff ? `Firmado · <@${ff.discordId}>` : '_Pendiente_', inline: true },
      { name: 'Lado Miembro', value: fm ? `Firmado · <@${fm.discordId}>` : `_Pendiente · <@${row.miembro_id}>_`, inline: true },
    ],
    footer: 'Contratos',
  });
}

function normalizarTxt(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function resolverCargoPorRango(rangoTexto) {
  const n = normalizarTxt(rangoTexto);
  if (!n) return null;
  const todos = typeof getTodosCargos === 'function' ? getTodosCargos() : [];
  let best = null, bestScore = 0;
  for (const c of todos) {
    if (!c || c.separador) continue;
    const cn = normalizarTxt(c.nombre || c.nombreRol || '');
    if (!cn) continue;
    if (cn === n) return c;
    if (cn.includes(n) || n.includes(cn)) {
      const score = Math.min(cn.length, n.length);
      if (score > bestScore) { bestScore = score; best = c; }
    }
  }
  return best;
}

async function aplicarRolesAlCompletar(guild, row) {
  if (!guild || !row || row.roles_aplicados) return { ok: false };
  const cargo = resolverCargoPorRango(row.rango);
  if (!cargo?.key) {
    auditoria.registrar('system', 'CONTRATO.ROLES_FALLO', { id: row.id, rango: row.rango });
    return { ok: false, motivo: 'cargo_no_encontrado' };
  }
  const member = await guild.members.fetch(row.miembro_id).catch(() => null);
  if (!member) return { ok: false, motivo: 'miembro' };
  try {
    await rolesSvc.asignarCargo(guild, member, cargo.key, `Contrato ${row.id}`, `Contrato firmado · ${row.rango}`);
    getDb().prepare('UPDATE contratos SET roles_aplicados = 1 WHERE id = ?').run(row.id);
    auditoria.registrar(row.miembro_id, 'CONTRATO.ROLES_APLICADOS', { id: row.id, cargoKey: cargo.key });
    return { ok: true, cargo: cargo.nombre };
  } catch (err) {
    console.error('[contrato roles]', err.message);
    return { ok: false, motivo: err.message };
  }
}

async function regenerarWord(row) {
  const ff = row.firma_fundacion_json ? JSON.parse(row.firma_fundacion_json) : null;
  const fm = row.firma_miembro_json ? JSON.parse(row.firma_miembro_json) : null;
  const buffer = await generarContrato({
    miembro: row.personaje, discord: row.discord_tag, rango: row.rango, fecha: row.fecha_ingreso,
    firmaFundacion: ff, firmaMiembro: fm,
  });
  return new AttachmentBuilder(buffer, { name: `Contrato_${row.id}_${String(row.personaje).replace(/\s+/g, '_')}.docx` });
}

async function actualizarMensajeContrato(interaction, row) {
  const ff = row.firma_fundacion_json ? JSON.parse(row.firma_fundacion_json) : null;
  const fm = row.firma_miembro_json ? JSON.parse(row.firma_miembro_json) : null;
  const completo = !!(ff && fm);
  if (completo && row.estado !== 'Completo') {
    getDb().prepare("UPDATE contratos SET estado = 'Completo' WHERE id = ?").run(row.id);
    row.estado = 'Completo';
  }
  let rolesNota = '';
  if (completo && !row.roles_aplicados && interaction.guild) {
    const res = await aplicarRolesAlCompletar(interaction.guild, row);
    if (res.ok) { row.roles_aplicados = 1; rolesNota = ` · rol **${res.cargo}** aplicado`; }
    else if (res.motivo) rolesNota = ` · roles: ${res.motivo}`;
  }
  let files = [];
  try { files = [await regenerarWord(row)]; } catch (err) { console.error('[contrato regenerar]', err); }
  const payload = {
    content: completo
      ? `Contrato **${row.id}** · <@${row.miembro_id}> · **firmado por ambas partes**${rolesNota}`
      : `Contrato **${row.id}** · <@${row.miembro_id}> · firmas pendientes`,
    embeds: [embedContrato(row)],
    components: botonesFirma(row.id, ff, fm),
    files,
  };
  if (interaction.message) await interaction.message.edit(payload).catch(() => {});
  else if (row.canal_id && row.msg_id && interaction.guild) {
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
  const tieneImg = !!(firma && (firma.imagen_b64 || firma.imagen_url));
  if (!tieneTexto && !tieneImg) {
    await interaction.reply({
      embeds: [embedBase({
        color: COLORES.oro,
        titulo: 'No tienes firma digital',
        descripcion:
          '· **Firma de texto** (boton abajo)\n' +
          '· **Imagen**: usa `/firma imagen` y adjunta el archivo **en el comando**',
        footer: 'Contratos',
      })],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`contrato:firma_texto:${retorno}`).setLabel('Firma de texto').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`contrato:firma_imagen:${retorno}`).setLabel('Como subir imagen').setStyle(ButtonStyle.Secondary),
      )],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const row1 = new ActionRowBuilder();
  if (tieneTexto) row1.addComponents(new ButtonBuilder().setCustomId(`contrato:usar_texto:${retorno}`).setLabel('Usar firma de texto').setStyle(ButtonStyle.Success));
  if (tieneImg) row1.addComponents(new ButtonBuilder().setCustomId(`contrato:usar_imagen:${retorno}`).setLabel('Usar firma por imagen').setStyle(ButtonStyle.Success));
  await interaction.reply({
    embeds: [embedBase({
      color: COLORES.oro,
      titulo: 'Tu firma digital',
      descripcion: (tieneTexto ? `Texto: **${firma.texto}**\n` : '') + (tieneImg ? 'Imagen lista\n' : '') + 'Se insertara solo en el Word.',
      footer: 'Contratos',
      thumbnail: firma.imagen_url || null,
    })],
    components: [
      row1,
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`contrato:firma_texto:${retorno}`).setLabel('Cambiar texto').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`contrato:firma_imagen:${retorno}`).setLabel('Como cambiar imagen').setStyle(ButtonStyle.Secondary),
      ),
    ],
    flags: MessageFlags.Ephemeral,
  });
}

async function aplicarFirmaGuardada(interaction, row, lado, tipo) {
  const firmaDb = obtenerFirma(interaction.user.id);
  if (!firmaDb) return menuFirma(interaction, `${lado}:${row.id}`);
  const usarImagen = tipo === 'imagen';
  if (usarImagen && !firmaDb.imagen_b64 && !firmaDb.imagen_url) {
    await interaction.reply({ content: 'No tienes imagen. Usa `/firma imagen` y adjunta el archivo.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (!usarImagen && !firmaDb.texto) {
    await interaction.reply({ content: 'No tienes firma de texto.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => {});
  const fecha = new Date().toLocaleString('es-PA');
  const payloadFirma = {
    tipo: usarImagen ? 'imagen' : 'texto',
    texto: firmaDb.texto || null,
    imagenUrl: usarImagen ? firmaDb.imagen_url : null,
    imagenB64: usarImagen ? (firmaDb.imagen_b64 || null) : null,
    imagenTipo: usarImagen ? (firmaDb.imagen_tipo || 'png') : null,
    cargo: lado === 'fundacion' ? cargoFirmante(interaction) : `${row.personaje} · ${row.rango}`,
    discordId: interaction.user.id,
    fecha,
  };
  const col = lado === 'fundacion' ? 'firma_fundacion_json' : 'firma_miembro_json';
  getDb().prepare(`UPDATE contratos SET ${col} = ? WHERE id = ?`).run(JSON.stringify(payloadFirma), row.id);
  auditoria.registrar(interaction.user.id, lado === 'fundacion' ? 'CONTRATO.FIRMA_FUNDACION' : 'CONTRATO.FIRMA_MIEMBRO', { id: row.id, tipo: payloadFirma.tipo });
  const actualizado = getDb().prepare('SELECT * FROM contratos WHERE id = ?').get(row.id);
  await actualizarMensajeContrato(interaction, actualizado);
  await interaction.followUp({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Firma colocada en el Word',
      descripcion: `Firma (**${payloadFirma.tipo}**) en lado **${lado}** del contrato **${row.id}**. Descarga el Word adjunto.`,
      footer: 'Contratos',
    })],
    flags: MessageFlags.Ephemeral,
  }).catch(() => {});
}

async function iniciarSubidaImagen(interaction) {
  await interaction.reply({
    embeds: [embedBase({
      color: COLORES.oro,
      titulo: 'Firma por imagen',
      descripcion:
        'Adjunta el archivo **dentro del comando**:\n\n' +
        '`/firma imagen` → opción **archivo** (PNG o JPG)\n\n' +
        'Cuando quede guardada, vuelve a pulsar **Firmar** y elige **Usar firma por imagen**.\n' +
        'La firma se inserta solo en el Word.',
      footer: 'Firmas · /firma',
    })],
    flags: MessageFlags.Ephemeral,
  });
}

async function pedirModalTexto(interaction, retorno) {
  const firma = obtenerFirma(interaction.user.id);
  const modal = new ModalBuilder().setCustomId(`contrato:guardar_texto:${retorno}`).setTitle('Firma de texto');
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('texto')
      .setLabel('Tu firma')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(60)
      .setValue((firma?.texto || interaction.user.globalName || interaction.user.username || '').slice(0, 60)),
  ));
  await interaction.showModal(modal);
}

async function handle(interaction, accion, args) {
  asegurarTablas();
  const retorno = args[0] || 'gestionar';

  if (accion === 'guardar_texto') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const texto = sanitizar(interaction.fields.getTextInputValue('texto')).slice(0, 60);
    if (!texto) { await interaction.editReply({ content: 'Firma vacia.' }); return; }
    getDb().prepare(`
      INSERT INTO firmas_digitales (discord_id, texto, tipo_preferido, actualizado_en)
      VALUES (?, ?, 'texto', datetime('now'))
      ON CONFLICT(discord_id) DO UPDATE SET texto = excluded.texto, tipo_preferido = 'texto', actualizado_en = datetime('now')
    `).run(interaction.user.id, texto);
    const [lado, contratoId] = String(retorno).split(':');
    if ((lado === 'fundacion' || lado === 'miembro') && contratoId) {
      const row = getDb().prepare('SELECT * FROM contratos WHERE id = ?').get(contratoId);
      if (row) {
        if (lado === 'fundacion' && !puedeFirmarFundacion(interaction)) {
          await interaction.editReply({ content: 'Firma guardada. Sin permiso Fundacion.' }); return;
        }
        if (lado === 'miembro' && interaction.user.id !== row.miembro_id && !esAdminDiscord(interaction)) {
          await interaction.editReply({ content: 'Firma guardada.' }); return;
        }
        const payloadFirma = {
          tipo: 'texto', texto, imagenUrl: null, imagenB64: null,
          cargo: lado === 'fundacion' ? cargoFirmante(interaction) : `${row.personaje} · ${row.rango}`,
          discordId: interaction.user.id, fecha: new Date().toLocaleString('es-PA'),
        };
        const col = lado === 'fundacion' ? 'firma_fundacion_json' : 'firma_miembro_json';
        getDb().prepare(`UPDATE contratos SET ${col} = ? WHERE id = ?`).run(JSON.stringify(payloadFirma), contratoId);
        const actualizado = getDb().prepare('SELECT * FROM contratos WHERE id = ?').get(contratoId);
        await actualizarMensajeContrato(interaction, actualizado);
        await interaction.editReply({ embeds: [embedBase({ color: COLORES.medicina, titulo: 'Firma en el Word', descripcion: `**${texto}** en lado **${lado}** · **${contratoId}**.`, footer: 'Contratos' })] });
        return;
      }
    }
    await interaction.editReply({ embeds: [embedBase({ color: COLORES.medicina, titulo: 'Firma guardada', descripcion: `**${texto}** registrada.`, footer: 'Contratos' })] });
    return;
  }

  if (accion === 'firma_texto') return pedirModalTexto(interaction, retorno);
  if (accion === 'firma_imagen') return iniciarSubidaImagen(interaction);

  if (accion === 'usar_texto' || accion === 'usar_imagen') {
    const [lado, contratoId] = String(retorno).split(':');
    const row = getDb().prepare('SELECT * FROM contratos WHERE id = ?').get(contratoId);
    if (!row) { await interaction.reply({ content: 'Contrato no encontrado.', flags: MessageFlags.Ephemeral }); return; }
    if (lado === 'fundacion' && !puedeFirmarFundacion(interaction)) {
      await interaction.reply({ content: 'Sin permiso Fundacion.', flags: MessageFlags.Ephemeral }); return;
    }
    if (lado === 'miembro' && interaction.user.id !== row.miembro_id && !esAdminDiscord(interaction)) {
      await interaction.reply({ content: 'Solo el miembro contratado.', flags: MessageFlags.Ephemeral }); return;
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
      await interaction.reply({ content: 'Solo Fundador o Cofundador.', flags: MessageFlags.Ephemeral }); return;
    }
    if (row.firma_fundacion_json) {
      await interaction.reply({ content: 'Ya firmado por Fundacion.', flags: MessageFlags.Ephemeral }); return;
    }
    return menuFirma(interaction, `fundacion:${contratoId}`);
  }

  if (accion === 'firmar_miembro') {
    if (interaction.user.id !== row.miembro_id && !esAdminDiscord(interaction)) {
      await interaction.reply({ content: 'Solo el miembro contratado.', flags: MessageFlags.Ephemeral }); return;
    }
    if (row.firma_miembro_json) {
      await interaction.reply({ content: 'Ya firmado por el miembro.', flags: MessageFlags.Ephemeral }); return;
    }
    return menuFirma(interaction, `miembro:${contratoId}`);
  }

  await interaction.reply({ content: 'Accion no reconocida.', flags: MessageFlags.Ephemeral }).catch(() => {});
}

module.exports = { prefix, handle };

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require('discord.js');
const { getDb } = require('../db');
const roblox = require('../services/roblox');
const auditoria = require('../services/auditoria');
const { embedBase, COLORES } = require('../utils/plantillas');
const { ORGANIGRAMA } = require('../data/organigrama');
const { sanitizar } = require('../utils/helpers');

const prefix = 'perfil';

const AREAS = Object.entries(ORGANIGRAMA)
  .filter(([k]) => k !== 'insurgencia')
  .map(([key, rama]) => ({
    label: String(rama.nombre).slice(0, 100),
    value: key,
    description: `Area · ${rama.nombre}`.slice(0, 100),
  }));

async function handle(interaction, accion, args) {
  switch (accion) {
    case 'menu':
      return onMenu(interaction, args);
    case 'crear_modal':
      return mostrarModalCrear(interaction);
    case 'crear_submit':
      return onCrearSubmit(interaction);
    case 'area':
      return onAreaSeleccionada(interaction, args);
    case 'verificar':
      return onVerificar(interaction, args);
    case 'cancelar':
      return onCancelar(interaction, args);
    case 'confirmar_si':
      return require('../services/verificacion_confirm').onConfirmarSi(interaction, args);
    case 'confirmar_no':
      return onConfirmarNo(interaction, args);
    case 'ver':
      return onVer(interaction);
    default:
      await interaction.reply({
        content: 'Accion no disponible en esta version del menu.',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
  }
}

async function onMenu(interaction, args) {
  const opcion = interaction.values[0];
  const ownerId = args[0];
  if (ownerId !== interaction.user.id) {
    await interaction.update({ content: 'Solo quien abrio el menu puede usarlo.', embeds: [], components: [] }).catch(() => {});
    return;
  }
  if (opcion === 'crear') return mostrarModalCrear(interaction);
  if (opcion === 'ver') return onVer(interaction);
  await interaction.update({
    embeds: [embedBase({ color: COLORES.neutral, titulo: 'Opcion', descripcion: 'Usa /perfil de nuevo para las demas opciones.', footer: 'Personal' })],
    components: [],
  }).catch(() => {});
}

async function mostrarModalCrear(interaction) {
  const db = getDb();
  const existente = db.prepare('SELECT verificado FROM perfiles WHERE discord_id = ?').get(interaction.user.id);
  if (existente?.verificado) {
    await interaction.update({
      embeds: [embedBase({ color: COLORES.medicina, titulo: 'Ficha de personal', descripcion: 'Ya tienes ficha verificada.', footer: 'Personal' })],
      components: [],
    }).catch(() => {});
    return;
  }
  const modal = new ModalBuilder().setCustomId(`perfil:crear_submit:${interaction.user.id}`).setTitle('Crear ficha');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('personaje').setLabel('Nombre del personaje').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('roblox').setLabel('Usuario de Roblox').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(40),
    ),
  );
  await interaction.showModal(modal);
}

async function onCrearSubmit(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const personaje = sanitizar(interaction.fields.getTextInputValue('personaje'));
  const usuario = sanitizar(interaction.fields.getTextInputValue('roblox')).replace(/^@/, '');
  let userInfo;
  try {
    userInfo = await roblox.buscarUsuario(usuario);
  } catch (err) {
    await interaction.editReply({
      embeds: [embedBase({ color: COLORES.denegado, titulo: 'Roblox', descripcion: String(err.message || err).slice(0, 400), footer: 'Verificacion' })],
    });
    return;
  }
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`perfil:area:${interaction.user.id}:${userInfo.id}:${encodeURIComponent(personaje)}`)
      .setPlaceholder('Area solicitada')
      .addOptions(AREAS.slice(0, 25)),
  );
  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.cupula,
      titulo: 'Selecciona el area',
      descripcion: `Roblox **@${userInfo.name || usuario}** encontrado. Elige el area a la que solicitas ingreso.`,
      footer: 'Verificacion',
    })],
    components: [row],
  });
}

async function onAreaSeleccionada(interaction, args) {
  const [ownerId, robloxId, personajeEnc] = args;
  if (ownerId !== interaction.user.id) {
    await interaction.reply({ content: 'Solo el titular.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }
  const area = interaction.values[0];
  const personaje = decodeURIComponent(personajeEnc || '—');
  const codigo = Math.random().toString(36).slice(2, 8).toUpperCase();
  const vence = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const db = getDb();
  let robloxUsuario = null;
  try {
    const info = await roblox.obtenerUsuario(robloxId);
    robloxUsuario = info?.name || null;
  } catch (_) {}
  db.prepare(`
    INSERT INTO verificaciones (discord_id, roblox_id, roblox_usuario, codigo, area_solicitada, personaje, vence_en)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(ownerId, String(robloxId), robloxUsuario, codigo, area, personaje, vence);

  const btnVerificar = new ButtonBuilder().setCustomId(`perfil:verificar:${ownerId}:${robloxId}:${codigo}`).setLabel('Verificar ahora').setStyle(ButtonStyle.Success);
  const btnCancelar = new ButtonBuilder().setCustomId(`perfil:cancelar:${ownerId}:${codigo}`).setLabel('Cancelar').setStyle(ButtonStyle.Secondary);

  await interaction.update({
    embeds: [embedBase({
      color: COLORES.cupula,
      titulo: 'Verifica tu cuenta de Roblox',
      campos: [
        { name: 'Codigo', value: '`' + codigo + '`', inline: true },
        { name: 'Area solicitada', value: ORGANIGRAMA[area]?.nombre || area, inline: true },
        { name: 'Vence en', value: '10 minutos', inline: true },
      ],
      descripcion: 'Coloca el codigo en la **descripcion** de tu perfil de Roblox y pulsa **Verificar ahora**.',
      footer: 'Verificacion',
    })],
    components: [new ActionRowBuilder().addComponents(btnVerificar, btnCancelar)],
  });
}

async function onVerificar(interaction, args) {
  const [ownerId, robloxId, codigo] = args;
  if (ownerId !== interaction.user.id) {
    await interaction.reply({ content: 'Solo el titular.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }
  await interaction.deferUpdate();
  const db = getDb();
  const verif = db.prepare(
    'SELECT * FROM verificaciones WHERE discord_id = ? AND codigo = ? AND usado = 0 ORDER BY id DESC LIMIT 1'
  ).get(ownerId, codigo);
  if (!verif) {
    await interaction.editReply({
      embeds: [embedBase({ color: COLORES.denegado, titulo: 'Codigo invalido', descripcion: 'No encontrado o ya usado.', footer: 'Verificacion' })],
      components: [],
    });
    return;
  }
  if (new Date(verif.vence_en) < new Date()) {
    await interaction.editReply({
      embeds: [embedBase({ color: COLORES.denegado, titulo: 'Codigo vencido', descripcion: 'Genera uno nuevo.', footer: 'Verificacion' })],
      components: [],
    });
    return;
  }
  let ok = false;
  try {
    ok = await roblox.verificarCodigoEnDescripcion(robloxId, codigo);
  } catch (err) {
    await interaction.editReply({
      embeds: [embedBase({ color: COLORES.denegado, titulo: 'Error Roblox', descripcion: String(err.message || err).slice(0, 400), footer: 'Verificacion' })],
      components: [],
    });
    return;
  }
  if (!ok) {
    await interaction.editReply({
      embeds: [embedBase({
        color: COLORES.denegado,
        titulo: 'Codigo no encontrado',
        descripcion: 'Aun no aparece en tu descripcion de Roblox. Colocalo y reintenta.',
        footer: 'Verificacion',
      })],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`perfil:verificar:${ownerId}:${robloxId}:${codigo}`).setLabel('Reintentar').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`perfil:cancelar:${ownerId}:${codigo}`).setLabel('Cancelar').setStyle(ButtonStyle.Secondary),
        ),
      ],
    });
    return;
  }
  const btnSi = new ButtonBuilder().setCustomId(`perfil:confirmar_si:${ownerId}:${robloxId}:${codigo}`).setLabel('Confirmar vinculo').setStyle(ButtonStyle.Success);
  const btnNo = new ButtonBuilder().setCustomId(`perfil:confirmar_no:${ownerId}:${robloxId}:${codigo}`).setLabel('Cancelar').setStyle(ButtonStyle.Danger);
  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Codigo verificado',
      descripcion: 'Confirma el vinculo. Se enviara la solicitud de ingreso a cofundadores.',
      footer: 'Verificacion',
    })],
    components: [new ActionRowBuilder().addComponents(btnSi, btnNo)],
  });
}

async function onConfirmarNo(interaction, args) {
  const [ownerId, robloxId, codigo] = args;
  if (ownerId !== interaction.user.id) {
    await interaction.reply({ content: 'Solo el titular.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }
  await interaction.deferUpdate();
  getDb().prepare('UPDATE verificaciones SET usado = 1 WHERE discord_id = ? AND codigo = ?').run(ownerId, codigo);
  auditoria.registrar(ownerId, 'PERFIL.VERIFICACION_RECHAZADA', { robloxId, codigo });
  await interaction.editReply({
    embeds: [embedBase({ color: COLORES.denegado, titulo: 'Vinculo cancelado', descripcion: 'No se envio solicitud.', footer: 'Verificacion' })],
    components: [],
  });
}

async function onCancelar(interaction, args) {
  const [ownerId, codigo] = args;
  if (ownerId !== interaction.user.id) {
    await interaction.reply({ content: 'Solo el titular.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }
  await interaction.deferUpdate();
  getDb().prepare('UPDATE verificaciones SET usado = 1 WHERE discord_id = ? AND codigo = ?').run(ownerId, codigo);
  await interaction.editReply({
    embeds: [embedBase({ color: COLORES.neutral, titulo: 'Cancelado', descripcion: 'Verificacion cancelada.', footer: 'Verificacion' })],
    components: [],
  });
}

async function onVer(interaction) {
  const p = getDb().prepare('SELECT * FROM perfiles WHERE discord_id = ?').get(interaction.user.id);
  if (!p) {
    await interaction.update({
      embeds: [embedBase({ color: COLORES.denegado, titulo: 'Sin ficha', descripcion: 'No tienes ficha registrada.', footer: 'Personal' })],
      components: [],
    }).catch(() => {});
    return;
  }
  await interaction.update({
    embeds: [embedBase({
      color: COLORES.cupula,
      titulo: `Ficha · ${p.numero || '—'}`,
      campos: [
        { name: 'Personaje', value: p.personaje || '—', inline: true },
        { name: 'Roblox', value: p.roblox_usuario ? `@${p.roblox_usuario}` : '—', inline: true },
        { name: 'Estado', value: p.estado || '—', inline: true },
        { name: 'Area', value: p.area || '—', inline: true },
        { name: 'Cargo', value: p.cargo || '—', inline: true },
        { name: 'Nivel', value: String(p.nivel_auth ?? 0), inline: true },
      ],
      footer: 'Personal',
    })],
    components: [],
  }).catch(() => {});
}

module.exports = { prefix, handle };

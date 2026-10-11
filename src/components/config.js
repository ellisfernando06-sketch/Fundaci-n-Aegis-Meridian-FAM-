const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb, getConfig, setConfig } = require('../db');
const auditoria = require('../services/auditoria');
const { embedBase, COLORES, configuracion } = require('../utils/plantillas');
const { SITIOS_DEFAULT, CLASES_CONTENCION_DEFAULT } = require('../data/organigrama');
const { sanitizar } = require('../utils/helpers');

const prefix = 'config';

function esAdmin(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)
  );
}

async function handle(interaction, accion, args) {
  if (!esAdmin(interaction) && accion !== 'menu') {
    // Revalidar en cada acción
  }
  if (!esAdmin(interaction)) {
    await interaction.reply({
      content: 'No tienes autorización para esta acción.',
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
    return;
  }

  const ownerId = args[0];
  if (ownerId && ownerId !== interaction.user.id) {
    await interaction.reply({ content: 'Solo quien abrió el menú puede usarlo.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  switch (accion) {
    case 'menu':
      return onMenu(interaction);
    case 'canal_logs':
      return onCanalLogs(interaction);
    case 'canal_fichas':
      return onCanalFichas(interaction);
    case 'canal_archivos':
      return onCanalArchivos(interaction);
    case 'set_canal':
      return onSetCanal(interaction, args);
    case 'sitios_ver':
      return onSitiosVer(interaction);
    case 'sitios_add_modal':
      return onSitiosAddModal(interaction);
    case 'sitios_add_submit':
      return onSitiosAddSubmit(interaction);
    case 'clases_ver':
      return onClasesVer(interaction);
    case 'reiniciar_confirmar':
      return onReiniciarConfirmar(interaction);
    case 'reiniciar':
      return onReiniciar(interaction);
    case 'logs_ver':
      return onLogsVer(interaction);
    default:
      await interaction.reply({ content: 'Acción no reconocida.', flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}

async function onMenu(interaction) {
  const opcion = interaction.values[0];

  switch (opcion) {
    case 'canales': {
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`config:menu_canales:${interaction.user.id}`)
        .setPlaceholder('Selecciona el canal a configurar')
        .addOptions([
          { label: 'Canal de logs / auditoría', value: 'logs' },
          { label: 'Canal de fichas de personal', value: 'fichas' },
          { label: 'Canal de archivos de anomalías', value: 'archivos' },
        ]);

      // Re-map via custom handling - use buttons for simplicity
      const btnLogs = new ButtonBuilder().setCustomId(`config:canal_logs:${interaction.user.id}`).setLabel('Logs').setStyle(ButtonStyle.Primary);
      const btnFichas = new ButtonBuilder().setCustomId(`config:canal_fichas:${interaction.user.id}`).setLabel('Fichas').setStyle(ButtonStyle.Primary);
      const btnArchivos = new ButtonBuilder().setCustomId(`config:canal_archivos:${interaction.user.id}`).setLabel('Archivos').setStyle(ButtonStyle.Primary);

      await interaction.update({
        embeds: [
          embedBase({
            color: COLORES.neutral,
            titulo: '⚙️ Configuración · Canales',
            descripcion: 'Selecciona el tipo de canal que deseas asignar.',
            footer: 'Administración',
          }),
        ],
        components: [new ActionRowBuilder().addComponents(btnLogs, btnFichas, btnArchivos)],
      });
      break;
    }
    case 'logs':
      return onLogsVer(interaction);
    case 'sitios':
      return onSitiosVer(interaction);
    case 'clases':
      return onClasesVer(interaction);
    case 'reiniciar':
      return onReiniciarConfirmar(interaction);
  }
}

async function onCanalLogs(interaction) {
  const select = new ChannelSelectMenuBuilder()
    .setCustomId(`config:set_canal:logs:${interaction.user.id}`)
    .setPlaceholder('Selecciona el canal de logs')
    .setChannelTypes(ChannelType.GuildText);

  await interaction.update({
    embeds: [
      embedBase({
        color: COLORES.neutral,
        titulo: '⚙️ Canal de logs',
        descripcion: 'Selecciona el canal donde se publicarán los registros de auditoría.',
        footer: 'Administración',
      }),
    ],
    components: [new ActionRowBuilder().addComponents(select)],
  });
}

async function onCanalFichas(interaction) {
  const select = new ChannelSelectMenuBuilder()
    .setCustomId(`config:set_canal:fichas:${interaction.user.id}`)
    .setPlaceholder('Selecciona el canal de fichas')
    .setChannelTypes(ChannelType.GuildText);

  await interaction.update({
    embeds: [
      embedBase({
        color: COLORES.neutral,
        titulo: '⚙️ Canal de fichas',
        descripcion: 'Selecciona el canal donde se publicarán las fichas de personal.',
        footer: 'Administración',
      }),
    ],
    components: [new ActionRowBuilder().addComponents(select)],
  });
}

async function onCanalArchivos(interaction) {
  const select = new ChannelSelectMenuBuilder()
    .setCustomId(`config:set_canal:archivos:${interaction.user.id}`)
    .setPlaceholder('Selecciona el canal de archivos')
    .setChannelTypes(ChannelType.GuildText);

  await interaction.update({
    embeds: [
      embedBase({
        color: COLORES.neutral,
        titulo: '⚙️ Canal de archivos',
        descripcion: 'Selecciona el canal donde se publicarán los archivos de anomalías.',
        footer: 'Administración',
      }),
    ],
    components: [new ActionRowBuilder().addComponents(select)],
  });
}

async function onSetCanal(interaction, args) {
  const tipo = args[0]; // logs | fichas | archivos
  const channel = interaction.channels?.first();
  if (!channel) {
    await interaction.update({ content: 'No se seleccionó ningún canal.', embeds: [], components: [] });
    return;
  }

  const clave = `canal_${tipo}`;
  const anterior = getConfig(clave);
  setConfig(clave, channel.id);

  auditoria.registrar(interaction.user.id, 'CONFIG.CANAL', { tipo, canal: channel.id });

  await interaction.update({
    embeds: [
      configuracion({
        ajuste: `Canal de ${tipo}`,
        valorAnterior: anterior ? `<#${anterior}>` : '—',
        valorNuevo: `<#${channel.id}>`,
        cambiadoPor: `<@${interaction.user.id}>`,
      }),
    ],
    components: [],
  });
}

async function onSitiosVer(interaction) {
  let sitios = [];
  try {
    sitios = JSON.parse(getConfig('sitios') || '[]');
  } catch {
    sitios = [...SITIOS_DEFAULT];
  }

  const btnAdd = new ButtonBuilder()
    .setCustomId(`config:sitios_add_modal:${interaction.user.id}`)
    .setLabel('Añadir sitio')
    .setStyle(ButtonStyle.Primary);

  await interaction.update({
    embeds: [
      embedBase({
        color: COLORES.neutral,
        titulo: '⚙️ Sitios',
        descripcion: sitios.map((s, i) => `${i + 1}. ${s}`).join('\n') || 'Sin sitios configurados.',
        footer: 'Administración',
      }),
    ],
    components: [new ActionRowBuilder().addComponents(btnAdd)],
  }).catch(async () => {
    await interaction.reply({
      embeds: [
        embedBase({
          color: COLORES.neutral,
          titulo: '⚙️ Sitios',
          descripcion: sitios.map((s, i) => `${i + 1}. ${s}`).join('\n') || 'Sin sitios configurados.',
          footer: 'Administración',
        }),
      ],
      components: [new ActionRowBuilder().addComponents(btnAdd)],
      flags: MessageFlags.Ephemeral,
    });
  });
}

async function onSitiosAddModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(`config:sitios_add_submit:${interaction.user.id}`)
    .setTitle('Añadir sitio');

  const input = new TextInputBuilder()
    .setCustomId('nombre')
    .setLabel('Nombre del sitio')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(60)
    .setPlaceholder('Sitio Ejemplo-1');

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

async function onSitiosAddSubmit(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const nombre = sanitizar(interaction.fields.getTextInputValue('nombre').trim());
  let sitios = [];
  try {
    sitios = JSON.parse(getConfig('sitios') || '[]');
  } catch {
    sitios = [...SITIOS_DEFAULT];
  }

  if (sitios.includes(nombre)) {
    await interaction.editReply({ content: 'Ese sitio ya existe.' });
    return;
  }

  sitios.push(nombre);
  setConfig('sitios', JSON.stringify(sitios));
  auditoria.registrar(interaction.user.id, 'CONFIG.SITIO_ADD', { nombre });

  await interaction.editReply({
    embeds: [
      configuracion({
        ajuste: 'Sitios',
        valorAnterior: '—',
        valorNuevo: nombre,
        cambiadoPor: `<@${interaction.user.id}>`,
      }),
    ],
  });
}

async function onClasesVer(interaction) {
  let clases = [];
  try {
    clases = JSON.parse(getConfig('clases_contencion') || '[]');
  } catch {
    clases = [...CLASES_CONTENCION_DEFAULT];
  }

  const texto = clases.map((c) => `**${c.nombre}** · acceso sugerido Nivel ${c.accesoSugerido}`).join('\n');

  await interaction.update({
    embeds: [
      embedBase({
        color: COLORES.neutral,
        titulo: '⚙️ Clases de contención',
        descripcion: texto || 'Sin clases configuradas.',
        footer: 'Administración',
      }),
    ],
    components: [],
  }).catch(async () => {
    await interaction.reply({
      embeds: [
        embedBase({
          color: COLORES.neutral,
          titulo: '⚙️ Clases de contención',
          descripcion: texto || 'Sin clases configuradas.',
          footer: 'Administración',
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  });
}

async function onReiniciarConfirmar(interaction) {
  const btn = new ButtonBuilder()
    .setCustomId(`config:reiniciar:${interaction.user.id}`)
    .setLabel('Confirmar reinicio de contadores')
    .setStyle(ButtonStyle.Danger);

  await interaction.update({
    embeds: [
      embedBase({
        color: COLORES.denegado,
        titulo: '⚙️ Reiniciar contadores',
        descripcion: 'Se reiniciarán los contadores PER, AP, FAM, INC, MIS, SAN, EXP y SOL a 0. Los registros existentes no se borran.',
        footer: 'Administración',
      }),
    ],
    components: [new ActionRowBuilder().addComponents(btn)],
  }).catch(() => {});
}

async function onReiniciar(interaction) {
  await interaction.deferUpdate();

  const db = getDb();
  db.prepare('UPDATE contadores SET valor = 0').run();
  auditoria.registrar(interaction.user.id, 'CONFIG.REINICIAR_CONTADORES', {});

  await interaction.editReply({
    embeds: [
      configuracion({
        ajuste: 'Contadores',
        valorAnterior: 'valores previos',
        valorNuevo: '0',
        cambiadoPor: `<@${interaction.user.id}>`,
      }),
    ],
    components: [],
  });
}

async function onLogsVer(interaction) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM auditoria ORDER BY id DESC LIMIT 15').all();

  const texto = rows.length
    ? rows.map((r) => `\`${r.fecha}\` · **${r.accion}** · ${r.actor}`).join('\n')
    : 'Sin registros.';

  await interaction.update({
    embeds: [
      embedBase({
        color: COLORES.neutral,
        titulo: '📜 Últimos registros de auditoría',
        descripcion: texto,
        footer: 'Administración',
      }),
    ],
    components: [],
  }).catch(async () => {
    await interaction.reply({
      embeds: [
        embedBase({
          color: COLORES.neutral,
          titulo: '📜 Últimos registros de auditoría',
          descripcion: texto,
          footer: 'Administración',
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  });
}

module.exports = { prefix, handle };

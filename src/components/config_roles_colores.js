const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb } = require('../db');
const auditoria = require('../services/auditoria');
const { embedBase, COLORES } = require('../utils/plantillas');
const { getJerarquiaCompleta } = require('../data/organigrama');

function esAdmin(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)
  );
}

async function onColoresConfirmar(interaction) {
  if (!esAdmin(interaction)) {
    await interaction.update({
      embeds: [embedBase({
        color: COLORES.denegado,
        titulo: 'Sin permiso',
        descripcion: 'Se necesita Administrador.',
        footer: 'Administracion',
      })],
      components: [],
    }).catch(() => {});
    return;
  }

  const jerarquia = getJerarquiaCompleta().filter((i) => i.tipo !== 'separador');
  await interaction.update({
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: 'Aplicar colores unificados',
      descripcion:
        'Actualiza el color de **todos** los roles del organigrama ya mapeados.\n' +
        '· **Director / mando alto**: tono mas oscuro de la faccion\n' +
        '· **Resto de la faccion**: mismo color, mas claro\n\n' +
        `Roles a sincronizar (aprox.): **${jerarquia.length}**`,
      footer: 'Administracion · Colores por faccion',
    })],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`config_roles:colores_ejecutar:${interaction.user.id}`)
          .setLabel('Aplicar colores')
          .setStyle(ButtonStyle.Primary),
      ),
    ],
  }).catch(() => {});
}

async function onColoresEjecutar(interaction) {
  if (!esAdmin(interaction)) {
    await interaction.reply({ content: 'Sin permiso.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  await interaction.deferUpdate().catch(() => {});
  const guild = interaction.guild;
  await guild.roles.fetch();
  const me = guild.members.me;
  const botPos = me?.roles?.highest?.position ?? 0;

  const jerarquia = getJerarquiaCompleta();
  let actualizados = 0;
  let omitidos = 0;
  const errores = [];

  for (const item of jerarquia) {
    if (!item.key) continue;
    const row = getDb().prepare('SELECT role_id FROM roles_map WHERE cargo_key = ?').get(item.key);
    if (!row?.role_id) {
      omitidos += 1;
      continue;
    }
    const rol = guild.roles.cache.get(row.role_id);
    if (!rol || !rol.editable || rol.position >= botPos) {
      omitidos += 1;
      continue;
    }
    const hex = String(item.color || '#888780').replace('#', '');
    const colorInt = parseInt(hex, 16);
    if (!Number.isFinite(colorInt)) {
      omitidos += 1;
      continue;
    }
    try {
      if (rol.color !== colorInt) {
        await rol.setColor(colorInt, `Aegis · color faccion · ${interaction.user.tag}`);
        actualizados += 1;
        await new Promise((r) => setTimeout(r, 350));
      } else {
        omitidos += 1;
      }
    } catch (err) {
      errores.push(rol.name);
      console.error('[Color]', rol.name, err.message || err);
    }
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.COLORES', {
    actualizados,
    omitidos,
    errores: errores.length,
  });

  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Colores aplicados',
      descripcion: [
        `Actualizados: **${actualizados}**`,
        `Omitidos (sin mapa / sin permiso / igual): **${omitidos}**`,
        errores.length ? `Errores: **${errores.length}**` : null,
        '',
        'Directores: tono mas oscuro · faccion: mismo color mas claro.',
      ].filter(Boolean).join('\n'),
      footer: 'Administracion',
    })],
    components: [],
  }).catch(() => {});
}

module.exports = { onColoresConfirmar, onColoresEjecutar };

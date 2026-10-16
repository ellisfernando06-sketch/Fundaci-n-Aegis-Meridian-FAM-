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
const { getJerarquiaCompleta, nombreBaseRol } = require('../data/organigrama');
const { normalizarNombre } = require('../utils/helpers');

function esAdmin(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)
  );
}

function nombreOficial(item) {
  return item.nombreRol || item.nombre || item.key || '';
}

function matchRolAItem(rolDiscord, item) {
  const oficial = normalizarNombre(nombreOficial(item));
  const nom = normalizarNombre(rolDiscord.name);
  const base = normalizarNombre(nombreBaseRol(rolDiscord.name));
  if (!oficial) return false;
  if (nom === oficial) return true;
  if (base === oficial) return true;
  if (item.nombre && base === normalizarNombre(item.nombre)) return true;
  const tokens = normalizarNombre(item.nombre || '').split(/\s+/).filter((t) => t.length > 3);
  if (tokens.length >= 2 && tokens.every((t) => nom.includes(t) || base.includes(t))) return true;
  return false;
}

function guardarMapa(cargoKey, roleId, nombreRol) {
  try {
    getDb().prepare(
      `INSERT INTO roles_map (cargo_key, role_id, nombre_rol) VALUES (?, ?, ?)
       ON CONFLICT(cargo_key) DO UPDATE SET role_id = excluded.role_id, nombre_rol = excluded.nombre_rol, actualizado_en = datetime('now')`
    ).run(cargoKey, roleId, nombreRol);
  } catch (_) {}
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

  const jerarquia = getJerarquiaCompleta().filter((i) => i.tipo !== 'separador' && i.key);
  await interaction.update({
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: 'Aplicar colores unificados',
      descripcion:
        'Lee **todos** los roles del servidor, los empareja con el organigrama por **nombre** y aplica color por faccion.\n' +
        '· **Director / mando alto**: tono mas oscuro\n' +
        '· **Resto de la faccion**: mismo color, mas claro\n\n' +
        `Cargos del organigrama: **${jerarquia.length}**`,
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

  const rolesServidor = [...guild.roles.cache.values()].filter(
    (r) => r.id !== guild.id && !r.managed
  );
  const jerarquia = getJerarquiaCompleta().filter((i) => i.tipo !== 'separador' && i.key);

  let actualizados = 0;
  let omitidos = 0;
  let detectados = 0;
  const errores = [];
  const usados = new Set();

  for (const item of jerarquia) {
    let rol = null;
    try {
      const row = getDb().prepare('SELECT role_id FROM roles_map WHERE cargo_key = ?').get(item.key);
      if (row?.role_id) {
        const r = guild.roles.cache.get(row.role_id);
        if (r && !usados.has(r.id)) rol = r;
      }
    } catch (_) {}
    if (!rol) {
      for (const r of rolesServidor) {
        if (usados.has(r.id)) continue;
        if (matchRolAItem(r, item)) {
          rol = r;
          break;
        }
      }
    }
    if (!rol) {
      omitidos += 1;
      continue;
    }
    detectados += 1;
    usados.add(rol.id);
    guardarMapa(item.key, rol.id, rol.name);

    if (!rol.editable || rol.position >= botPos) {
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
    detectados,
    errores: errores.length,
  });

  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Colores aplicados',
      descripcion: [
        `Roles detectados por nombre/mapa: **${detectados}**`,
        `Actualizados: **${actualizados}**`,
        `Omitidos (sin match / sin permiso / igual): **${omitidos}**`,
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

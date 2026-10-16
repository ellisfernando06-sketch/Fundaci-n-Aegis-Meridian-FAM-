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
const { colorCargo, PALETA_FACCION } = require('../data/colores_faccion');
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

function hexToInt(hex) {
  const h = String(hex || '#888780').replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return Number.isFinite(n) ? n : 0x888780;
}

function colorParaItem(item) {
  if (item.tipo === 'cargo' || (!item.tipo && item.key && !String(item.key).startsWith('PERM') && !String(item.key).startsWith('AREA') && !String(item.key).startsWith('KEY') && !String(item.key).startsWith('SEP'))) {
    try {
      return colorCargo(item, item.rama);
    } catch (_) {}
  }
  if (item.color) return item.color;
  if (item.rama && PALETA_FACCION[item.rama]) return PALETA_FACCION[item.rama];
  return '#888780';
}

function matchRolAItem(rolDiscord, item) {
  const oficial = normalizarNombre(nombreOficial(item));
  const nom = normalizarNombre(rolDiscord.name);
  const base = normalizarNombre(nombreBaseRol(rolDiscord.name));
  if (!oficial) return false;
  if (nom === oficial || base === oficial) return true;
  if (item.nombre) {
    const nn = normalizarNombre(item.nombre);
    if (base === nn || nom === nn) return true;
    if (nn.length > 5 && (nom.includes(nn) || base.includes(nn))) return true;
  }
  const aliases = Array.isArray(item.aliases) ? item.aliases : [];
  for (const a of aliases) {
    const na = normalizarNombre(a);
    if (!na || na.length < 3) continue;
    if (nom === na || base === na) return true;
    if (na.length > 5 && (nom.includes(na) || base.includes(na))) return true;
  }
  const tokens = normalizarNombre(item.nombre || '')
    .split(/\s+/)
    .filter((t) => t.length > 3);
  if (tokens.length >= 2 && tokens.every((t) => nom.includes(t) || base.includes(t))) return true;
  return false;
}

function guardarMapa(cargoKey, roleId, nombreRol) {
  try {
    getDb()
      .prepare(
        `INSERT INTO roles_map (cargo_key, role_id, nombre_rol) VALUES (?, ?, ?)
         ON CONFLICT(cargo_key) DO UPDATE SET role_id = excluded.role_id, nombre_rol = excluded.nombre_rol, actualizado_en = datetime('now')`
      )
      .run(cargoKey, roleId, nombreRol);
  } catch (_) {}
}

async function onColoresConfirmar(interaction) {
  if (!esAdmin(interaction)) {
    await interaction
      .update({
        embeds: [
          embedBase({
            color: COLORES.denegado,
            titulo: 'Sin permiso',
            descripcion: 'Se necesita Administrador.',
            footer: 'Administracion',
          }),
        ],
        components: [],
      })
      .catch(() => {});
    return;
  }

  const jerarquia = getJerarquiaCompleta().filter((i) => i.tipo !== 'separador' && i.key);
  const guild = interaction.guild;
  await guild.roles.fetch().catch(() => {});
  const totalRoles = guild.roles.cache.filter((r) => r.id !== guild.id && !r.managed).size;
  const botPos = guild.members.me?.roles?.highest?.position ?? 0;

  await interaction
    .update({
      embeds: [
        embedBase({
          color: COLORES.neutral,
          titulo: 'Aplicar colores unificados',
          descripcion:
            'Lee **todos** los roles del servidor y los pinta por faccion.\n' +
            '· **Director / mando alto**: tono mas oscuro\n' +
            '· **Resto de la faccion**: mismo color, mas claro\n\n' +
            `Cargos organigrama: **${jerarquia.length}**\n` +
            `Roles en el servidor: **${totalRoles}**\n` +
            `Posicion del rol del bot: **${botPos}** (debe estar por encima de los roles a pintar)`,
          footer: 'Administracion · Colores por faccion',
        }),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`config_roles:colores_ejecutar:${interaction.user.id}`)
            .setLabel('Aplicar colores')
            .setStyle(ButtonStyle.Primary)
        ),
      ],
    })
    .catch(() => {});
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

  const rolesServidor = [...guild.roles.cache.values()].filter((r) => r.id !== guild.id && !r.managed);
  const jerarquia = getJerarquiaCompleta().filter((i) => i.tipo !== 'separador' && i.key);

  let actualizados = 0;
  let omitidosSinMatch = 0;
  let omitidosPermiso = 0;
  let omitidosIgual = 0;
  let detectados = 0;
  const errores = [];
  const usados = new Set();
  const ejemplos = [];

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
      omitidosSinMatch += 1;
      continue;
    }

    detectados += 1;
    usados.add(rol.id);
    guardarMapa(item.key, rol.id, rol.name);

    if (!rol.editable || rol.position >= botPos) {
      omitidosPermiso += 1;
      if (ejemplos.length < 5) ejemplos.push(`${rol.name} (sin permiso / bajo el bot)`);
      continue;
    }

    const colorInt = hexToInt(colorParaItem(item));
    try {
      if (rol.color === colorInt) {
        omitidosIgual += 1;
        continue;
      }
      await rol.setColor(colorInt, `Aegis · color faccion · ${interaction.user.tag}`);
      actualizados += 1;
      if (ejemplos.length < 8) ejemplos.push(`${rol.name} → #${colorInt.toString(16).padStart(6, '0')}`);
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      errores.push(rol.name);
      console.error('[Color]', rol.name, err.message || err);
    }
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.COLORES', {
    actualizados,
    detectados,
    omitidosSinMatch,
    omitidosPermiso,
    omitidosIgual,
    errores: errores.length,
  });

  const avisoBot =
    omitidosPermiso > 10
      ? '\n\n**Aviso:** muchos roles no se pudieron editar. Sube el rol del bot **por encima** de los roles del organigrama.'
      : '';

  await interaction
    .editReply({
      embeds: [
        embedBase({
          color: actualizados > 0 ? COLORES.medicina : COLORES.denegado,
          titulo: 'Colores aplicados',
          descripcion: [
            `Roles detectados: **${detectados}** / ${jerarquia.length}`,
            `Actualizados: **${actualizados}**`,
            `Sin coincidencia de nombre: **${omitidosSinMatch}**`,
            `Sin permiso (rol bot bajo): **${omitidosPermiso}**`,
            `Ya tenian el color: **${omitidosIgual}**`,
            errores.length ? `Errores API: **${errores.length}**` : null,
            ejemplos.length ? `\nEjemplos:\n${ejemplos.map((e) => `· ${e}`).join('\n')}` : null,
            avisoBot,
          ]
            .filter(Boolean)
            .join('\n'),
          footer: 'Administracion · v2 colores',
        }),
      ],
      components: [],
    })
    .catch(() => {});
}

module.exports = { onColoresConfirmar, onColoresEjecutar };

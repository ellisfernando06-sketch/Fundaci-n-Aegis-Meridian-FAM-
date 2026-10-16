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
const {
  getJerarquiaCompleta,
  getOrganigramaTexto,
  nombreBaseRol,
} = require('../data/organigrama');
const { normalizarNombre, truncar } = require('../utils/helpers');

function esAdmin(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)
  );
}

function asegurarColumnaOrigen() {
  try {
    getDb().exec(`ALTER TABLE roles_map ADD COLUMN origen TEXT DEFAULT 'existente'`);
  } catch (_) {}
}

function guardarMapa(cargoKey, roleId, nombreRol, origen) {
  const db = getDb();
  asegurarColumnaOrigen();
  db.prepare(
    `INSERT INTO roles_map (cargo_key, role_id, nombre_rol, origen) VALUES (?, ?, ?, ?)
     ON CONFLICT(cargo_key) DO UPDATE SET
       role_id = excluded.role_id, nombre_rol = excluded.nombre_rol,
       origen = excluded.origen, actualizado_en = datetime('now')`
  ).run(cargoKey, roleId, nombreRol, origen);
}

function nombreOficial(item) {
  return item.nombreRol || item.nombre || item.key;
}

function existeExacto(rolDiscord, item) {
  const oficial = normalizarNombre(nombreOficial(item));
  const nom = normalizarNombre(rolDiscord.name);
  const base = normalizarNombre(nombreBaseRol(rolDiscord.name));
  if (!oficial) return false;
  if (nom === oficial) return true;
  if (item.tipo === 'separador' && (nom === oficial || base === oficial)) return true;
  if (item.nombre && base === normalizarNombre(item.nombre)) return true;
  if (item.nombre && nom.includes(normalizarNombre(item.nombre))) return true;
  const aliases = item.aliases || [];
  for (const a of aliases) {
    const na = normalizarNombre(a);
    if (na && (nom === na || base === na || nom.includes(na))) return true;
  }
  return false;
}

function escanear(guild) {
  const roles = [...guild.roles.cache.values()].filter(
    (r) => r.id !== guild.id && !r.managed
  );
  const catalogo = getJerarquiaCompleta();
  const usados = new Set();
  const detectados = [];
  const faltantes = [];
  const aRenombrar = [];

  for (const item of catalogo) {
    let match = null;
    for (const rol of roles) {
      if (usados.has(rol.id)) continue;
      if (existeExacto(rol, item)) {
        match = rol;
        break;
      }
    }
    if (match) {
      detectados.push({ item, rol: match });
      usados.add(match.id);
      guardarMapa(item.key, match.id, match.name, 'existente');
      const destino = String(nombreOficial(item)).slice(0, 100);
      if (match.name !== destino) {
        aRenombrar.push({
          item,
          rol: match,
          nombreActual: match.name,
          nombreDestino: destino,
        });
      }
    } else {
      faltantes.push(item);
    }
  }
  return { detectados, faltantes, aRenombrar, rolesLeidos: roles.length, catalogo };
}

async function verOrganigrama(interaction) {
  await interaction.deferUpdate();
  const texto = getOrganigramaTexto();
  const chunks = [];
  let actual = '';
  for (const linea of texto.split('\n')) {
    if ((actual + '\n' + linea).length > 3800) {
      chunks.push(actual);
      actual = linea;
    } else {
      actual = actual ? actual + '\n' + linea : linea;
    }
  }
  if (actual) chunks.push(actual);
  const embeds = chunks.slice(0, 8).map((desc, i) => embedBase({
    color: COLORES.neutral,
    titulo: i === 0 ? 'Organigrama · Fundacion Aegis-Meridian' : `Organigrama (cont. ${i + 1})`,
    descripcion: desc,
    footer: 'Custodes Veritatis',
    timestamp: i === 0,
  }));
  await interaction.editReply({ embeds, components: [] });
}

async function analizar(interaction) {
  await interaction.deferUpdate();
  await interaction.guild.roles.fetch();
  const { detectados, faltantes, aRenombrar, rolesLeidos } = escanear(interaction.guild);
  const embeds = [embedBase({
    color: COLORES.neutral,
    titulo: 'Informe de roles',
    campos: [
      { name: 'Leidos', value: String(rolesLeidos), inline: true },
      { name: 'Detectados', value: String(detectados.length), inline: true },
      { name: 'Faltantes', value: String(faltantes.length), inline: true },
      { name: 'Por renombrar', value: String(aRenombrar.length), inline: true },
    ],
    footer: 'Panel de roles',
  })];
  if (faltantes.length) {
    embeds.push(embedBase({
      color: COLORES.denegado,
      titulo: `Faltantes (${faltantes.length})`,
      descripcion: truncar(faltantes.slice(0, 25).map((f) => `· ${nombreOficial(f)}`).join('\n')),
      footer: 'Usa Crear roles',
      timestamp: false,
    }));
  }
  if (aRenombrar.length) {
    embeds.push(embedBase({
      color: 0xe8b923,
      titulo: `Por renombrar (${aRenombrar.length})`,
      descripcion: truncar(aRenombrar.slice(0, 20).map((r) => `**${r.nombreActual}** → \`${r.nombreDestino}\``).join('\n')),
      footer: 'Usa Renombrar',
      timestamp: false,
    }));
  }
  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ANALIZAR', {
    detectados: detectados.length,
    faltantes: faltantes.length,
  });
  await interaction.editReply({ embeds, components: [] });
}

async function onCrearConfirmar(interaction) {
  await interaction.deferUpdate();
  await interaction.guild.roles.fetch();
  const { faltantes } = escanear(interaction.guild);
  const preview = faltantes.slice(0, 25).map((f) => `· ${nombreOficial(f)}`).join('\n') || 'Nada pendiente.';
  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: 'Crear roles faltantes',
      descripcion: `Se crearan y luego se ordenaran.\n\n${preview}${faltantes.length > 25 ? `\n… +${faltantes.length - 25}` : ''}`,
      footer: 'Administracion',
    })],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`config_roles:crear_ejecutar:${interaction.user.id}`)
          .setLabel(`Crear ${faltantes.length} roles`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(faltantes.length === 0),
      ),
    ],
  });
}

async function onCrearEjecutar(interaction) {
  await interaction.deferUpdate();
  const guild = interaction.guild;
  await guild.roles.fetch();
  const { faltantes } = escanear(guild);
  let creados = 0;
  const fallos = [];
  for (const item of faltantes) {
    if (item.tipo === 'separador' && !item.key) continue;
    const name = String(nombreOficial(item)).slice(0, 100);
    const hex = String(item.color || '#888780').replace('#', '');
    const color = parseInt(hex, 16);
    try {
      const rol = await guild.roles.create({
        name,
        colors: Number.isFinite(color) ? color : 0x888780,
        reason: `Aegis · crear · ${interaction.user.tag}`,
        mentionable: false,
        hoist: false,
      });
      guardarMapa(item.key, rol.id, rol.name, 'creado');
      creados += 1;
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      fallos.push(name);
      console.error('[Crear]', name, e.message || e);
    }
  }
  try { await ordenarRoles(guild, interaction.user.tag); } catch (_) {}
  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.CREAR', { creados, fallos: fallos.length });
  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Creacion completada',
      descripcion: `Creados: **${creados}**${fallos.length ? `\nFallos: ${fallos.length}` : ''}`,
      footer: 'Administracion',
    })],
    components: [],
  });
}

async function onRenombrarConfirmar(interaction) {
  await interaction.deferUpdate();
  await interaction.guild.roles.fetch();
  const { aRenombrar } = escanear(interaction.guild);
  const preview = aRenombrar.slice(0, 20).map((r) => `**${r.nombreActual}** → \`${r.nombreDestino}\``).join('\n') || 'Nada pendiente.';
  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: 'Renombrar roles',
      descripcion: preview + (aRenombrar.length > 20 ? `\n… +${aRenombrar.length - 20}` : ''),
      footer: 'Administracion',
    })],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`config_roles:renombrar_ejecutar:${interaction.user.id}`)
          .setLabel(`Renombrar ${aRenombrar.length}`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(aRenombrar.length === 0),
      ),
    ],
  });
}

async function onRenombrarEjecutar(interaction) {
  await interaction.deferUpdate();
  await interaction.guild.roles.fetch();
  const { aRenombrar } = escanear(interaction.guild);
  let n = 0;
  for (const r of aRenombrar) {
    if (!r.rol.editable) continue;
    try {
      await r.rol.setName(r.nombreDestino.slice(0, 100), `Aegis · renombrar · ${interaction.user.tag}`);
      guardarMapa(r.item.key, r.rol.id, r.nombreDestino, 'existente');
      n += 1;
      await new Promise((x) => setTimeout(x, 350));
    } catch (e) {
      console.error('[Renombrar]', e.message || e);
    }
  }
  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.RENOMBRAR', { n });
  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Renombrado completado',
      descripcion: `Roles renombrados: **${n}**`,
      footer: 'Administracion',
    })],
    components: [],
  });
}

async function onOrganizarConfirmar(interaction) {
  await interaction.deferUpdate();
  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: 'Ordenar roles',
      descripcion: 'Reordena los roles del organigrama segun la jerarquia oficial.',
      footer: 'Administracion',
    })],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`config_roles:organizar_ejecutar:${interaction.user.id}`)
          .setLabel('Ordenar ahora')
          .setStyle(ButtonStyle.Primary),
      ),
    ],
  });
}

async function ordenarRoles(guild, tag) {
  await guild.roles.fetch();
  const { detectados } = escanear(guild);
  const me = guild.members.me;
  const botPos = me?.roles?.highest?.position ?? 0;
  const ordenados = detectados
    .filter((d) => d.item.orden != null && d.rol.editable && d.rol.position < botPos)
    .sort((a, b) => (a.item.orden || 0) - (b.item.orden || 0));
  let pos = Math.max(1, botPos - ordenados.length - 2);
  for (const d of ordenados) {
    try {
      await d.rol.setPosition(pos, { reason: `Aegis · orden · ${tag}` });
      pos += 1;
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      console.error('[Orden]', d.rol.name, e.message || e);
    }
  }
}

async function onOrganizarEjecutar(interaction) {
  await interaction.deferUpdate();
  try {
    await ordenarRoles(interaction.guild, interaction.user.tag);
  } catch (e) {
    console.error('[Organizar]', e);
  }
  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ORDENAR', {});
  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Orden aplicado',
      descripcion: 'Los roles detectados se reordenaron segun el organigrama.',
      footer: 'Administracion',
    })],
    components: [],
  });
}

async function onEliminarConfirmar(interaction) {
  await interaction.deferUpdate();
  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.denegado,
      titulo: 'Eliminar roles del bot',
      descripcion: 'Elimina roles creados por el bot (origen=creado). Los roles preexistentes se conservan.',
      footer: 'Administracion',
    })],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`config_roles:eliminar_ejecutar:${interaction.user.id}`)
          .setLabel('Eliminar creados')
          .setStyle(ButtonStyle.Danger),
      ),
    ],
  });
}

async function onEliminarEjecutar(interaction) {
  await interaction.deferUpdate();
  asegurarColumnaOrigen();
  const rows = getDb().prepare(`SELECT * FROM roles_map WHERE origen = 'creado'`).all();
  let eliminados = 0;
  const fallos = [];
  for (const row of rows) {
    const rol = interaction.guild.roles.cache.get(row.role_id);
    if (!rol || !rol.editable) {
      fallos.push(row.nombre_rol || row.cargo_key);
      continue;
    }
    try {
      await rol.delete(`Aegis · eliminar · ${interaction.user.tag}`);
      getDb().prepare('DELETE FROM roles_map WHERE cargo_key = ?').run(row.cargo_key);
      eliminados += 1;
      await new Promise((r) => setTimeout(r, 350));
    } catch (e) {
      fallos.push(row.nombre_rol || row.cargo_key);
    }
  }
  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ELIMINAR', { eliminados });
  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Eliminacion completada',
      descripcion: `Eliminados: **${eliminados}**${fallos.length ? `\nFallos: ${fallos.length}` : ''}`,
      footer: 'Administracion',
    })],
    components: [],
  });
}

module.exports = {
  esAdmin,
  asegurarColumnaOrigen,
  guardarMapa,
  nombreOficial,
  existeExacto,
  escanear,
  verOrganigrama,
  analizar,
  onCrearConfirmar,
  onCrearEjecutar,
  onRenombrarConfirmar,
  onRenombrarEjecutar,
  onOrganizarConfirmar,
  onOrganizarEjecutar,
  ordenarRoles,
  onEliminarConfirmar,
  onEliminarEjecutar,
};

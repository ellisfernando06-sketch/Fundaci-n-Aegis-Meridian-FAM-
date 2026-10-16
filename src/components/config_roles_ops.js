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

function claveSeparador(texto) {
  const t = String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (t.includes('FUNDACION')) return 'FUNDACION';
  if (t.includes('MODERACION')) return 'MODERACION';
  if (t.includes('SOPORTE')) return 'SOPORTE';
  if (t.includes('CUPULA')) return 'CUPULA';
  if (t.includes('DIRECCION')) return 'DIRECCIONES';
  if (t.includes('SEGURIDAD INTERNA')) return 'SI';
  if (t.includes('FACCION SEGURIDAD') || (t.includes('SEGURIDAD') && !t.includes('INTERNA'))) return 'SEG';
  if (t.includes('MEDICINA')) return 'MED';
  if (t.includes('INVESTIGACION')) return 'INV';
  if (t.includes('INTELIGENCIA')) return 'INT';
  if (t.includes('CLASE D')) return 'CD';
  if (t.includes('INSURGENCIA') || t.includes('CAOS')) return 'CAOS';
  if (t.includes('PERMISO')) return 'PERMISOS';
  if (t.includes('LLAVE') || t.includes('KEY')) return 'LLAVES';
  return null;
}

function existeExacto(rolDiscord, item) {
  const oficial = normalizarNombre(nombreOficial(item));
  const nom = normalizarNombre(rolDiscord.name);
  const base = normalizarNombre(nombreBaseRol(rolDiscord.name));
  if (!oficial) return false;

  if (item.tipo === 'separador' || String(item.key || '').startsWith('SEP.')) {
    if (nom === oficial || base === oficial) return true;
    const c1 = claveSeparador(rolDiscord.name);
    const c2 = claveSeparador(nombreOficial(item));
    if (c1 && c2 && c1 === c2) return true;
    if (/[━─═]/.test(rolDiscord.name) && c2 && String(rolDiscord.name).toUpperCase().includes(c2.slice(0, 4))) {
      return true;
    }
    return false;
  }

  if (nom === oficial) return true;
  if (item.nombre && base === normalizarNombre(item.nombre)) return true;
  if (item.nombre && nom.includes(normalizarNombre(item.nombre))) return true;
  for (const a of item.aliases || []) {
    const na = normalizarNombre(a);
    if (na && (nom === na || base === na || nom.includes(na))) return true;
  }
  return false;
}

function escanear(guild) {
  const roles = [...guild.roles.cache.values()].filter((r) => r.id !== guild.id && !r.managed);
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
        aRenombrar.push({ item, rol: match, nombreActual: match.name, nombreDestino: destino });
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
  const embeds = chunks.slice(0, 8).map((desc, i) =>
    embedBase({
      color: COLORES.neutral,
      titulo: i === 0 ? 'Organigrama · Fundacion Aegis-Meridian' : `Organigrama (cont. ${i + 1})`,
      descripcion: desc,
      footer: 'Custodes Veritatis',
      timestamp: i === 0,
    })
  );
  await interaction.editReply({ embeds, components: [] });
}

async function analizar(interaction) {
  await interaction.deferUpdate();
  await interaction.guild.roles.fetch();
  const { detectados, faltantes, aRenombrar, rolesLeidos } = escanear(interaction.guild);
  const seps = detectados.filter((d) => d.item.tipo === 'separador' || String(d.item.key || '').startsWith('SEP.'));
  const embeds = [
    embedBase({
      color: COLORES.neutral,
      titulo: 'Informe de roles',
      campos: [
        { name: 'Leidos', value: String(rolesLeidos), inline: true },
        { name: 'Detectados', value: String(detectados.length), inline: true },
        { name: 'Separadores', value: String(seps.length), inline: true },
        { name: 'Faltantes', value: String(faltantes.length), inline: true },
        { name: 'Por renombrar', value: String(aRenombrar.length), inline: true },
      ],
      footer: 'Panel de roles',
    }),
  ];
  if (faltantes.length) {
    embeds.push(
      embedBase({
        color: COLORES.denegado,
        titulo: `Faltantes (${faltantes.length})`,
        descripcion: truncar(faltantes.slice(0, 30).map((f) => `· ${nombreOficial(f)}`).join('\n')),
        footer: 'Usa Crear roles (incluye separadores)',
        timestamp: false,
      })
    );
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
  const seps = faltantes.filter((f) => f.tipo === 'separador' || String(f.key || '').startsWith('SEP.'));
  const preview = faltantes.slice(0, 28).map((f) => `· ${nombreOficial(f)}`).join('\n') || 'Nada pendiente.';
  await interaction.editReply({
    embeds: [
      embedBase({
        color: COLORES.neutral,
        titulo: 'Crear roles y separadores',
        descripcion: `Faltantes: **${faltantes.length}** (separadores: **${seps.length}**)\n\n${preview}`,
        footer: 'Administracion',
      }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`config_roles:crear_ejecutar:${interaction.user.id}`)
          .setLabel(`Crear ${faltantes.length}`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(faltantes.length === 0)
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
  let sepsCreados = 0;
  const fallos = [];
  const ordenados = [...faltantes].sort((a, b) => (a.orden || 0) - (b.orden || 0));

  for (const item of ordenados) {
    if (!item.key) continue;
    const name = String(nombreOficial(item)).slice(0, 100);
    const hex = String(item.color || (item.tipo === 'separador' ? '#1a1a1e' : '#888780')).replace('#', '');
    const color = parseInt(hex, 16);
    const esSep = item.tipo === 'separador' || String(item.key).startsWith('SEP.');
    try {
      const rol = await guild.roles.create({
        name,
        colors: Number.isFinite(color) ? color : 0x1a1a1e,
        reason: `Aegis · crear · ${interaction.user.tag}`,
        mentionable: false,
        hoist: false,
      });
      guardarMapa(item.key, rol.id, rol.name, 'creado');
      creados += 1;
      if (esSep) sepsCreados += 1;
      await new Promise((r) => setTimeout(r, 250));
    } catch (e) {
      fallos.push(name);
      console.error('[Crear]', name, e.message || e);
    }
  }

  let ordenInfo = '';
  try {
    const r = await ordenarRoles(guild, interaction.user.tag);
    ordenInfo = `\nOrdenados en lote: **${r.movidos}**`;
  } catch (e) {
    console.error('[Orden post-crear]', e);
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.CREAR', { creados, sepsCreados });
  await interaction.editReply({
    embeds: [
      embedBase({
        color: COLORES.medicina,
        titulo: 'Creacion completada',
        descripcion: `Creados: **${creados}** (separadores: **${sepsCreados}**)${fallos.length ? `\nFallos: ${fallos.length}` : ''}${ordenInfo}`,
        footer: 'Administracion',
      }),
    ],
    components: [],
  });
}

async function onRenombrarConfirmar(interaction) {
  await interaction.deferUpdate();
  await interaction.guild.roles.fetch();
  const { aRenombrar } = escanear(interaction.guild);
  const preview =
    aRenombrar.slice(0, 20).map((r) => `**${r.nombreActual}** → \`${r.nombreDestino}\``).join('\n') || 'Nada pendiente.';
  await interaction.editReply({
    embeds: [
      embedBase({
        color: COLORES.neutral,
        titulo: 'Renombrar roles',
        descripcion: preview,
        footer: 'Administracion',
      }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`config_roles:renombrar_ejecutar:${interaction.user.id}`)
          .setLabel(`Renombrar ${aRenombrar.length}`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(aRenombrar.length === 0)
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
      await new Promise((x) => setTimeout(x, 200));
    } catch (e) {
      console.error('[Renombrar]', e.message || e);
    }
  }
  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.RENOMBRAR', { n });
  await interaction.editReply({
    embeds: [embedBase({ color: COLORES.medicina, titulo: 'Renombrado', descripcion: `**${n}** roles`, footer: 'Administracion' })],
    components: [],
  });
}

async function onOrganizarConfirmar(interaction) {
  await interaction.deferUpdate();
  await interaction.editReply({
    embeds: [
      embedBase({
        color: COLORES.neutral,
        titulo: 'Ordenar roles (rapido)',
        descripcion:
          'Reordena **separadores + cargos** en un solo lote.\n' +
          'Arriba: FUNDACION · abajo: LLAVES.\n' +
          'El rol del bot debe estar por encima de todos.',
        footer: 'Administracion',
      }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`config_roles:organizar_ejecutar:${interaction.user.id}`)
          .setLabel('Ordenar ahora')
          .setStyle(ButtonStyle.Primary)
      ),
    ],
  });
}

/**
 * Orden RAPIDO: un solo guild.roles.setPositions (API bulk).
 * Discord: position alta = arriba en la lista.
 * orden organigrama bajo (SEP.FUNDACION=10) => position alta.
 */
async function ordenarRoles(guild, tag) {
  await guild.roles.fetch();
  const { detectados } = escanear(guild);
  const me = guild.members.me;
  const botPos = me?.roles?.highest?.position ?? 0;

  const ordenados = detectados
    .filter((d) => d.item.orden != null && d.rol && d.rol.editable && d.rol.position < botPos && !d.rol.managed)
    .sort((a, b) => (a.item.orden || 0) - (b.item.orden || 0));

  // Position objetivo: el primero del organigrama queda justo debajo del bot
  let pos = botPos - 1;
  const positions = [];
  let separadores = 0;

  for (const d of ordenados) {
    if (pos < 1) break;
    positions.push({ role: d.rol.id, position: pos });
    if (d.item.tipo === 'separador' || String(d.item.key || '').startsWith('SEP.')) separadores += 1;
    pos -= 1;
  }

  let movidos = 0;
  let fallos = 0;

  // Lotes de 50 (limite practico Discord)
  for (let i = 0; i < positions.length; i += 50) {
    const chunk = positions.slice(i, i + 50);
    try {
      await guild.roles.setPositions(chunk);
      movidos += chunk.length;
    } catch (e) {
      console.error('[Orden bulk]', e.message || e);
      // Fallback: uno a uno sin delay largo
      for (const p of chunk) {
        try {
          const rol = guild.roles.cache.get(p.role);
          if (rol) {
            await rol.setPosition(p.position, { reason: `Aegis · orden · ${tag}` });
            movidos += 1;
          }
        } catch (e2) {
          fallos += 1;
        }
      }
    }
  }

  return { movidos, separadores, fallos, total: ordenados.length, botPos };
}

async function onOrganizarEjecutar(interaction) {
  await interaction.deferUpdate();
  let info = { movidos: 0, separadores: 0, fallos: 0, total: 0, botPos: 0 };
  try {
    info = await ordenarRoles(interaction.guild, interaction.user.tag);
  } catch (e) {
    console.error('[Organizar]', e);
  }
  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ORDENAR', info);
  await interaction.editReply({
    embeds: [
      embedBase({
        color: info.movidos > 0 ? COLORES.medicina : COLORES.denegado,
        titulo: 'Orden aplicado',
        descripcion: [
          `Cadena organigrama: **${info.total}**`,
          `Movidos (lote rapido): **${info.movidos}**`,
          `Separadores: **${info.separadores}**`,
          info.fallos ? `Fallos: **${info.fallos}**` : null,
          `Posicion del bot: **${info.botPos}**`,
          '',
          info.movidos === 0
            ? '**0 movidos:** sube el rol del bot por encima de todos y vuelve a intentar.'
            : 'FUNDACION arriba → LLAVES abajo.',
        ]
          .filter(Boolean)
          .join('\n'),
        footer: 'Administracion · orden bulk',
      }),
    ],
    components: [],
  });
}

async function onEliminarConfirmar(interaction) {
  await interaction.deferUpdate();
  await interaction.editReply({
    embeds: [
      embedBase({
        color: COLORES.denegado,
        titulo: 'Eliminar roles del bot',
        descripcion: 'Elimina roles con origen=creado.',
        footer: 'Administracion',
      }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`config_roles:eliminar_ejecutar:${interaction.user.id}`)
          .setLabel('Eliminar creados')
          .setStyle(ButtonStyle.Danger)
      ),
    ],
  });
}

async function onEliminarEjecutar(interaction) {
  await interaction.deferUpdate();
  asegurarColumnaOrigen();
  const rows = getDb().prepare(`SELECT * FROM roles_map WHERE origen = 'creado'`).all();
  let eliminados = 0;
  for (const row of rows) {
    const rol = interaction.guild.roles.cache.get(row.role_id);
    if (!rol || !rol.editable) continue;
    try {
      await rol.delete(`Aegis · eliminar · ${interaction.user.tag}`);
      getDb().prepare('DELETE FROM roles_map WHERE cargo_key = ?').run(row.cargo_key);
      eliminados += 1;
      await new Promise((r) => setTimeout(r, 200));
    } catch (_) {}
  }
  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ELIMINAR', { eliminados });
  await interaction.editReply({
    embeds: [embedBase({ color: COLORES.medicina, titulo: 'Eliminacion', descripcion: `**${eliminados}**`, footer: 'Administracion' })],
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

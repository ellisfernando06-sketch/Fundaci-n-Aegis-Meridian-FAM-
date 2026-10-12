/**
 * Servicio de roles · Fundacion Aegis-Meridian
 * Todo otorgamiento (cargo, area, nivel, llave, estado) se refleja en roles Discord.
 */

const { PermissionFlagsBits } = require('discord.js');
const { getDb } = require('../db');
const {
  getTodosCargos,
  getCargoPorKey,
  ROLES_PERMISOS,
  ORGANIGRAMA,
} = require('../data/organigrama');
const auditoria = require('./auditoria');

const PERMS_LLAVE = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.EmbedLinks,
];

const ESTADO = {
  VISITANTE: 'PERM.VISITANTE',
  MIEMBRO: 'PERM.MIEMBRO',
  VERIFICADO: 'PERM.VERIFICADO',
  SUSPENDIDO: 'PERM.SUSPENDIDO',
};

const NIVELES_KEYS = ['PERM.N0', 'PERM.N1', 'PERM.N2', 'PERM.N3', 'PERM.N4', 'PERM.N5'];

function roleIdDeCargo(cargoKey) {
  const row = getDb().prepare('SELECT role_id FROM roles_map WHERE cargo_key = ?').get(cargoKey);
  return row?.role_id || null;
}

function roleIdDePermiso(key) {
  return roleIdDeCargo(key);
}

function areaKey(area) {
  if (!area) return null;
  return `AREA.${String(area).toLowerCase()}`;
}

async function addRoleByKey(guild, member, key, reason) {
  const id = roleIdDeCargo(key);
  if (!id) return false;
  const rol = guild.roles.cache.get(id);
  if (!rol || !rol.editable) return false;
  if (!member.roles.cache.has(id)) {
    await member.roles.add(rol, reason).catch(() => {});
  }
  return true;
}

async function removeRoleByKey(guild, member, key, reason) {
  const id = roleIdDeCargo(key);
  if (!id || !member.roles.cache.has(id)) return false;
  const rol = guild.roles.cache.get(id);
  if (!rol || !rol.editable) return false;
  await member.roles.remove(rol, reason).catch(() => {});
  return true;
}

async function quitarRolesDeOrganigrama(member) {
  const map = getDb().prepare('SELECT role_id, cargo_key FROM roles_map').all();
  const organigramaKeys = new Set(getTodosCargos().map((c) => c.key));
  const aQuitar = [];
  for (const row of map) {
    if (!organigramaKeys.has(row.cargo_key)) continue;
    if (member.roles.cache.has(row.role_id)) aQuitar.push(row.role_id);
  }
  if (aQuitar.length) {
    await member.roles.remove(aQuitar, 'Aegis · cambio de cargo').catch(() => {});
  }
}

async function quitarRolesDeArea(member) {
  const map = getDb().prepare("SELECT role_id FROM roles_map WHERE cargo_key LIKE 'AREA.%'").all();
  const aQuitar = map.filter((r) => member.roles.cache.has(r.role_id)).map((r) => r.role_id);
  if (aQuitar.length) {
    await member.roles.remove(aQuitar, 'Aegis · cambio de area').catch(() => {});
  }
}

async function quitarRolesDeNivel(member) {
  for (const k of NIVELES_KEYS) {
    await removeRoleByKey(member.guild, member, k, 'Aegis · cambio de nivel');
  }
}

function asegurarPerfil(discordId) {
  const db = getDb();
  const p = db.prepare('SELECT * FROM perfiles WHERE discord_id = ?').get(discordId);
  if (p) return p;
  db.prepare(`INSERT INTO perfiles (discord_id, estado) VALUES (?, 'Visitante')`).run(discordId);
  return db.prepare('SELECT * FROM perfiles WHERE discord_id = ?').get(discordId);
}

async function aplicarCuarentena(guild, member) {
  asegurarPerfil(member.id);
  getDb().prepare(
    `UPDATE perfiles SET estado = 'Visitante', actualizado_en = datetime('now') WHERE discord_id = ?`
  ).run(member.id);
  await addRoleByKey(guild, member, ESTADO.VISITANTE, 'Aegis · ingreso · cuarentena');
  await removeRoleByKey(guild, member, ESTADO.MIEMBRO, 'Aegis · ingreso · cuarentena');
  auditoria.registrar(member.id, 'INGRESO.CUARENTENA', {});
}

async function promoverAMiembro(guild, member, areaKeyRaw, actorTag) {
  const db = getDb();
  asegurarPerfil(member.id);
  await removeRoleByKey(guild, member, ESTADO.VISITANTE, `Aegis · aprobado · ${actorTag}`);
  await addRoleByKey(guild, member, ESTADO.MIEMBRO, `Aegis · aprobado · ${actorTag}`);
  await addRoleByKey(guild, member, ESTADO.VERIFICADO, `Aegis · aprobado · ${actorTag}`);
  if (areaKeyRaw) {
    await setArea(guild, member, areaKeyRaw, actorTag);
  }
  db.prepare(`UPDATE perfiles SET estado = 'Activo', actualizado_en = datetime('now') WHERE discord_id = ?`).run(member.id);
  auditoria.registrar(member.id, 'MIEMBRO.PROMOVER', { area: areaKeyRaw, actor: actorTag });
}

function siguienteHistorial() {
  const db = getDb();
  const row = db.prepare("SELECT valor FROM contadores WHERE tipo = 'AP'").get();
  const nuevo = (row ? row.valor : 0) + 1;
  db.prepare("UPDATE contadores SET valor = ? WHERE tipo = 'AP'").run(nuevo);
  return `AP-${String(nuevo).padStart(4, '0')}`;
}

async function asignarCargo(guild, member, cargoKey, actorTag, motivo = null) {
  const cargo = getCargoPorKey(cargoKey);
  if (!cargo) throw new Error('Cargo no encontrado en el organigrama');

  const db = getDb();
  const perfil = asegurarPerfil(member.id);
  const rangoAnterior = perfil?.cargo || null;

  await quitarRolesDeOrganigrama(member);
  const roleId = roleIdDeCargo(cargoKey);
  if (roleId) {
    const rol = guild.roles.cache.get(roleId);
    if (rol && rol.editable) {
      await member.roles.add(rol, `Aegis · cargo ${cargo.nombre} · ${actorTag}`);
    }
  }

  if (cargo.rama) {
    await setArea(guild, member, cargo.rama, actorTag);
  }

  db.prepare(`
    UPDATE perfiles SET cargo = ?, area = ?, estado = 'Activo', actualizado_en = datetime('now')
    WHERE discord_id = ?
  `).run(cargo.nombre, cargo.nombreRama || cargo.rama, member.id);

  await removeRoleByKey(guild, member, ESTADO.VISITANTE, `Aegis · cargo · ${actorTag}`);
  await addRoleByKey(guild, member, ESTADO.MIEMBRO, `Aegis · cargo · ${actorTag}`);

  const num = siguienteHistorial();
  db.prepare(`
    INSERT INTO historial_personal (numero, discord_id, tipo, area, rango_anterior, rango_nuevo, autorizado_por, motivo)
    VALUES (?, ?, 'asignacion', ?, ?, ?, ?, ?)
  `).run(num, member.id, cargo.nombreRama || cargo.rama, rangoAnterior, cargo.nombre, actorTag, motivo || 'Asignacion de cargo');

  auditoria.registrar(member.id, 'CARGO.ASIGNAR', { cargoKey, actor: actorTag, motivo });
  return { cargo, numeroHistorial: num };
}

async function setAutorizacion(guild, member, nivel, actorTag) {
  const n = Number(nivel);
  if (Number.isNaN(n) || n < 0 || n > 5) throw new Error('Nivel invalido');

  await quitarRolesDeNivel(member);
  await addRoleByKey(guild, member, `PERM.N${n}`, `Aegis · autorizacion N${n} · ${actorTag}`);

  getDb().prepare(`UPDATE perfiles SET nivel_auth = ?, actualizado_en = datetime('now') WHERE discord_id = ?`).run(n, member.id);
  auditoria.registrar(member.id, 'AUTH.OTORGAR', { nivel: n, actor: actorTag });
  return { nivel: n };
}

async function setArea(guild, member, area, actorTag) {
  const key = String(area || '').toLowerCase();
  if (!key) throw new Error('Area vacia');

  await quitarRolesDeArea(member);
  await addRoleByKey(guild, member, areaKey(key), `Aegis · area ${key} · ${actorTag}`);

  const nombreVisible = ORGANIGRAMA[key]?.nombre || key;
  getDb().prepare(`UPDATE perfiles SET area = ?, actualizado_en = datetime('now') WHERE discord_id = ?`).run(nombreVisible, member.id);
  auditoria.registrar(member.id, 'AREA.ASIGNAR', { area: key, actor: actorTag });
  return { area: nombreVisible, key };
}

async function marcarVerificado(guild, member) {
  await addRoleByKey(guild, member, ESTADO.VERIFICADO, 'Aegis · Roblox verificado');
  getDb().prepare(`UPDATE perfiles SET verificado = 1, actualizado_en = datetime('now') WHERE discord_id = ?`).run(member.id);
}

async function aplicarSuspension(guild, member, actorTag) {
  await addRoleByKey(guild, member, ESTADO.SUSPENDIDO, `Aegis · sancion · ${actorTag}`);
  getDb().prepare(`UPDATE perfiles SET estado = 'Suspendido', actualizado_en = datetime('now') WHERE discord_id = ?`).run(member.id);
}

async function levantarSuspension(guild, member, actorTag) {
  await removeRoleByKey(guild, member, ESTADO.SUSPENDIDO, `Aegis · levantamiento · ${actorTag}`);
  getDb().prepare(`UPDATE perfiles SET estado = 'Activo', actualizado_en = datetime('now') WHERE discord_id = ?`).run(member.id);
}

async function otorgarLlave(guild, member, llaveId, actorTag, motivo = null) {
  const db = getDb();
  const llave = db.prepare('SELECT * FROM llaves WHERE id = ? AND activa = 1').get(llaveId);
  if (!llave) throw new Error('Llave no encontrada');

  const ya = db.prepare(
    'SELECT id FROM llaves_titulares WHERE llave_id = ? AND discord_id = ? AND activa = 1'
  ).get(llaveId, member.id);
  if (ya) throw new Error('El miembro ya tiene esta llave');

  db.prepare(`
    INSERT INTO llaves_titulares (llave_id, discord_id, origen, otorgada_por, motivo, activa)
    VALUES (?, ?, 'manual', ?, ?, 1)
  `).run(llaveId, member.id, actorTag, motivo || 'Otorgamiento manual');

  let roleId = llave.role_id || roleIdDeCargo(llaveId);
  if (!roleId && llave.nombre_rol) {
    const found = guild.roles.cache.find((r) => r.name === llave.nombre_rol);
    if (found) roleId = found.id;
  }
  if (roleId) {
    const rol = guild.roles.cache.get(roleId);
    if (rol?.editable) {
      await member.roles.add(rol, `Aegis · llave ${llave.id} · ${actorTag}`);
    }
    if (!llave.role_id) {
      db.prepare('UPDATE llaves SET role_id = ? WHERE id = ?').run(roleId, llaveId);
    }
  }

  let canales = [];
  try { canales = JSON.parse(llave.canales_json || '[]'); } catch (_) { canales = []; }
  for (const channelId of canales) {
    const ch = guild.channels.cache.get(channelId);
    if (!ch || !ch.permissionOverwrites) continue;
    try {
      await ch.permissionOverwrites.edit(member.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        EmbedLinks: true,
      }, { reason: `Aegis · llave ${llave.id}` });
    } catch (err) {
      console.error('[Llave overwrite]', channelId, err.message);
    }
  }

  auditoria.registrar(member.id, 'LLAVE.OTORGAR', { llaveId, actor: actorTag, motivo });
  return llave;
}

async function revocarLlave(guild, member, llaveId, actorTag) {
  const db = getDb();
  const llave = db.prepare('SELECT * FROM llaves WHERE id = ?').get(llaveId);
  if (!llave) throw new Error('Llave no encontrada');

  db.prepare(`UPDATE llaves_titulares SET activa = 0 WHERE llave_id = ? AND discord_id = ? AND activa = 1`).run(llaveId, member.id);

  const roleId = llave.role_id || roleIdDeCargo(llaveId);
  if (roleId && member.roles.cache.has(roleId)) {
    const rol = guild.roles.cache.get(roleId);
    if (rol?.editable) {
      await member.roles.remove(rol, `Aegis · revocar llave ${llaveId} · ${actorTag}`);
    }
  }

  let canales = [];
  try { canales = JSON.parse(llave.canales_json || '[]'); } catch (_) { canales = []; }
  for (const channelId of canales) {
    const ch = guild.channels.cache.get(channelId);
    if (!ch || !ch.permissionOverwrites) continue;
    try {
      await ch.permissionOverwrites.delete(member.id, `Aegis · revocar llave ${llaveId}`);
    } catch (_) {}
  }

  auditoria.registrar(member.id, 'LLAVE.REVOCAR', { llaveId, actor: actorTag });
  return llave;
}

function listarCargosChoices() {
  return getTodosCargos().map((c) => ({
    name: `${c.prefijo} ${c.nombre}`.slice(0, 100),
    value: c.key,
  }));
}

module.exports = {
  ESTADO,
  roleIdDeCargo,
  roleIdDePermiso,
  areaKey,
  addRoleByKey,
  removeRoleByKey,
  asegurarPerfil,
  aplicarCuarentena,
  promoverAMiembro,
  asignarCargo,
  setAutorizacion,
  setArea,
  marcarVerificado,
  aplicarSuspension,
  levantarSuspension,
  otorgarLlave,
  revocarLlave,
  listarCargosChoices,
  PERMS_LLAVE,
  ROLES_PERMISOS,
};

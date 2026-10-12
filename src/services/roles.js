/**
 * Servicio de roles · Fundacion Aegis-Meridian
 * Asigna cargos, niveles de autorizacion y llaves de canal.
 */

const { PermissionFlagsBits } = require('discord.js');
const { getDb } = require('../db');
const { getTodosCargos, getCargoPorKey, ROLES_PERMISOS } = require('../data/organigrama');
const auditoria = require('./auditoria');

const PERMS_LLAVE = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.EmbedLinks,
];

function roleIdDeCargo(cargoKey) {
  const row = getDb().prepare('SELECT role_id FROM roles_map WHERE cargo_key = ?').get(cargoKey);
  return row?.role_id || null;
}

function roleIdDePermiso(key) {
  return roleIdDeCargo(key);
}

async function quitarRolesDeOrganigrama(member) {
  const map = getDb().prepare('SELECT role_id FROM roles_map').all();
  const ids = new Set(map.map((r) => r.role_id));
  const aQuitar = member.roles.cache.filter((r) => ids.has(r.id));
  if (aQuitar.size) {
    await member.roles.remove([...aQuitar.keys()], 'Aegis · cambio de cargo');
  }
}

/**
 * Asigna cargo de organigrama a un miembro: actualiza perfil, rol Discord e historial.
 */
async function asignarCargo(guild, member, cargoKey, actorTag, motivo = null) {
  const cargo = getCargoPorKey(cargoKey);
  if (!cargo) throw new Error('Cargo no encontrado en el organigrama');

  const db = getDb();
  const perfil = db.prepare('SELECT * FROM perfiles WHERE discord_id = ?').get(member.id);
  const rangoAnterior = perfil?.cargo || null;

  const roleId = roleIdDeCargo(cargoKey);
  if (roleId) {
    await quitarRolesDeOrganigrama(member);
    const rol = guild.roles.cache.get(roleId);
    if (rol && rol.editable) {
      await member.roles.add(rol, `Aegis · cargo ${cargo.nombre} · ${actorTag}`);
    }
  }

  db.prepare(`
    UPDATE perfiles SET cargo = ?, area = ?, actualizado_en = datetime('now')
    WHERE discord_id = ?
  `).run(cargo.nombre, cargo.nombreRama || cargo.rama, member.id);

  const num = siguienteHistorial();
  db.prepare(`
    INSERT INTO historial_personal (numero, discord_id, tipo, area, rango_anterior, rango_nuevo, autorizado_por, motivo)
    VALUES (?, ?, 'asignacion', ?, ?, ?, ?, ?)
  `).run(
    num,
    member.id,
    cargo.nombreRama || cargo.rama,
    rangoAnterior,
    cargo.nombre,
    actorTag,
    motivo || 'Asignacion de cargo'
  );

  auditoria.registrar(member.id, 'PERSONAL.ASIGNAR', {
    cargo: cargoKey,
    actor: actorTag,
    motivo,
  });

  return { cargo, rangoAnterior, roleId };
}

function siguienteHistorial() {
  const db = getDb();
  let c = db.prepare("SELECT valor FROM contadores WHERE tipo = 'historial'").get();
  if (!c) {
    db.prepare("INSERT INTO contadores (tipo, valor) VALUES ('historial', 1)").run();
    return 'HP-0001';
  }
  const n = (c.valor || 0) + 1;
  db.prepare("UPDATE contadores SET valor = ? WHERE tipo = 'historial'").run(n);
  return `HP-${String(n).padStart(4, '0')}`;
}

/**
 * Establece nivel de autorizacion 0–5 y rol de permiso si existe.
 */
async function setAutorizacion(guild, member, nivel, actorTag, motivo = null) {
  const n = Math.max(0, Math.min(5, Number(nivel) || 0));
  const db = getDb();
  const perfil = db.prepare('SELECT * FROM perfiles WHERE discord_id = ?').get(member.id);
  const anterior = perfil?.nivel_auth ?? 0;

  // Quitar roles de nivel PERM.N*
  for (let i = 0; i <= 5; i++) {
    const rid = roleIdDePermiso(`PERM.N${i}`);
    if (rid && member.roles.cache.has(rid)) {
      const rol = guild.roles.cache.get(rid);
      if (rol?.editable) await member.roles.remove(rol, 'Aegis · cambio de autorizacion');
    }
  }

  const ridNuevo = roleIdDePermiso(`PERM.N${n}`);
  if (ridNuevo) {
    const rol = guild.roles.cache.get(ridNuevo);
    if (rol?.editable) await member.roles.add(rol, `Aegis · auth N${n} · ${actorTag}`);
  }

  db.prepare(`
    UPDATE perfiles SET nivel_auth = ?, actualizado_en = datetime('now') WHERE discord_id = ?
  `).run(n, member.id);

  auditoria.registrar(member.id, 'AUTORIZACION.SET', {
    nivel: n, anterior, actor: actorTag, motivo,
  });

  return { nivel: n, anterior };
}

async function setArea(guild, member, area, actorTag) {
  const db = getDb();
  db.prepare(`
    UPDATE perfiles SET area = ?, actualizado_en = datetime('now') WHERE discord_id = ?
  `).run(area, member.id);

  auditoria.registrar(member.id, 'AREA.ASIGNAR', { area, actor: actorTag });
  return { area };
}

/**
 * Otorga una llave: registra titular y aplica overwrites en canales vinculados.
 */
async function otorgarLlave(guild, member, llaveId, actorTag, motivo = null) {
  const db = getDb();
  const llave = db.prepare('SELECT * FROM llaves WHERE id = ? AND activa = 1').get(llaveId);
  if (!llave) throw new Error('Llave no encontrada o inactiva');

  const existente = db.prepare(
    'SELECT id FROM llaves_titulares WHERE llave_id = ? AND discord_id = ? AND activa = 1'
  ).get(llaveId, member.id);
  if (existente) throw new Error('El miembro ya posee esta llave');

  db.prepare(`
    INSERT INTO llaves_titulares (llave_id, discord_id, origen, otorgada_por, motivo, activa)
    VALUES (?, ?, 'manual', ?, ?, 1)
  `).run(llaveId, member.id, actorTag, motivo || 'Otorgamiento manual');

  // Rol de llave si existe
  if (llave.role_id) {
    const rol = guild.roles.cache.get(llave.role_id);
    if (rol?.editable) {
      await member.roles.add(rol, `Aegis · llave ${llave.id} · ${actorTag}`);
    }
  }

  // Overwrites en canales
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

  db.prepare(`
    UPDATE llaves_titulares SET activa = 0 WHERE llave_id = ? AND discord_id = ? AND activa = 1
  `).run(llaveId, member.id);

  if (llave.role_id && member.roles.cache.has(llave.role_id)) {
    const rol = guild.roles.cache.get(llave.role_id);
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
  roleIdDeCargo,
  asignarCargo,
  setAutorizacion,
  setArea,
  otorgarLlave,
  revocarLlave,
  listarCargosChoices,
  PERMS_LLAVE,
  ROLES_PERMISOS,
};

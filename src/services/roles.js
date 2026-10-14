/**
 * Servicio de roles · Fundacion Aegis-Meridian
 * Todo otorgamiento (cargo, area, nivel, llave, estado) se refleja en roles Discord.
 */

const { PermissionFlagsBits } = require('discord.js');
const { getDb } = require('../db');
const {
  getTodosCargos,
  getCargoPorKey,
  getJerarquiaCompleta,
  ROLES_PERMISOS,
  ORGANIGRAMA,
  nombreBaseRol,
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

function normalizar(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function guardarMapa(cargoKey, roleId, nombreRol) {
  try {
    getDb().prepare(`
      INSERT INTO roles_map (cargo_key, role_id, nombre_rol)
      VALUES (?, ?, ?)
      ON CONFLICT(cargo_key) DO UPDATE SET
        role_id = excluded.role_id,
        nombre_rol = excluded.nombre_rol,
        actualizado_en = datetime('now')
    `).run(cargoKey, roleId, nombreRol);
  } catch (err) {
    console.warn('[roles_map]', err.message);
  }
}

function itemCatalogo(key) {
  if (!key) return null;
  const cargo = getCargoPorKey(key);
  if (cargo) return cargo;
  return getJerarquiaCompleta().find((i) => i.key === key) || null;
}

/** Resuelve role_id: mapa → nombre oficial en el guild. */
function roleIdDeCargo(cargoKey, guild = null) {
  const row = getDb().prepare('SELECT role_id FROM roles_map WHERE cargo_key = ?').get(cargoKey);
  if (row?.role_id) {
    if (!guild || guild.roles.cache.has(row.role_id)) return row.role_id;
  }

  if (!guild) return null;

  const item = itemCatalogo(cargoKey);
  if (!item) return null;

  const oficial = normalizar(item.nombreRol || '');
  const base = normalizar(item.nombre || '');
  const keyNorm = normalizar(String(cargoKey).replace(/\./g, ' '));

  for (const [, rol] of guild.roles.cache) {
    if (rol.managed || rol.id === guild.id) continue;
    const n = normalizar(rol.name);
    const nb = normalizar(typeof nombreBaseRol === 'function' ? nombreBaseRol(rol.name) : rol.name);
    if (
      (oficial && (n === oficial || nb === oficial)) ||
      (base && base.length > 3 && (nb === base || n.endsWith(base) || n.includes(base))) ||
      (keyNorm && n.includes(keyNorm))
    ) {
      guardarMapa(cargoKey, rol.id, rol.name);
      return rol.id;
    }
  }
  return null;
}

function roleIdDePermiso(key, guild = null) {
  return roleIdDeCargo(key, guild);
}

function areaKey(area) {
  if (!area) return null;
  const raw = String(area).trim();
  const lower = raw.toLowerCase();

  if (ORGANIGRAMA[lower]) return `AREA.${lower}`;

  for (const [k, rama] of Object.entries(ORGANIGRAMA)) {
    if (normalizar(rama.nombre) === normalizar(raw)) return `AREA.${k}`;
  }

  const sinPrefijo = lower.replace(/^area[\.\s·]+/i, '').trim();
  if (ORGANIGRAMA[sinPrefijo]) return `AREA.${sinPrefijo}`;

  return `AREA.${sinPrefijo.replace(/\s+/g, '_')}`;
}

async function addRoleByKey(guild, member, key, reason) {
  if (!guild || !member || !key) return { ok: false, motivo: 'parametros' };

  await guild.roles.fetch().catch(() => {});

  const id = roleIdDeCargo(key, guild);
  if (!id) {
    console.warn('[roles] sin role_id para', key);
    return { ok: false, motivo: 'sin_mapa', key };
  }

  const rol = guild.roles.cache.get(id);
  if (!rol) return { ok: false, motivo: 'rol_inexistente', key, id };

  const me = guild.members.me;
  if (!rol.editable || (me && rol.position >= me.roles.highest.position)) {
    console.warn('[roles] no editable / jerarquia', key, rol.name);
    return { ok: false, motivo: 'jerarquia', key, nombre: rol.name };
  }

  if (!member.roles.cache.has(id)) {
    try {
      await member.roles.add(rol, reason || `Aegis · ${key}`);
    } catch (err) {
      console.error('[roles] add', key, err.message);
      return { ok: false, motivo: err.message, key };
    }
  }
  return { ok: true, key, id, nombre: rol.name };
}

async function removeRoleByKey(guild, member, key, reason) {
  if (!guild || !member || !key) return false;
  const id = roleIdDeCargo(key, guild);
  if (!id || !member.roles.cache.has(id)) return false;
  const rol = guild.roles.cache.get(id);
  if (!rol || !rol.editable) return false;
  try {
    await member.roles.remove(rol, reason || `Aegis · quitar ${key}`);
  } catch (err) {
    console.error('[roles] remove', key, err.message);
    return false;
  }
  return true;
}

/** Quita todos los roles de cargo del organigrama (mapa + coincidencia por nombre). */
async function quitarRolesDeOrganigrama(member) {
  const guild = member.guild;
  await guild.roles.fetch().catch(() => {});

  const aQuitar = new Set();
  const organigramaKeys = new Set(getTodosCargos().map((c) => c.key));
  const map = getDb().prepare('SELECT role_id, cargo_key FROM roles_map').all();

  for (const row of map) {
    if (!organigramaKeys.has(row.cargo_key)) continue;
    if (member.roles.cache.has(row.role_id)) aQuitar.add(row.role_id);
  }

  // Por nombre: cualquier rol del miembro que coincida con un cargo del organigrama
  const cargos = getTodosCargos();
  for (const [, rol] of member.roles.cache) {
    if (rol.managed || rol.id === guild.id) continue;
    const n = normalizar(rol.name);
    const nb = normalizar(typeof nombreBaseRol === 'function' ? nombreBaseRol(rol.name) : rol.name);
    for (const c of cargos) {
      const oficial = normalizar(c.nombreRol || '');
      const base = normalizar(c.nombre || '');
      if (
        (oficial && (n === oficial || nb === oficial)) ||
        (base && base.length > 3 && (nb === base || n.endsWith(base)))
      ) {
        aQuitar.add(rol.id);
        guardarMapa(c.key, rol.id, rol.name);
        break;
      }
    }
  }

  if (aQuitar.size) {
    await member.roles
      .remove([...aQuitar], 'Aegis · cambio de cargo')
      .catch((err) => console.error('[roles] quitar organigrama', err.message));
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
  getDb()
    .prepare(`UPDATE perfiles SET estado = 'Visitante', actualizado_en = datetime('now') WHERE discord_id = ?`)
    .run(member.id);
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
    await setArea(guild, member, areaKeyRaw, actorTag).catch((err) => {
      console.warn('[promover area]', err.message);
    });
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

/**
 * Asigna cargo del organigrama:
 * 1) Quita cargos previos (Discord)
 * 2) Otorga rol Discord del cargo
 * 3) Otorga rol Discord del area
 * 4) Actualiza ficha (cargo + area)
 * 5) Miembro / quita Visitante
 */
async function asignarCargo(guild, member, cargoKey, actorTag, motivo = null) {
  const cargo = getCargoPorKey(cargoKey);
  if (!cargo) throw new Error('Cargo no encontrado en el organigrama');

  await guild.roles.fetch().catch(() => {});
  await member.fetch(true).catch(() => {});

  const db = getDb();
  const perfil = asegurarPerfil(member.id);
  const rangoAnterior = perfil?.cargo || null;

  await quitarRolesDeOrganigrama(member);

  // 1) Rol Discord del cargo (obligatorio)
  const rolCargo = await addRoleByKey(
    guild,
    member,
    cargoKey,
    `Aegis · cargo ${cargo.nombre} · ${actorTag}`
  );

  if (!rolCargo.ok) {
    if (rolCargo.motivo === 'sin_mapa') {
      throw new Error(
        `No hay rol Discord para el cargo «${cargo.nombre}» (${cargo.nombreRol || cargoKey}). ` +
          'Ejecuta /config_roles → Crear roles y Ordenar. ' +
          'El rol del bot debe quedar por encima de ese cargo.'
      );
    }
    if (rolCargo.motivo === 'jerarquia') {
      throw new Error(
        `El bot no puede asignar el rol «${rolCargo.nombre || cargo.nombre}». ` +
          'Sube el rol del bot por encima de ese cargo en Ajustes del servidor → Roles.'
      );
    }
    throw new Error(`No se pudo otorgar el rol de cargo: ${rolCargo.motivo}`);
  }

  // 2) Rol Discord del area (si existe; no bloquea el cargo)
  let rolArea = null;
  let areaNombre = cargo.nombreRama || cargo.rama || null;
  if (cargo.rama) {
    try {
      const r = await setArea(guild, member, cargo.rama, actorTag);
      rolArea = r.rolOtorgado || null;
      areaNombre = r.area || areaNombre;
    } catch (err) {
      console.warn('[asignarCargo area]', err.message);
      // Actualiza ficha de area aunque no haya rol Discord
      db.prepare(
        `UPDATE perfiles SET area = ?, actualizado_en = datetime('now') WHERE discord_id = ?`
      ).run(areaNombre, member.id);
    }
  }

  // 3) Ficha: cargo + area
  db.prepare(`
    UPDATE perfiles SET cargo = ?, area = ?, estado = 'Activo', actualizado_en = datetime('now')
    WHERE discord_id = ?
  `).run(cargo.nombre, areaNombre, member.id);

  // 4) Estado miembro
  await removeRoleByKey(guild, member, ESTADO.VISITANTE, `Aegis · cargo · ${actorTag}`);
  const rolMiembro = await addRoleByKey(guild, member, ESTADO.MIEMBRO, `Aegis · cargo · ${actorTag}`);

  const num = siguienteHistorial();
  db.prepare(`
    INSERT INTO historial_personal (numero, discord_id, tipo, area, rango_anterior, rango_nuevo, autorizado_por, motivo)
    VALUES (?, ?, 'asignacion', ?, ?, ?, ?, ?)
  `).run(
    num,
    member.id,
    areaNombre,
    rangoAnterior,
    cargo.nombre,
    actorTag,
    motivo || 'Asignacion de cargo'
  );

  auditoria.registrar(member.id, 'CARGO.ASIGNAR', {
    cargoKey,
    actor: actorTag,
    motivo,
    rolCargo: rolCargo.nombre,
    rolArea,
  });

  return {
    cargo,
    numeroHistorial: num,
    rangoAnterior,
    rolOtorgado: rolCargo.nombre,
    rolId: rolCargo.id,
    rolArea,
    area: areaNombre,
    rolMiembro: rolMiembro.ok ? rolMiembro.nombre : null,
  };
}

async function setAutorizacion(guild, member, nivel, actorTag, motivo = null) {
  const n = Number(nivel);
  if (Number.isNaN(n) || n < 0 || n > 5) throw new Error('Nivel invalido');

  await guild.roles.fetch().catch(() => {});

  const perfil = asegurarPerfil(member.id);
  const anterior = perfil?.nivel_auth ?? 0;

  await quitarRolesDeNivel(member);
  const otorgado = await addRoleByKey(
    guild,
    member,
    `PERM.N${n}`,
    `Aegis · autorizacion N${n} · ${actorTag}`
  );

  if (!otorgado.ok && otorgado.motivo === 'sin_mapa') {
    throw new Error(
      `No existe el rol de Nivel ${n}. Ejecuta /config_roles → Crear roles (permisos).`
    );
  }
  if (!otorgado.ok && otorgado.motivo === 'jerarquia') {
    throw new Error(`El bot no puede asignar el rol de Nivel ${n} (jerarquia).`);
  }

  getDb()
    .prepare(`UPDATE perfiles SET nivel_auth = ?, actualizado_en = datetime('now') WHERE discord_id = ?`)
    .run(n, member.id);

  auditoria.registrar(member.id, 'AUTH.OTORGAR', {
    nivel: n,
    anterior,
    actor: actorTag,
    motivo,
  });

  return { nivel: n, anterior, rolOtorgado: otorgado.nombre || null };
}

async function setArea(guild, member, area, actorTag) {
  if (!area) throw new Error('Area vacia');

  await guild.roles.fetch().catch(() => {});

  const keyFull = areaKey(area);
  if (!keyFull) throw new Error('Area no reconocida');

  const ramaKey = keyFull.replace(/^AREA\./, '');
  const nombreVisible = ORGANIGRAMA[ramaKey]?.nombre || ramaKey;

  await quitarRolesDeArea(member);
  const otorgado = await addRoleByKey(
    guild,
    member,
    keyFull,
    `Aegis · area ${nombreVisible} · ${actorTag}`
  );

  if (!otorgado.ok && otorgado.motivo === 'sin_mapa') {
    throw new Error(
      `No existe el rol de area «${nombreVisible}». Ejecuta /config_roles → Crear roles.`
    );
  }
  if (!otorgado.ok && otorgado.motivo === 'jerarquia') {
    throw new Error(
      `El bot no puede asignar el rol de area «${nombreVisible}» (jerarquia).`
    );
  }

  asegurarPerfil(member.id);
  getDb()
    .prepare(`UPDATE perfiles SET area = ?, actualizado_en = datetime('now') WHERE discord_id = ?`)
    .run(nombreVisible, member.id);

  auditoria.registrar(member.id, 'AREA.ASIGNAR', {
    area: ramaKey,
    actor: actorTag,
    rol: otorgado.nombre,
  });

  return {
    area: nombreVisible,
    key: ramaKey,
    rolOtorgado: otorgado.nombre || null,
  };
}

async function marcarVerificado(guild, member) {
  await addRoleByKey(guild, member, ESTADO.VERIFICADO, 'Aegis · Roblox verificado');
  getDb()
    .prepare(`UPDATE perfiles SET verificado = 1, actualizado_en = datetime('now') WHERE discord_id = ?`)
    .run(member.id);
}

async function aplicarSuspension(guild, member, actorTag) {
  await addRoleByKey(guild, member, ESTADO.SUSPENDIDO, `Aegis · sancion · ${actorTag}`);
  getDb()
    .prepare(`UPDATE perfiles SET estado = 'Suspendido', actualizado_en = datetime('now') WHERE discord_id = ?`)
    .run(member.id);
}

async function levantarSuspension(guild, member, actorTag) {
  await removeRoleByKey(guild, member, ESTADO.SUSPENDIDO, `Aegis · levantamiento · ${actorTag}`);
  getDb()
    .prepare(`UPDATE perfiles SET estado = 'Activo', actualizado_en = datetime('now') WHERE discord_id = ?`)
    .run(member.id);
}

async function otorgarLlave(guild, member, llaveId, actorTag, motivo = null) {
  const db = getDb();
  await guild.roles.fetch().catch(() => {});

  const llave = db.prepare('SELECT * FROM llaves WHERE id = ? AND activa = 1').get(llaveId);
  if (!llave) throw new Error('Llave no encontrada');

  const ya = db
    .prepare('SELECT id FROM llaves_titulares WHERE llave_id = ? AND discord_id = ? AND activa = 1')
    .get(llaveId, member.id);
  if (ya) throw new Error('El miembro ya tiene esta llave');

  db.prepare(`
    INSERT INTO llaves_titulares (llave_id, discord_id, origen, otorgada_por, motivo, activa)
    VALUES (?, ?, 'manual', ?, ?, 1)
  `).run(llaveId, member.id, actorTag, motivo || 'Otorgamiento manual');

  let roleId = llave.role_id || roleIdDeCargo(llaveId, guild);
  if (!roleId && llave.nombre_rol) {
    const found = guild.roles.cache.find(
      (r) => normalizar(r.name) === normalizar(llave.nombre_rol)
    );
    if (found) {
      roleId = found.id;
      guardarMapa(llaveId, found.id, found.name);
    }
  }

  let rolNombre = null;
  if (roleId) {
    const rol = guild.roles.cache.get(roleId);
    if (rol?.editable) {
      const me = guild.members.me;
      if (!me || rol.position < me.roles.highest.position) {
        await member.roles.add(rol, `Aegis · llave ${llave.id} · ${actorTag}`).catch((err) => {
          console.error('[llave role]', err.message);
        });
        rolNombre = rol.name;
      }
    }
    if (!llave.role_id) {
      db.prepare('UPDATE llaves SET role_id = ? WHERE id = ?').run(roleId, llaveId);
    }
  }

  let canales = [];
  try {
    canales = JSON.parse(llave.canales_json || '[]');
  } catch (_) {
    canales = [];
  }
  for (const channelId of canales) {
    const ch = guild.channels.cache.get(channelId);
    if (!ch || !ch.permissionOverwrites) continue;
    try {
      await ch.permissionOverwrites.edit(
        member.id,
        {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          EmbedLinks: true,
        },
        { reason: `Aegis · llave ${llave.id}` }
      );
    } catch (err) {
      console.error('[Llave overwrite]', channelId, err.message);
    }
  }

  auditoria.registrar(member.id, 'LLAVE.OTORGAR', {
    llaveId,
    actor: actorTag,
    motivo,
    rol: rolNombre,
  });

  return { ...llave, rolOtorgado: rolNombre };
}

async function revocarLlave(guild, member, llaveId, actorTag) {
  const db = getDb();
  const llave = db.prepare('SELECT * FROM llaves WHERE id = ?').get(llaveId);
  if (!llave) throw new Error('Llave no encontrada');

  db.prepare(
    `UPDATE llaves_titulares SET activa = 0 WHERE llave_id = ? AND discord_id = ? AND activa = 1`
  ).run(llaveId, member.id);

  const roleId = llave.role_id || roleIdDeCargo(llaveId, guild);
  if (roleId && member.roles.cache.has(roleId)) {
    const rol = guild.roles.cache.get(roleId);
    if (rol?.editable) {
      await member.roles
        .remove(rol, `Aegis · revocar llave ${llaveId} · ${actorTag}`)
        .catch(() => {});
    }
  }

  let canales = [];
  try {
    canales = JSON.parse(llave.canales_json || '[]');
  } catch (_) {
    canales = [];
  }
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

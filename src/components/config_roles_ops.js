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
const { normalizarNombre, truncar, similitudDice } = require('../utils/helpers');

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
    if (/[━─═\-_]{3,}/.test(rolDiscord.name) && c2) {
      const raw = String(rolDiscord.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
      if (raw.includes(c2) || raw.includes(c2.slice(0, 5))) return true;
    }
    return false;
  }

  if (nom === oficial || base === oficial) return true;
  if (item.nombre) {
    const nn = normalizarNombre(item.nombre);
    if (base === nn || nom === nn) return true;
    if (nn.length >= 6 && (nom.includes(nn) || base.includes(nn))) return true;
  }
  if (item.key) {
    const k = normalizarNombre(String(item.key).replace(/\./g, ' '));
    if (k.length >= 4 && (nom.includes(k) || base.includes(k))) return true;
  }
  for (const a of item.aliases || []) {
    const na = normalizarNombre(a);
    if (na && (nom === na || base === na)) return true;
    if (na && na.length >= 5 && (nom.includes(na) || base.includes(na))) return true;
  }
  // fuzzy ultimo recurso
  if (oficial.length >= 8 && similitudDice(oficial, nom) >= 0.82) return true;
  if (item.nombre && similitudDice(item.nombre, base) >= 0.85) return true;
  return false;
}

function escanear(guild) {
  const roles = [...guild.roles.cache.values()].filter((r) => r.id !== guild.id && !r.managed);
  const catalogo = getJerarquiaCompleta();
  const usados = new Set();
  const detectados = [];
  const faltantes = [];
  const aRenombrar = [];

  // 1) roles_map primero
  let mapaRows = [];
  try {
    mapaRows = getDb().prepare('SELECT cargo_key, role_id, nombre_rol FROM roles_map').all();
  } catch (_) {}
  const mapaPorKey = Object.fromEntries(mapaRows.map((r) => [r.cargo_key, r]));

  for (const item of catalogo) {
    let match = null;
    const row = mapaPorKey[item.key];
    if (row?.role_id) {
      const r = guild.roles.cache.get(row.role_id);
      if (r && !usados.has(r.id) && !r.managed) match = r;
    }
    if (!match) {
      for (const rol of roles) {
        if (usados.has(rol.id)) continue;
        if (existeExacto(rol, item)) {
          match = rol;
          break;
        }
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
        footer: 'Usa Crear roles',
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
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      fallos.push(name);
      console.error('[Crear]', name, e.message || e);
    }
  }

  let ordenInfo = '';
  try {
    const r = await ordenarRoles(guild, interaction.user.tag);
    ordenInfo = `\nOrdenados: **${r.movidos}**`;
  } catch (e) {
    console.error('[Orden post-crear]', e);
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.CREAR', { creados, sepsCreados });
  await interaction.editReply({
    embeds: [
      embedBase({
        color: COLORES.medicina,
        titulo: 'Creacion completada',
        descripcion: `Creados: **${creados}** (seps: **${sepsCreados}**)${fallos.length ? `\nFallos: ${fallos.length}` : ''}${ordenInfo}`,
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
      await new Promise((x) => setTimeout(x, 150));
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
  await interaction.guild.roles.fetch().catch(() => {});
  const { detectados } = escanear(interaction.guild);
  const botPos = interaction.guild.members.me?.roles?.highest?.position ?? 0;
  const editables = detectados.filter((d) => d.rol.editable && d.rol.position < botPos).length;
  await interaction.editReply({
    embeds: [
      embedBase({
        color: COLORES.neutral,
        titulo: 'Ordenar roles',
        descripcion:
          `Detectados: **${detectados.length}** · Editables bajo el bot: **${editables}**\n` +
          `Posicion del bot: **${botPos}**\n\n` +
          'Al confirmar se reordenan **en un lote** (FUNDACION arriba → LLAVES abajo, con separadores).',
        footer: 'Administracion',
      }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`config_roles:organizar_ejecutar:${interaction.user.id}`)
          .setLabel('Ordenar ahora')
          .setStyle(ButtonStyle.Success)
      ),
    ],
  });
}

/**
 * Orden FORZADO y RAPIDO.
 * 1) setPositions en lote
 * 2) si falla, setPosition uno a uno
 * Discord: mayor position = mas arriba.
 */
async function ordenarRoles(guild, tag) {
  await guild.roles.fetch();
  const me = guild.members.me;
  if (!me) return { movidos: 0, separadores: 0, fallos: 0, total: 0, botPos: 0, detectados: 0, error: 'sin_me' };

  const botPos = me.roles.highest.position;
  const { detectados } = escanear(guild);

  const candidatos = detectados
    .filter((d) => d.item && d.item.orden != null && d.rol && !d.rol.managed)
    .sort((a, b) => (a.item.orden || 0) - (b.item.orden || 0));

  // Solo los que el bot puede editar (por debajo del bot)
  const ordenados = candidatos.filter((d) => d.rol.position < botPos && d.rol.editable);

  let pos = botPos - 1;
  const payload = [];
  let separadores = 0;
  for (const d of ordenados) {
    if (pos < 1) break;
    payload.push({ role: d.rol.id, position: pos });
    if (d.item.tipo === 'separador' || String(d.item.key || '').startsWith('SEP.')) separadores += 1;
    pos -= 1;
  }

  let movidos = 0;
  let fallos = 0;
  let metodo = 'ninguno';
  let errorMsg = '';

  if (payload.length === 0) {
    return {
      movidos: 0,
      separadores: 0,
      fallos: 0,
      total: ordenados.length,
      detectados: detectados.length,
      botPos,
      metodo,
      error: detectados.length === 0 ? 'cero_detectados' : 'cero_editables',
    };
  }

  // A) Bulk oficial Discord
  try {
    await guild.roles.setPositions(payload);
    movidos = payload.length;
    metodo = 'setPositions';
  } catch (e) {
    errorMsg = String(e.message || e);
    console.error('[Orden setPositions]', errorMsg);

    // B) REST directo
    try {
      const body = payload.map((p) => ({ id: p.role, position: p.position }));
      await guild.client.rest.patch(`/guilds/${guild.id}/roles`, { body });
      movidos = payload.length;
      metodo = 'rest.patch';
    } catch (e2) {
      console.error('[Orden REST]', e2.message || e2);
      errorMsg = String(e2.message || e2);

      // C) Uno a uno (rapido, 80ms)
      metodo = 'setPosition';
      for (const p of payload) {
        try {
          const rol = guild.roles.cache.get(p.role);
          if (!rol) {
            fallos += 1;
            continue;
          }
          await rol.setPosition(p.position, { reason: `Aegis · orden · ${tag}` });
          movidos += 1;
          await new Promise((r) => setTimeout(r, 80));
        } catch (e3) {
          fallos += 1;
          console.error('[Orden one]', p.role, e3.message || e3);
        }
      }
    }
  }

  return {
    movidos,
    separadores,
    fallos,
    total: ordenados.length,
    detectados: detectados.length,
    botPos,
    metodo,
    error: errorMsg || undefined,
  };
}

async function onOrganizarEjecutar(interaction) {
  await interaction.deferUpdate();
  let info = {
    movidos: 0,
    separadores: 0,
    fallos: 0,
    total: 0,
    detectados: 0,
    botPos: 0,
    metodo: '-',
  };
  try {
    info = await ordenarRoles(interaction.guild, interaction.user.tag);
  } catch (e) {
    console.error('[Organizar]', e);
    info.error = String(e.message || e);
  }
  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ORDENAR', info);

  const lineas = [
    `Detectados: **${info.detectados}**`,
    `Editables en cadena: **${info.total}**`,
    `Movidos: **${info.movidos}**`,
    `Separadores: **${info.separadores}**`,
    info.fallos ? `Fallos: **${info.fallos}**` : null,
    `Posicion bot: **${info.botPos}**`,
    `Metodo: **${info.metodo || '-'}**`,
  ];
  if (info.movidos === 0) {
    if (info.error === 'cero_detectados') {
      lineas.push('', '**No se detecto ningun rol del organigrama.** Usa **Analizar** y luego **Crear**.');
    } else if (info.error === 'cero_editables') {
      lineas.push('', '**Ningun rol editable bajo el bot.** Revisa Manage Roles y que no esten por encima del bot.');
    } else if (info.error) {
      lineas.push('', `Error API: \`${String(info.error).slice(0, 180)}\`);
    }
  } else {
    lineas.push('', 'FUNDACION (arriba) → … → PERMISOS → LLAVES (abajo).');
  }

  await interaction.editReply({
    embeds: [
      embedBase({
        color: info.movidos > 0 ? COLORES.medicina : COLORES.denegado,
        titulo: info.movidos > 0 ? 'Roles ordenados' : 'No se pudo ordenar',
        descripcion: lineas.filter(Boolean).join('\n'),
        footer: 'Administracion · orden v3',
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
      await new Promise((r) => setTimeout(r, 150));
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

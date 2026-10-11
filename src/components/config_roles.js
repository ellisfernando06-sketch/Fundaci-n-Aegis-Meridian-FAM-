const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb } = require('../db');
const auditoria = require('../services/auditoria');
const { embedBase, COLORES } = require('../utils/plantillas');
const {
  ORGANIGRAMA,
  SEPARADORES,
  ROLES_PERMISOS,
  ROLES_IGNORAR,
  getTodosCargos,
  getJerarquiaCompleta,
  nombreBaseRol,
} = require('../data/organigrama');
const { normalizarNombre, similitudDice, truncar } = require('../utils/helpers');

const prefix = 'config_roles';

const EMOJI = {
  detectado: '✅', parcial: '⚠️', cargo: '📋', permiso: '🔐',
  sep: '➖', bot: '🤖', problema: '🔺', ok: '📌',
};

function esAdmin(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)
  );
}

function asegurarColumnaOrigen() {
  try { getDb().exec(`ALTER TABLE roles_map ADD COLUMN origen TEXT DEFAULT 'existente'`); } catch (_) {}
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

function debeIgnorar(nombre) {
  const n = normalizarNombre(nombre);
  return ROLES_IGNORAR.some((x) => n === normalizarNombre(x) || n.includes(normalizarNombre(x)));
}

/** Todos los items esperados (cargos + separadores + permisos) */
function catalogoCompleto() {
  return getJerarquiaCompleta();
}

/**
 * ¿El rol del servidor coincide con un item del catálogo?
 * Compara: nombre completo, nombre base, aliases.
 */
function coincideItem(rolDiscord, item) {
  const nomRol = normalizarNombre(rolDiscord.name);
  const baseRol = normalizarNombre(nombreBaseRol(rolDiscord.name));
  const nomEsp = normalizarNombre(item.nombreRol || item.nombre || '');
  const baseEsp = normalizarNombre(item.nombre || nombreBaseRol(item.nombreRol || ''));

  if (nomRol === nomEsp || baseRol === baseEsp || baseRol === nomEsp || nomRol === baseEsp) return 1;

  if (item.aliases) {
    for (const a of item.aliases) {
      const na = normalizarNombre(a);
      if (baseRol === na || nomRol === na) return 1;
      if (similitudDice(baseRol, na) >= 0.9) return 0.9;
    }
  }

  if (baseEsp && baseRol && similitudDice(baseRol, baseEsp) >= 0.9) return 0.9;
  return 0;
}

function escanearServidor(guild) {
  const roles = [...guild.roles.cache.values()].filter(
    (r) => r.id !== guild.id && !r.managed && !debeIgnorar(r.name)
  );
  const catalogo = catalogoCompleto();
  const detectados = [];
  const parciales = [];
  const faltantes = [];
  const usados = new Set();

  for (const item of catalogo) {
    let best = null;
    let bestScore = 0;
    for (const rol of roles) {
      if (usados.has(rol.id)) continue;
      const s = coincideItem(rol, item);
      if (s > bestScore) {
        bestScore = s;
        best = rol;
      }
    }
    if (best && bestScore >= 1) {
      detectados.push({ item, rol: best, score: bestScore });
      usados.add(best.id);
      guardarMapa(item.key, best.id, best.name, 'existente');
    } else if (best && bestScore >= 0.9) {
      parciales.push({ item, rol: best, score: bestScore });
      usados.add(best.id);
    } else {
      faltantes.push(item);
    }
  }

  const noUsados = roles.filter((r) => !usados.has(r.id));
  return { detectados, parciales, faltantes, noUsados, catalogo };
}

async function handle(interaction, accion, args) {
  if (!esAdmin(interaction)) {
    await interaction.reply({ content: 'No tienes autorización para esta acción.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }
  const ownerId = args[0];
  if (ownerId && ownerId !== interaction.user.id) {
    await interaction.reply({ content: 'Solo quien abrió el menú puede usarlo.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }
  switch (accion) {
    case 'menu': return onMenu(interaction);
    case 'crear_confirmar': return onCrearConfirmar(interaction);
    case 'crear_ejecutar': return onCrearEjecutar(interaction);
    case 'organizar_confirmar': return onOrganizarConfirmar(interaction);
    case 'organizar_ejecutar': return onOrganizarEjecutar(interaction);
    case 'eliminar_confirmar': return onEliminarConfirmar(interaction);
    case 'eliminar_ejecutar': return onEliminarEjecutar(interaction);
    default:
      await interaction.reply({ content: 'Acción no reconocida.', flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}

async function onMenu(interaction) {
  const opcion = interaction.values[0];
  switch (opcion) {
    case 'analizar': return analizar(interaction);
    case 'crear': return onCrearConfirmar(interaction);
    case 'organizar': return onOrganizarConfirmar(interaction);
    case 'eliminar_bot': return onEliminarConfirmar(interaction);
    case 'sincronizar': return analizar(interaction);
  }
}

async function analizar(interaction) {
  await interaction.deferUpdate();
  const guild = interaction.guild;
  await guild.roles.fetch();

  const { detectados, parciales, faltantes, noUsados } = escanearServidor(guild);

  const porTipo = (t) => faltantes.filter((f) => f.tipo === t);
  const embeds = [];

  embeds.push(embedBase({
    color: COLORES.neutral,
    titulo: '🧩 Informe de roles · Aegis-Meridian',
    campos: [
      { name: `${EMOJI.detectado} Detectados`, value: String(detectados.length), inline: true },
      { name: `${EMOJI.parcial} Parciales`, value: String(parciales.length), inline: true },
      { name: `${EMOJI.cargo} Faltantes`, value: String(faltantes.length), inline: true },
      { name: `${EMOJI.sep} Separadores faltantes`, value: String(porTipo('separador').length), inline: true },
      { name: `${EMOJI.permiso} Permisos faltantes`, value: String(porTipo('permiso').length), inline: true },
      { name: '📦 Otros en el servidor', value: String(noUsados.length), inline: true },
    ],
    footer: 'Formato oficial: XX ●┇Nombre · los roles ajenos no se tocan',
  }));

  if (detectados.length) {
    embeds.push(embedBase({
      color: COLORES.medicina,
      titulo: `${EMOJI.detectado} Roles detectados (se reutilizan)`,
      descripcion: truncar(
        detectados.slice(0, 20).map((d) => `${EMOJI.ok} **${d.rol.name}** → \`${d.item.key}\``).join('\n') +
        (detectados.length > 20 ? `\n… +${detectados.length - 20}` : '')
      ),
      footer: 'No se modifican nombres existentes',
      timestamp: false,
    }));
  }

  if (faltantes.length) {
    const lineas = faltantes.slice(0, 25).map((f) => {
      const emoji = f.tipo === 'separador' ? EMOJI.sep : f.tipo === 'permiso' ? EMOJI.permiso : EMOJI.cargo;
      return `${emoji} ${f.nombreRol || f.nombre}`;
    }).join('\n');
    embeds.push(embedBase({
      color: COLORES.denegado,
      titulo: `${EMOJI.cargo} Faltantes (${faltantes.length})`,
      descripcion: truncar(lineas + (faltantes.length > 25 ? `\n… +${faltantes.length - 25}` : '')),
      footer: 'Se crearán con formato XX ●┇Nombre',
      timestamp: false,
    }));
  }

  if (parciales.length) {
    embeds.push(embedBase({
      color: 0xe8b923,
      titulo: `${EMOJI.parcial} Coincidencias parciales`,
      descripcion: truncar(parciales.slice(0, 12).map((p) =>
        `${EMOJI.parcial} **${p.rol.name}** ≈ ${p.item.nombreRol || p.item.nombre}`
      ).join('\n')),
      footer: 'Revisa a mano si hace falta',
      timestamp: false,
    }));
  }

  if (noUsados.length) {
    embeds.push(embedBase({
      color: COLORES.neutral,
      titulo: '📦 Roles del servidor no usados por el organigrama',
      descripcion: truncar(
        noUsados.slice(0, 15).map((r) => `· ${r.name}`).join('\n') +
        (noUsados.length > 15 ? `\n… +${noUsados.length - 15}` : '') +
        '\n\nSe dejan intactos.'
      ),
      footer: 'Ignorados a propósito',
      timestamp: false,
    }));
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ANALIZAR', {
    detectados: detectados.length, faltantes: faltantes.length,
  });

  await interaction.editReply({ embeds: embeds.slice(0, 10), components: [] });
}

async function onCrearConfirmar(interaction) {
  const guild = interaction.guild;
  await guild.roles.fetch();
  const { faltantes } = escanearServidor(guild);

  if (!faltantes.length) {
    const payload = {
      embeds: [embedBase({
        color: COLORES.medicina,
        titulo: '🛠️ Crear faltantes',
        descripcion: `${EMOJI.detectado} No hay roles faltantes. Todo el organigrama está cubierto.`,
        footer: 'Administración',
      })],
      components: [],
    };
    if (interaction.isStringSelectMenu()) await interaction.update(payload).catch(() => {});
    else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  const preview = faltantes.slice(0, 25).map((f) => {
    const emoji = f.tipo === 'separador' ? EMOJI.sep : f.tipo === 'permiso' ? EMOJI.permiso : EMOJI.cargo;
    return `${emoji} ${f.nombreRol || f.nombre}`;
  }).join('\n');

  const btn = new ButtonBuilder()
    .setCustomId(`config_roles:crear_ejecutar:${interaction.user.id}`)
    .setLabel(`Crear ${faltantes.length} roles`)
    .setStyle(ButtonStyle.Success);

  const payload = {
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: `🛠️ Crear ${faltantes.length} faltantes`,
      descripcion: `Formato: **XX ●┇Nombre**\nLos roles ya detectados no se tocan.\n\n${preview}${faltantes.length > 25 ? `\n… +${faltantes.length - 25}` : ''}`,
      footer: 'Confirmación',
    })],
    components: [new ActionRowBuilder().addComponents(btn)],
  };
  if (interaction.isStringSelectMenu()) await interaction.update(payload).catch(() => {});
  else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
}

async function onCrearEjecutar(interaction) {
  await interaction.deferUpdate();
  const guild = interaction.guild;

  if (!guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.editReply({
      embeds: [embedBase({ color: COLORES.denegado, titulo: '🛠️ Sin permiso', descripcion: 'Se necesita **Manage Roles**.', footer: 'Administración' })],
      components: [],
    });
    return;
  }

  await guild.roles.fetch();
  const { faltantes, detectados } = escanearServidor(guild);

  // Estilo de referencia: hoist de roles de la misma rama si existe
  function estiloDe(item) {
    if (item.tipo === 'separador') return { hoist: false, mentionable: false };
    const rama = item.rama;
    const ref = detectados.find((d) => d.item.rama === rama);
    if (ref) return { hoist: ref.rol.hoist, mentionable: ref.rol.mentionable };
    return { hoist: false, mentionable: false };
  }

  let creados = 0;
  const errores = [];

  for (const item of faltantes) {
    try {
      const nombre = item.nombreRol || item.nombre;
      const colorHex = item.color || '#888780';
      const colorInt = parseInt(String(colorHex).replace('#', ''), 16);
      const estilo = estiloDe(item);

      const rol = await guild.roles.create({
        name: nombre,
        color: colorInt,
        hoist: item.tipo === 'separador' ? false : estilo.hoist,
        mentionable: false,
        reason: `Aegis · organigrama · ${interaction.user.tag}`,
      });

      guardarMapa(item.key, rol.id, rol.name, 'bot');
      creados++;
      await new Promise((r) => setTimeout(r, 350));
    } catch (err) {
      errores.push(item.nombreRol || item.nombre || item.key);
      console.error('[Crear rol]', err);
    }
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.CREAR', { creados, errores: errores.length });

  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: '🛠️ Roles creados',
      descripcion: `${EMOJI.detectado} Creados: **${creados}**${errores.length ? `\n${EMOJI.problema} Errores: ${errores.length}` : ''}\n\nUsa **Organizar jerarquía** para colocarlos en su posición con separadores.`,
      footer: 'Administración',
    })],
    components: [],
  });
}

async function onOrganizarConfirmar(interaction) {
  const payload = {
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: '📐 Organizar jerarquía',
      descripcion: 'Reordenará los roles del organigrama según la estructura oficial:\n\n1. Staff\n2. Soporte\n3. Cúpula\n4. Direcciones (**Gerente SI** encima de **Director General**)\n5. Seguridad Interna\n6. Facción Seguridad / FTM / ERR\n7. Medicina · Investigación · Inteligencia\n8. Clase D · Insurgencia\n9. Permisos\n\nSolo mueve roles del organigrama. El resto no se toca.',
      footer: 'Confirmación',
    })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`config_roles:organizar_ejecutar:${interaction.user.id}`)
        .setLabel('Organizar ahora')
        .setStyle(ButtonStyle.Primary)
    )],
  };
  if (interaction.isStringSelectMenu()) await interaction.update(payload).catch(() => {});
  else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
}

async function onOrganizarEjecutar(interaction) {
  await interaction.deferUpdate();
  const guild = interaction.guild;

  if (!guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.editReply({
      embeds: [embedBase({ color: COLORES.denegado, titulo: '📐 Sin permiso', descripcion: 'Se necesita **Manage Roles**.', footer: 'Administración' })],
      components: [],
    });
    return;
  }

  await guild.roles.fetch();
  const { detectados } = escanearServidor(guild);

  // Ordenar detectados por orden del organigrama (menor orden = más alto)
  const ordenados = [...detectados].sort(
    (a, b) => (a.item.orden || 999) - (b.item.orden || 999)
  );

  const botPos = guild.members.me.roles.highest.position;
  let movidos = 0;
  let fallos = 0;

  // Colocar desde el más bajo hacia el más alto para evitar conflictos de posición
  // Discord: position más alta = más arriba en la lista
  // Empezamos poniendo el de mayor orden (más bajo en jerarquía) justo encima de 1,
  // luego subimos.
  const invertidos = [...ordenados].reverse();

  for (const d of invertidos) {
    const rol = guild.roles.cache.get(d.rol.id);
    if (!rol || !rol.editable) { fallos++; continue; }
    if (rol.position >= botPos) { fallos++; continue; }

    try {
      // Posición relativa: ir subiendo de 1 en 1 desde abajo es lento;
      // usamos setPosition con índice acumulado bajo el bot.
      const targetPos = Math.max(1, Math.min(botPos - 1, movidos + 1));
      await rol.setPosition(targetPos, { reason: `Aegis · organizar · ${interaction.user.tag}` });
      movidos++;
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      fallos++;
      console.error('[Organizar]', rol.name, err.message || err);
    }
  }

  // Segunda pasada: orden estricto de arriba a abajo bajo el bot
  // Los de menor `orden` deben quedar más arriba (mayor position)
  await guild.roles.fetch();
  const botPos2 = guild.members.me.roles.highest.position;
  let pos = botPos2 - 1;
  for (const d of ordenados) {
    const rol = guild.roles.cache.get(d.rol.id);
    if (!rol || !rol.editable || rol.position >= botPos2) continue;
    try {
      if (pos < 1) break;
      await rol.setPosition(pos, { reason: `Aegis · organizar final · ${interaction.user.tag}` });
      pos--;
      await new Promise((r) => setTimeout(r, 450));
    } catch (err) {
      console.error('[Organizar final]', rol.name, err.message || err);
    }
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ORGANIZAR', { movidos, fallos });

  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: '📐 Jerarquía organizada',
      descripcion: `Roles reposicionados: **${movidos}**${fallos ? `\n${EMOJI.problema} Sin mover: ${fallos} (sube el rol del bot por encima)` : ''}\n\nGerente de Seguridad Interna queda por encima de Director General.`,
      footer: 'Administración',
    })],
    components: [],
  });
}

async function onEliminarConfirmar(interaction) {
  const guild = interaction.guild;
  await guild.roles.fetch();
  const db = getDb();
  asegurarColumnaOrigen();
  const delBot = db.prepare("SELECT * FROM roles_map WHERE origen = 'bot'").all();

  // También roles con formato XX ●┇ o [XX] que el bot puede editar
  const formatoAegis = [...guild.roles.cache.values()].filter((r) => {
    if (r.managed || r.id === guild.id || !r.editable) return false;
    if (debeIgnorar(r.name)) return false;
    return /^[A-Z0-9]{1,6}\s*●┇/i.test(r.name) || /^\[[A-Z0-9]{1,6}\]/i.test(r.name) || /^━+/u.test(r.name);
  });

  const ids = new Set(delBot.map((r) => r.role_id));
  const lista = [];
  for (const row of delBot) {
    const rol = guild.roles.cache.get(row.role_id);
    if (rol) lista.push(rol);
  }
  for (const r of formatoAegis) {
    if (!ids.has(r.id)) lista.push(r);
  }

  if (!lista.length) {
    const payload = {
      embeds: [embedBase({
        color: COLORES.neutral,
        titulo: '🗑️ Eliminar roles del bot',
        descripcion: 'No hay roles con formato Aegis creados por el bot.',
        footer: 'Administración',
      })],
      components: [],
    };
    if (interaction.isStringSelectMenu()) await interaction.update(payload).catch(() => {});
    else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  const preview = lista.slice(0, 25).map((r) => `${EMOJI.bot} ${r.name}`).join('\n');
  const btn = new ButtonBuilder()
    .setCustomId(`config_roles:eliminar_ejecutar:${interaction.user.id}`)
    .setLabel(`Eliminar ${lista.length} roles`)
    .setStyle(ButtonStyle.Danger);

  const payload = {
    embeds: [embedBase({
      color: COLORES.denegado,
      titulo: `🗑️ Eliminar ${lista.length} roles Aegis`,
      descripcion: `Solo formato organigrama / creados por el bot.\n\n${preview}${lista.length > 25 ? `\n… +${lista.length - 25}` : ''}`,
      footer: 'Confirmación',
    })],
    components: [new ActionRowBuilder().addComponents(btn)],
  };
  if (interaction.isStringSelectMenu()) await interaction.update(payload).catch(() => {});
  else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
}

async function onEliminarEjecutar(interaction) {
  await interaction.deferUpdate();
  const guild = interaction.guild;
  if (!guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.editReply({
      embeds: [embedBase({ color: COLORES.denegado, titulo: '🗑️ Sin permiso', descripcion: 'Se necesita **Manage Roles**.', footer: 'Administración' })],
      components: [],
    });
    return;
  }

  await guild.roles.fetch();
  const db = getDb();
  asegurarColumnaOrigen();
  const delBot = db.prepare("SELECT * FROM roles_map WHERE origen = 'bot'").all();
  const formatoAegis = [...guild.roles.cache.values()].filter((r) => {
    if (r.managed || r.id === guild.id || !r.editable) return false;
    if (debeIgnorar(r.name)) return false;
    return /^[A-Z0-9]{1,6}\s*●┇/i.test(r.name) || /^\[[A-Z0-9]{1,6}\]/i.test(r.name) || /^━+/u.test(r.name);
  });

  const mapa = new Map();
  for (const row of delBot) {
    const rol = guild.roles.cache.get(row.role_id);
    if (rol) mapa.set(rol.id, rol);
  }
  for (const r of formatoAegis) mapa.set(r.id, r);

  const lista = [...mapa.values()].sort((a, b) => b.position - a.position);
  let eliminados = 0;
  const fallos = [];

  for (const rol of lista) {
    try {
      if (!rol.editable) { fallos.push(rol.name); continue; }
      await rol.delete(`Aegis · limpieza · ${interaction.user.tag}`);
      eliminados++;
      try { db.prepare('DELETE FROM roles_map WHERE role_id = ?').run(rol.id); } catch (_) {}
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      fallos.push(rol.name);
      console.error('[Eliminar]', rol.name, err.message || err);
    }
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ELIMINAR_BOT', { eliminados, fallos: fallos.length });
  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: '🗑️ Limpieza completada',
      descripcion: `Eliminados: **${eliminados}**${fallos.length ? `\n${EMOJI.problema} Sin borrar: ${fallos.length}` : ''}`,
      footer: 'Administración',
    })],
    components: [],
  });
}

module.exports = { prefix, handle };

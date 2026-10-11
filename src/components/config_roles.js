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
  ROLES_IGNORAR,
  getJerarquiaCompleta,
  nombreBaseRol,
} = require('../data/organigrama');
const {
  normalizarNombre,
  coberturaTokens,
  similitudDice,
  truncar,
} = require('../utils/helpers');

const prefix = 'config_roles';
const UMBRAL = 0.55;

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
  if (!n) return true;
  if (n === 'bot oficial' || n === 'bots' || n === 'bot') return true;
  if (n.startsWith('bot oficial')) return true;
  return false;
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** ¿El texto contiene la palabra completa? */
function tienePalabra(texto, palabra) {
  if (!texto || !palabra) return false;
  const re = new RegExp(`(?:^|\\s)${escapeRe(palabra)}(?:\\s|$)`);
  return re.test(texto);
}

function textosEsperados(item) {
  const lista = [];
  if (item.nombre) lista.push(item.nombre);
  if (item.nombreRol) lista.push(nombreBaseRol(item.nombreRol));
  if (Array.isArray(item.aliases)) lista.push(...item.aliases);
  return [...new Set(lista.map((t) => normalizarNombre(t)).filter((t) => t && t.length >= 3))];
}

function pareceSeparador(nombreDiscord) {
  const n = String(nombreDiscord || '');
  return /^[\s\-—━_═~]+/u.test(n) || /[\-—━_═]{3,}/u.test(n);
}

/**
 * Score 0..1: que tan bien coincide el rol Discord con el item.
 * Prioriza igualdad exacta y palabra completa (Fundador, Director, etc.).
 */
function scoreMatch(rolDiscord, item) {
  // Separadores solo contra roles que parecen separadores
  if (item.tipo === 'separador') {
    if (!pareceSeparador(rolDiscord.name)) return 0;
    const base = normalizarNombre(nombreBaseRol(rolDiscord.name));
    const esp = normalizarNombre(nombreBaseRol(item.nombreRol || ''));
    if (!esp) return 0;
    if (base === esp) return 1;
    if (base.includes(esp) || esp.includes(base)) return 0.9;
    return similitudDice(base, esp) >= 0.7 ? 0.8 : 0;
  }

  const baseRol = normalizarNombre(nombreBaseRol(rolDiscord.name));
  const nomRol = normalizarNombre(rolDiscord.name);
  if (!baseRol && !nomRol) return 0;

  const esperados = textosEsperados(item);
  if (!esperados.length) return 0;

  let best = 0;

  for (const esp of esperados) {
    // 1) Igualdad exacta
    if (baseRol === esp || nomRol === esp) return 1;

    // 2) Palabra completa (clave para "Fundador", "Residente", "Cadete"...)
    if (tienePalabra(baseRol, esp) || tienePalabra(nomRol, esp)) {
      best = Math.max(best, esp.split(' ').length === 1 ? 0.99 : 0.97);
      continue;
    }

    // 3) Contiene la frase completa
    if (esp.length >= 4) {
      if (baseRol.includes(esp) || nomRol.includes(esp)) {
        best = Math.max(best, 0.95);
        continue;
      }
      // El esperado contiene al rol (rol mas corto pero distintivo)
      if (baseRol.length >= 4 && esp.includes(baseRol) && tienePalabra(esp, baseRol)) {
        best = Math.max(best, 0.9);
      }
    }

    // 4) Cobertura de tokens
    const cov = Math.max(coberturaTokens(esp, baseRol), coberturaTokens(esp, nomRol));
    if (cov >= 0.75) best = Math.max(best, 0.8 + cov * 0.15);
    else if (cov >= 0.5) best = Math.max(best, 0.6 + cov * 0.15);

    // 5) Similitud de caracteres
    const dice = Math.max(similitudDice(baseRol, esp), similitudDice(nomRol, esp));
    if (dice >= 0.65) best = Math.max(best, dice);
  }

  return best;
}

function nombreConPrefijo(rolDiscord, item) {
  if (item.tipo === 'separador' || item.tipo === 'permiso' || !item.prefijo) {
    return item.nombreRol || item.nombre;
  }
  let base = nombreBaseRol(rolDiscord.name);
  if (!base || base.length < 2) {
    base = item.nombre || nombreBaseRol(item.nombreRol || '');
  }
  if (item.emoji) return `${item.emoji} ${item.prefijo} ●┇${base}`;
  return `${item.prefijo} ●┇${base}`;
}

function escanearServidor(guild) {
  const roles = [...guild.roles.cache.values()].filter(
    (r) => r.id !== guild.id && !r.managed && !debeIgnorar(r.name)
  );

  // Cargos y permisos primero; separadores al final (no deben "robar" nombres)
  const catalogo = getJerarquiaCompleta();
  const cargosPrimero = [
    ...catalogo.filter((i) => i.tipo === 'cargo'),
    ...catalogo.filter((i) => i.tipo === 'permiso'),
    ...catalogo.filter((i) => i.tipo === 'separador'),
  ];

  const scores = [];
  for (const item of cargosPrimero) {
    for (const rol of roles) {
      const s = scoreMatch(rol, item);
      if (s >= UMBRAL) scores.push({ item, rol, score: s });
    }
  }

  // Mejor score primero; en empate, frase esperada mas larga gana
  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const la = (a.item.nombre || a.item.nombreRol || '').length;
    const lb = (b.item.nombre || b.item.nombreRol || '').length;
    return lb - la;
  });

  const usados = new Set();
  const asignado = new Map();

  for (const { item, rol, score } of scores) {
    if (asignado.has(item.key)) continue;
    if (usados.has(rol.id)) continue;
    asignado.set(item.key, { item, rol, score });
    usados.add(rol.id);
  }

  const detectados = [];
  const aRenombrar = [];
  const faltantes = [];

  for (const item of catalogo) {
    const hit = asignado.get(item.key);
    if (hit) {
      detectados.push({ item: hit.item, rol: hit.rol, score: hit.score });
      guardarMapa(item.key, hit.rol.id, hit.rol.name, 'existente');
      const destino = nombreConPrefijo(hit.rol, item);
      if (hit.rol.name !== destino) {
        aRenombrar.push({
          item,
          rol: hit.rol,
          nombreActual: hit.rol.name,
          nombreDestino: destino,
        });
      }
    } else {
      faltantes.push(item);
    }
  }

  const noUsados = roles.filter((r) => !usados.has(r.id));
  return { detectados, aRenombrar, faltantes, noUsados, catalogo, rolesLeidos: roles.length };
}

async function handle(interaction, accion, args) {
  if (!esAdmin(interaction)) {
    await interaction.reply({ content: 'No tienes autorizacion para esta accion.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }
  const ownerId = args[0];
  if (ownerId && ownerId !== interaction.user.id) {
    await interaction.reply({ content: 'Solo quien abrio el menu puede usarlo.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }
  switch (accion) {
    case 'menu': return onMenu(interaction);
    case 'renombrar_confirmar': return onRenombrarConfirmar(interaction);
    case 'renombrar_ejecutar': return onRenombrarEjecutar(interaction);
    case 'crear_confirmar': return onCrearConfirmar(interaction);
    case 'crear_ejecutar': return onCrearEjecutar(interaction);
    case 'organizar_confirmar': return onOrganizarConfirmar(interaction);
    case 'organizar_ejecutar': return onOrganizarEjecutar(interaction);
    case 'eliminar_confirmar': return onEliminarConfirmar(interaction);
    case 'eliminar_ejecutar': return onEliminarEjecutar(interaction);
    default:
      await interaction.reply({ content: 'Accion no reconocida.', flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}

async function onMenu(interaction) {
  switch (interaction.values[0]) {
    case 'analizar': return analizar(interaction);
    case 'renombrar': return onRenombrarConfirmar(interaction);
    case 'crear': return onCrearConfirmar(interaction);
    case 'organizar': return onOrganizarConfirmar(interaction);
    case 'eliminar_bot': return onEliminarConfirmar(interaction);
  }
}

async function analizar(interaction) {
  await interaction.deferUpdate();
  const guild = interaction.guild;
  await guild.roles.fetch();
  const { detectados, aRenombrar, faltantes, noUsados, rolesLeidos } = escanearServidor(guild);

  // Buscar si Fundador quedo fuera
  const tieneFundador = detectados.some((d) => d.item.key === 'ST.FUNDADOR');
  const fundadorEnServidor = noUsados.filter((r) =>
    /fundador/i.test(normalizarNombre(r.name))
  );

  const embeds = [];
  embeds.push(embedBase({
    color: COLORES.neutral,
    titulo: 'Informe de roles',
    campos: [
      { name: 'Roles leidos', value: String(rolesLeidos), inline: true },
      { name: 'Detectados', value: String(detectados.length), inline: true },
      { name: 'Prefijo por aplicar', value: String(aRenombrar.length), inline: true },
      { name: 'Faltantes', value: String(faltantes.length), inline: true },
      { name: 'Otros', value: String(noUsados.length), inline: true },
      {
        name: 'Fundador',
        value: tieneFundador
          ? `Detectado: **${detectados.find((d) => d.item.key === 'ST.FUNDADOR').rol.name}**`
          : (fundadorEnServidor.length
            ? `En servidor pero no asignado: ${fundadorEnServidor.map((r) => r.name).join(', ')}`
            : 'No encontrado en el servidor'),
        inline: false,
      },
    ],
    footer: 'Deteccion por palabra completa · Fundador prioritario',
  }));

  if (detectados.length) {
    embeds.push(embedBase({
      color: COLORES.medicina,
      titulo: `Detectados (${detectados.length})`,
      descripcion: truncar(
        detectados
          .slice(0, 30)
          .map((d) => `· **${d.rol.name}** → \`${d.item.key}\` (${Math.round((d.score || 1) * 100)}%)`)
          .join('\n') +
        (detectados.length > 30 ? `\n… +${detectados.length - 30}` : '')
      ),
      footer: 'Se reutilizan',
      timestamp: false,
    }));
  }

  if (aRenombrar.length) {
    embeds.push(embedBase({
      color: 0xe8b923,
      titulo: `Prefijo por aplicar (${aRenombrar.length})`,
      descripcion: truncar(
        aRenombrar.slice(0, 20).map((r) =>
          `**${r.nombreActual}** → \`${r.nombreDestino}\``
        ).join('\n') +
        (aRenombrar.length > 20 ? `\n… +${aRenombrar.length - 20}` : '')
      ),
      footer: 'Solo el prefijo',
      timestamp: false,
    }));
  }

  if (faltantes.length) {
    embeds.push(embedBase({
      color: COLORES.denegado,
      titulo: `Faltantes (${faltantes.length})`,
      descripcion: truncar(
        faltantes.slice(0, 25).map((f) => `· ${f.nombreRol || f.nombre}`).join('\n') +
        (faltantes.length > 25 ? `\n… +${faltantes.length - 25}` : '')
      ),
      footer: 'Crear si no existen',
      timestamp: false,
    }));
  }

  if (noUsados.length) {
    embeds.push(embedBase({
      color: COLORES.neutral,
      titulo: `Otros roles (${noUsados.length})`,
      descripcion: truncar(
        noUsados.slice(0, 25).map((r) => `· ${r.name}`).join('\n') +
        (noUsados.length > 25 ? `\n… +${noUsados.length - 25}` : '')
      ),
      footer: 'No se tocan',
      timestamp: false,
    }));
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ANALIZAR', {
    detectados: detectados.length,
    aRenombrar: aRenombrar.length,
    faltantes: faltantes.length,
    fundador: tieneFundador,
  });

  await interaction.editReply({ embeds: embeds.slice(0, 10), components: [] });
}

async function onRenombrarConfirmar(interaction) {
  const guild = interaction.guild;
  await guild.roles.fetch();
  const { aRenombrar } = escanearServidor(guild);

  if (!aRenombrar.length) {
    const payload = {
      embeds: [embedBase({
        color: COLORES.medicina,
        titulo: 'Aplicar prefijos',
        descripcion: 'No hay nada que cambiar.',
        footer: 'Administracion',
      })],
      components: [],
    };
    if (interaction.isStringSelectMenu()) await interaction.update(payload).catch(() => {});
    else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  const preview = aRenombrar.slice(0, 20).map((r) =>
    `**${r.nombreActual}** → \`${r.nombreDestino}\``
  ).join('\n');

  const payload = {
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: `Aplicar prefijo a ${aRenombrar.length} roles`,
      descripcion: `Solo el prefijo. Se conserva el nombre.\n\n${preview}${aRenombrar.length > 20 ? `\n… +${aRenombrar.length - 20}` : ''}`,
      footer: 'Confirmacion',
    })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`config_roles:renombrar_ejecutar:${interaction.user.id}`)
        .setLabel(`Aplicar prefijos (${aRenombrar.length})`)
        .setStyle(ButtonStyle.Primary)
    )],
  };
  if (interaction.isStringSelectMenu()) await interaction.update(payload).catch(() => {});
  else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
}

async function onRenombrarEjecutar(interaction) {
  await interaction.deferUpdate();
  const guild = interaction.guild;

  if (!guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.editReply({
      embeds: [embedBase({ color: COLORES.denegado, titulo: 'Sin permiso', descripcion: 'Se necesita **Manage Roles**.', footer: 'Administracion' })],
      components: [],
    });
    return;
  }

  await guild.roles.fetch();
  const { aRenombrar } = escanearServidor(guild);
  let hechos = 0;
  const fallos = [];

  for (const r of aRenombrar) {
    try {
      const rol = guild.roles.cache.get(r.rol.id);
      if (!rol || !rol.editable) { fallos.push(r.nombreActual); continue; }
      if (rol.name === r.nombreDestino) continue;
      await rol.setName(r.nombreDestino, `Aegis · prefijo · ${interaction.user.tag}`);
      guardarMapa(r.item.key, rol.id, r.nombreDestino, 'existente');
      hechos++;
      await new Promise((res) => setTimeout(res, 400));
    } catch (err) {
      fallos.push(r.nombreActual);
      console.error('[Prefijo]', r.nombreActual, err.message || err);
    }
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.PREFIJO', { hechos, fallos: fallos.length });
  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Prefijos aplicados',
      descripcion: `Actualizados: **${hechos}**${fallos.length ? `\nSin cambiar: ${fallos.length}` : ''}`,
      footer: 'Administracion',
    })],
    components: [],
  });
}

async function onCrearConfirmar(interaction) {
  const guild = interaction.guild;
  await guild.roles.fetch();
  const { faltantes } = escanearServidor(guild);

  if (!faltantes.length) {
    const payload = {
      embeds: [embedBase({
        color: COLORES.medicina,
        titulo: 'Crear faltantes',
        descripcion: 'No hay faltantes.',
        footer: 'Administracion',
      })],
      components: [],
    };
    if (interaction.isStringSelectMenu()) await interaction.update(payload).catch(() => {});
    else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  const preview = faltantes.slice(0, 25).map((f) => `· ${f.nombreRol || f.nombre}`).join('\n');
  const payload = {
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: `Crear ${faltantes.length} faltantes`,
      descripcion: `${preview}${faltantes.length > 25 ? `\n… +${faltantes.length - 25}` : ''}`,
      footer: 'Confirmacion',
    })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`config_roles:crear_ejecutar:${interaction.user.id}`)
        .setLabel(`Crear ${faltantes.length}`)
        .setStyle(ButtonStyle.Success)
    )],
  };
  if (interaction.isStringSelectMenu()) await interaction.update(payload).catch(() => {});
  else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
}

async function onCrearEjecutar(interaction) {
  await interaction.deferUpdate();
  const guild = interaction.guild;

  if (!guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.editReply({
      embeds: [embedBase({ color: COLORES.denegado, titulo: 'Sin permiso', descripcion: 'Se necesita **Manage Roles**.', footer: 'Administracion' })],
      components: [],
    });
    return;
  }

  await guild.roles.fetch();
  const { faltantes } = escanearServidor(guild);
  let creados = 0;
  const errores = [];

  for (const item of faltantes) {
    try {
      const nombre = item.nombreRol || item.nombre;
      const colorInt = parseInt(String(item.color || '#888780').replace('#', ''), 16);
      const rol = await guild.roles.create({
        name: nombre,
        color: colorInt,
        hoist: false,
        mentionable: false,
        reason: `Aegis · faltante · ${interaction.user.tag}`,
      });
      guardarMapa(item.key, rol.id, rol.name, 'bot');
      creados++;
      await new Promise((r) => setTimeout(r, 350));
    } catch (err) {
      errores.push(item.nombreRol || item.nombre || item.key);
      console.error('[Crear]', err);
    }
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.CREAR', { creados, errores: errores.length });
  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Roles creados',
      descripcion: `Creados: **${creados}**${errores.length ? `\nErrores: ${errores.length}` : ''}`,
      footer: 'Administracion',
    })],
    components: [],
  });
}

async function onOrganizarConfirmar(interaction) {
  const payload = {
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: 'Organizar jerarquia',
      descripcion: 'Coloca cada rol detectado en su seccion. Gerente SI encima de Director General.',
      footer: 'Confirmacion',
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
      embeds: [embedBase({ color: COLORES.denegado, titulo: 'Sin permiso', descripcion: 'Se necesita **Manage Roles**.', footer: 'Administracion' })],
      components: [],
    });
    return;
  }

  await guild.roles.fetch();
  const { detectados } = escanearServidor(guild);
  const ordenados = [...detectados].sort((a, b) => (a.item.orden || 999) - (b.item.orden || 999));

  const botPos = guild.members.me.roles.highest.position;
  let pos = botPos - 1;
  let movidos = 0;
  let fallos = 0;

  for (const d of ordenados) {
    const rol = guild.roles.cache.get(d.rol.id);
    if (!rol || !rol.editable || rol.position >= botPos) { fallos++; continue; }
    try {
      if (pos < 1) break;
      await rol.setPosition(pos, { reason: `Aegis · organizar · ${interaction.user.tag}` });
      pos--;
      movidos++;
      await new Promise((r) => setTimeout(r, 450));
    } catch (err) {
      fallos++;
      console.error('[Organizar]', rol.name, err.message || err);
    }
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ORGANIZAR', { movidos, fallos });
  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Jerarquia organizada',
      descripcion: `Roles en su lugar: **${movidos}**${fallos ? `\nSin mover: ${fallos}` : ''}`,
      footer: 'Administracion',
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
  const lista = [];
  for (const row of delBot) {
    const rol = guild.roles.cache.get(row.role_id);
    if (rol && rol.editable) lista.push(rol);
  }

  if (!lista.length) {
    const payload = {
      embeds: [embedBase({
        color: COLORES.neutral,
        titulo: 'Eliminar roles del bot',
        descripcion: 'No hay roles creados por el bot.',
        footer: 'Administracion',
      })],
      components: [],
    };
    if (interaction.isStringSelectMenu()) await interaction.update(payload).catch(() => {});
    else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  const preview = lista.slice(0, 25).map((r) => `· ${r.name}`).join('\n');
  const payload = {
    embeds: [embedBase({
      color: COLORES.denegado,
      titulo: `Eliminar ${lista.length} roles del bot`,
      descripcion: preview,
      footer: 'Confirmacion',
    })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`config_roles:eliminar_ejecutar:${interaction.user.id}`)
        .setLabel(`Eliminar ${lista.length}`)
        .setStyle(ButtonStyle.Danger)
    )],
  };
  if (interaction.isStringSelectMenu()) await interaction.update(payload).catch(() => {});
  else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
}

async function onEliminarEjecutar(interaction) {
  await interaction.deferUpdate();
  const guild = interaction.guild;
  if (!guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.editReply({
      embeds: [embedBase({ color: COLORES.denegado, titulo: 'Sin permiso', descripcion: 'Se necesita **Manage Roles**.', footer: 'Administracion' })],
      components: [],
    });
    return;
  }

  const db = getDb();
  asegurarColumnaOrigen();
  const delBot = db.prepare("SELECT * FROM roles_map WHERE origen = 'bot'").all();
  let eliminados = 0;
  const fallos = [];

  for (const row of delBot) {
    try {
      const rol = guild.roles.cache.get(row.role_id);
      if (rol && rol.editable) {
        await rol.delete(`Aegis · eliminar bot · ${interaction.user.tag}`);
        eliminados++;
        await new Promise((r) => setTimeout(r, 400));
      }
      db.prepare("DELETE FROM roles_map WHERE cargo_key = ? AND origen = 'bot'").run(row.cargo_key);
    } catch (err) {
      fallos.push(row.nombre_rol || row.cargo_key);
    }
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ELIMINAR_BOT', { eliminados, fallos: fallos.length });
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

module.exports = { prefix, handle };

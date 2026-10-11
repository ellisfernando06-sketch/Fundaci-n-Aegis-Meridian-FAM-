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
const { ORGANIGRAMA, ROLES_APOYO, getTodosCargos } = require('../data/organigrama');
const { LLAVES_INICIALES } = require('../data/llaves');
const { normalizarNombre, similitudDice, truncar } = require('../utils/helpers');

const prefix = 'config_roles';

const EMOJI = {
  detectado: '✅', parcial: '⚠️', cargo: '📋', apoyo: '🏷️',
  llave: '🔑', bot: '🤖', original: '📌', problema: '🔺',
};

const EMOJI_RAMA = {
  cupula: '🏛️', medicina: '🩺', investigacion: '🔬', clase_d: '⛓️',
  seguridad: '🛡️', ftm: '⚔️', err: '🚨', inteligencia: '🕵️',
  seguridad_interna: '🔒', insurgencia: '💀', apoyo: '🏷️', llaves: '🔑',
};

const PREFIJOS_BOT = ['[CUP]', '[MED]', '[INV]', '[CD]', '[SEG]', '[FTM]', '[ERR]', '[INT]', '[SI]', '[CAOS]', '[KEY]'];

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

function construirEsperados() {
  const cargos = getTodosCargos().map((c) => ({
    key: c.key, nombreRol: c.nombreRol, color: c.color, rama: c.rama, tipo: 'cargo',
  }));
  const apoyo = [];
  for (const nombre of ROLES_APOYO.areas) {
    apoyo.push({ key: `AREA.${nombre}`, nombreRol: nombre, color: '#888780', rama: 'apoyo', tipo: 'apoyo' });
  }
  for (const nombre of ROLES_APOYO.autorizacion) {
    apoyo.push({ key: `AUTH.${nombre}`, nombreRol: nombre, color: '#378ADD', rama: 'apoyo', tipo: 'apoyo' });
  }
  for (const nombre of ROLES_APOYO.estado) {
    const key = nombre.includes('Verificado') ? 'APOYO.VERIFICADO' : nombre.includes('Suspendido') ? 'APOYO.SUSPENDIDO' : 'APOYO.VISITANTE';
    apoyo.push({ key, nombreRol: nombre, color: '#888780', rama: 'apoyo', tipo: 'apoyo' });
  }
  for (const nombre of ROLES_APOYO.administracion) {
    apoyo.push({ key: 'APOYO.ADMIN_BOT', nombreRol: nombre, color: '#7F77DD', rama: 'apoyo', tipo: 'apoyo' });
  }
  const llaves = LLAVES_INICIALES.map((l) => ({
    key: l.id, nombreRol: `[KEY] ${l.nombre}`, color: '#D4A017', rama: 'llaves', tipo: 'llave',
  }));
  return { cargos, apoyo, llaves, todos: [...cargos, ...apoyo, ...llaves] };
}

/**
 * Lista TODOS los roles que el bot pudo haber creado:
 * - nombre exacto del organigrama / apoyo / llaves
 * - o empiezan por [CUP] [MED] [INV] [CD] [SEG] [FTM] [ERR] [INT] [SI] [CAOS] [KEY]
 * Solo editables, no managed, no @everyone, por debajo del bot.
 */
function listarRolesDelBot(guild) {
  const { todos } = construirEsperados();
  const nombresExactos = new Set(todos.map((t) => normalizarNombre(t.nombreRol)));
  const botPos = guild.members.me?.roles?.highest?.position ?? 0;
  const resultado = [];

  for (const rol of guild.roles.cache.values()) {
    if (rol.managed || rol.id === guild.id) continue;
    if (!rol.editable) continue;
    if (rol.position >= botPos) continue;

    const norm = normalizarNombre(rol.name);
    const exacto = nombresExactos.has(norm);
    const porPrefijo = PREFIJOS_BOT.some((p) => rol.name.startsWith(p));

    if (exacto || porPrefijo) {
      resultado.push(rol);
    }
  }

  // Ordenar por posición (mayor primero) para borrar de arriba hacia abajo
  resultado.sort((a, b) => b.position - a.position);
  return resultado;
}

function estiloReferencia(guild, rama, detectados) {
  const deRama = detectados.filter((d) => d.esperado.rama === rama && d.rol);
  if (deRama.length) {
    const ref = deRama[0].rol;
    return { hoist: ref.hoist, mentionable: ref.mentionable, color: ref.color || null };
  }
  const prefijo = ORGANIGRAMA[rama]?.prefijo;
  if (prefijo) {
    const similar = guild.roles.cache.find(
      (r) => r.name.startsWith(`[${prefijo}]`) || r.name.startsWith(`${prefijo} `)
    );
    if (similar) return { hoist: similar.hoist, mentionable: similar.mentionable, color: similar.color || null };
  }
  return { hoist: false, mentionable: false, color: null };
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
    case 'crear_rama': return onCrearRama(interaction);
    case 'crear_ejecutar': return onCrearEjecutar(interaction, args);
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
    case 'crear': return mostrarMenuCrear(interaction);
    case 'eliminar_bot': return onEliminarConfirmar(interaction);
    case 'vincular':
      await interaction.update({
        embeds: [embedBase({
          color: COLORES.neutral,
          titulo: '🔗 Vincular roles',
          descripcion: 'Ejecuta **Analizar roles**. Los que ya existían se vinculan solos.',
          footer: 'Administración',
        })],
        components: [],
      });
      break;
    case 'sincronizar': return sincronizarColores(interaction);
  }
}

async function analizar(interaction) {
  await interaction.deferUpdate();
  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: 'Este comando solo funciona dentro de un servidor.', embeds: [], components: [] });
    return;
  }

  await guild.roles.fetch();
  const rolesServidor = [...guild.roles.cache.values()].filter((r) => r.id !== guild.id && !r.managed);
  const { todos } = construirEsperados();
  const db = getDb();
  asegurarColumnaOrigen();

  const detectados = [];
  const parciales = [];
  const faltantes = [];
  const usados = new Set();

  for (const esperado of todos) {
    const normEsp = normalizarNombre(esperado.nombreRol);
    let match = null;
    let score = 0;
    for (const rol of rolesServidor) {
      if (usados.has(rol.id)) continue;
      const normRol = normalizarNombre(rol.name);
      if (normRol === normEsp) { match = rol; score = 1; break; }
      const s = similitudDice(normEsp, normRol);
      if (s >= 0.85 && s > score) { match = rol; score = s; }
    }
    if (match && score === 1) {
      detectados.push({ esperado, rol: match });
      usados.add(match.id);
      const esFormatoBot = PREFIJOS_BOT.some((p) => match.name.startsWith(p));
      guardarMapa(esperado.key, match.id, match.name, esFormatoBot ? 'bot' : 'existente');
    } else if (match && score >= 0.85) {
      parciales.push({ esperado, rol: match, score });
      usados.add(match.id);
    } else {
      faltantes.push(esperado);
    }
  }

  const delBot = listarRolesDelBot(guild);
  const embeds = [];

  embeds.push(embedBase({
    color: COLORES.neutral,
    titulo: '🧩 Informe de roles',
    campos: [
      { name: `${EMOJI.detectado} Coincidencias exactas`, value: String(detectados.length), inline: true },
      { name: `${EMOJI.bot} Formato organigrama (borrables)`, value: String(delBot.length), inline: true },
      { name: `${EMOJI.parcial} Parciales`, value: String(parciales.length), inline: true },
      { name: `${EMOJI.cargo} Cargos faltantes`, value: String(faltantes.filter((f) => f.tipo === 'cargo').length), inline: true },
      { name: `${EMOJI.apoyo} Apoyo faltantes`, value: String(faltantes.filter((f) => f.tipo === 'apoyo').length), inline: true },
      { name: `${EMOJI.llave} Llaves faltantes`, value: String(faltantes.filter((f) => f.tipo === 'llave').length), inline: true },
    ],
    footer: 'Análisis',
  }));

  if (delBot.length) {
    embeds.push(embedBase({
      color: COLORES.cupula,
      titulo: `${EMOJI.bot} Roles con formato del organigrama (${delBot.length})`,
      descripcion: truncar(
        delBot.slice(0, 25).map((r) => `${EMOJI.bot} ${r.name}`).join('\n') +
        (delBot.length > 25 ? `\n… +${delBot.length - 25}` : '') +
        '\n\n**Eliminar roles creados por el bot** los borra todos.'
      ),
      footer: 'Incluye [PREFIJO] y nombres exactos del catálogo',
      timestamp: false,
    }));
  }

  const faltCargo = faltantes.filter((f) => f.tipo === 'cargo');
  if (faltCargo.length) {
    const porRama = {};
    for (const f of faltCargo) {
      if (!porRama[f.rama]) porRama[f.rama] = [];
      porRama[f.rama].push(f.nombreRol);
    }
    const lineas = Object.entries(porRama).map(([rama, nombres]) => {
      const emoji = EMOJI_RAMA[rama] || EMOJI.cargo;
      return `${emoji} **${ORGANIGRAMA[rama]?.nombre || rama}** (${nombres.length})\n${nombres.slice(0, 6).map((n) => `· ${n}`).join('\n')}${nombres.length > 6 ? `\n· … +${nombres.length - 6}` : ''}`;
    }).join('\n\n');
    embeds.push(embedBase({
      color: COLORES.denegado,
      titulo: `${EMOJI.cargo} Cargos faltantes`,
      descripcion: truncar(lineas),
      footer: 'Análisis',
      timestamp: false,
    }));
  }

  const faltApoyo = faltantes.filter((f) => f.tipo === 'apoyo');
  if (faltApoyo.length) {
    embeds.push(embedBase({
      color: COLORES.neutral,
      titulo: `${EMOJI.apoyo} Apoyo faltantes`,
      descripcion: truncar(faltApoyo.map((f) => `${EMOJI.apoyo} ${f.nombreRol}`).join('\n')),
      footer: 'Análisis',
      timestamp: false,
    }));
  }

  const faltLlave = faltantes.filter((f) => f.tipo === 'llave');
  if (faltLlave.length) {
    embeds.push(embedBase({
      color: 0xd4a017,
      titulo: `${EMOJI.llave} Llaves faltantes`,
      descripcion: truncar(faltLlave.slice(0, 12).map((f) => `${EMOJI.llave} ${f.nombreRol}`).join('\n') + (faltLlave.length > 12 ? `\n… +${faltLlave.length - 12}` : '')),
      footer: '/config_llaves',
      timestamp: false,
    }));
  }

  if (parciales.length) {
    embeds.push(embedBase({
      color: 0xe8b923,
      titulo: `${EMOJI.parcial} Parciales`,
      descripcion: truncar(parciales.slice(0, 10).map((p) =>
        `${EMOJI.parcial} **${p.rol.name}** ≈ ${p.esperado.nombreRol}`
      ).join('\n')),
      footer: 'No se vinculan solas',
      timestamp: false,
    }));
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ANALIZAR', {
    detectados: detectados.length, faltantes: faltantes.length, delBot: delBot.length,
  });

  await interaction.editReply({ embeds: embeds.slice(0, 10), components: [] });
}

async function mostrarMenuCrear(interaction) {
  const opciones = [
    { label: 'Todo lo faltante (cargos + apoyo)', value: 'todo', emoji: '🛠️' },
    { label: 'Solo roles de apoyo', value: 'apoyo', emoji: '🏷️' },
  ];
  for (const [key, rama] of Object.entries(ORGANIGRAMA)) {
    if (opciones.length >= 25) break;
    opciones.push({ label: rama.nombre, value: key, description: `Rama ${rama.prefijo}`, emoji: EMOJI_RAMA[key] || '📋' });
  }
  await interaction.update({
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: '🛠️ Crear roles faltantes',
      descripcion: 'Solo se crean los que no existen. Estilo heredado de la misma rama si hay roles previos.',
      footer: 'Administración',
    })],
    components: [new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`config_roles:crear_rama:${interaction.user.id}`)
        .setPlaceholder('Selecciona el alcance')
        .addOptions(opciones)
    )],
  });
}

async function onCrearRama(interaction) {
  const alcance = interaction.values[0];
  const guild = interaction.guild;
  await guild.roles.fetch();
  const { cargos, apoyo } = construirEsperados();
  let candidatos = [];
  if (alcance === 'todo') candidatos = [...cargos, ...apoyo];
  else if (alcance === 'apoyo') candidatos = [...apoyo];
  else candidatos = cargos.filter((c) => c.rama === alcance);

  const existentes = new Set([...guild.roles.cache.values()].map((r) => normalizarNombre(r.name)));
  const aCrear = candidatos.filter((c) => !existentes.has(normalizarNombre(c.nombreRol)));

  if (!aCrear.length) {
    await interaction.update({
      embeds: [embedBase({
        color: COLORES.medicina,
        titulo: '🛠️ Crear roles',
        descripcion: `${EMOJI.detectado} No hay faltantes en este alcance.`,
        footer: 'Administración',
      })],
      components: [],
    });
    return;
  }

  const preview = aCrear.slice(0, 20).map((c) => `${EMOJI_RAMA[c.rama] || EMOJI.cargo} ${c.nombreRol}`).join('\n');
  const extra = aCrear.length > 20 ? `\n… +${aCrear.length - 20}` : '';
  await interaction.update({
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: '🛠️ Vista previa · solo faltantes',
      descripcion: `Se crearán **${aCrear.length}**.\n\n${preview}${extra}`,
      footer: 'Administración',
    })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`config_roles:crear_ejecutar:${interaction.user.id}:${alcance}`)
        .setLabel(`Crear ${aCrear.length} faltantes`)
        .setStyle(ButtonStyle.Success)
    )],
  });
}

async function onCrearEjecutar(interaction, args) {
  const alcance = args[1];
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
  const { cargos, apoyo, todos } = construirEsperados();
  const rolesServidor = [...guild.roles.cache.values()].filter((r) => !r.managed);
  const detectados = [];
  for (const esperado of todos) {
    const match = rolesServidor.find((r) => normalizarNombre(r.name) === normalizarNombre(esperado.nombreRol));
    if (match) detectados.push({ esperado, rol: match });
  }

  let candidatos = [];
  if (alcance === 'todo') candidatos = [...cargos, ...apoyo];
  else if (alcance === 'apoyo') candidatos = [...apoyo];
  else candidatos = cargos.filter((c) => c.rama === alcance);

  const existentes = new Set(rolesServidor.map((r) => normalizarNombre(r.name)));
  const aCrear = candidatos.filter((c) => !existentes.has(normalizarNombre(c.nombreRol)));

  let creados = 0;
  const errores = [];
  for (const item of aCrear) {
    try {
      const estilo = estiloReferencia(guild, item.rama, detectados);
      const colorInt = estilo.color && estilo.color !== 0
        ? estilo.color
        : parseInt((item.color || '#888780').replace('#', ''), 16);
      const rol = await guild.roles.create({
        name: item.nombreRol,
        color: colorInt,
        hoist: estilo.hoist,
        mentionable: estilo.mentionable,
        reason: `Aegis · config_roles · bot · ${interaction.user.tag}`,
      });
      guardarMapa(item.key, rol.id, rol.name, 'bot');
      creados++;
      await new Promise((r) => setTimeout(r, 350));
    } catch (err) {
      errores.push(item.nombreRol);
      console.error('[Crear rol]', err);
    }
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.CREAR', { creados, errores: errores.length, alcance });
  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: '🛠️ Roles creados',
      descripcion: `${EMOJI.bot} Creados: **${creados}**${errores.length ? `\n${EMOJI.problema} Errores: ${errores.length}` : ''}`,
      footer: 'Administración',
    })],
    components: [],
  });
}

async function onEliminarConfirmar(interaction) {
  const guild = interaction.guild;
  await guild.roles.fetch().catch(() => {});

  const candidatos = listarRolesDelBot(guild);

  if (!candidatos.length) {
    const payload = {
      embeds: [embedBase({
        color: COLORES.neutral,
        titulo: '🗑️ Eliminar roles del organigrama',
        descripcion: 'No hay roles con formato del organigrama ([PREFIJO] / nombres del catálogo) que el bot pueda borrar.',
        footer: 'Administración',
      })],
      components: [],
    };
    if (interaction.isStringSelectMenu()) await interaction.update(payload).catch(() => {});
    else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  const lista = candidatos.slice(0, 30).map((r) => `${EMOJI.bot} ${r.name}`).join('\n');
  const more = candidatos.length > 30 ? `\n… +${candidatos.length - 30}` : '';

  const btn = new ButtonBuilder()
    .setCustomId(`config_roles:eliminar_ejecutar:${interaction.user.id}`)
    .setLabel(`Eliminar ${candidatos.length} roles`)
    .setStyle(ButtonStyle.Danger);

  const payload = {
    embeds: [embedBase({
      color: COLORES.denegado,
      titulo: `🗑️ Eliminar ${candidatos.length} roles del organigrama`,
      descripcion: `Se borrarán **todos** los roles con formato del catálogo Aegis que el bot pueda gestionar:\n· Prefijos [CUP] [MED] [INV] [CD] [SEG] [FTM] [ERR] [INT] [SI] [CAOS] [KEY]\n· Nombres exactos de apoyo del organigrama\n\n${lista}${more}\n\nLos roles de Discord que no coincidan con ese formato **no se tocan**.`,
      footer: 'Confirmación requerida',
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
  const candidatos = listarRolesDelBot(guild);

  let eliminados = 0;
  const fallos = [];

  for (const rol of candidatos) {
    try {
      // Re-fetch por si cambió la jerarquía
      const actual = guild.roles.cache.get(rol.id);
      if (!actual || !actual.editable) {
        fallos.push(rol.name);
        continue;
      }
      await actual.delete(`Aegis · limpieza organigrama · ${interaction.user.tag}`);
      eliminados++;
      // Limpiar mapa
      try {
        getDb().prepare('DELETE FROM roles_map WHERE role_id = ?').run(rol.id);
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      fallos.push(rol.name);
      console.error('[Eliminar rol]', rol.name, err.message || err);
    }
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ELIMINAR_BOT', {
    eliminados, fallos: fallos.length, total: candidatos.length,
  });

  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: '🗑️ Limpieza completada',
      descripcion: `${EMOJI.bot} Eliminados: **${eliminados}** de ${candidatos.length}${fallos.length ? `\n${EMOJI.problema} Sin borrar (${fallos.length}): ${fallos.slice(0, 8).join(', ')}${fallos.length > 8 ? '…' : ''}\n\nSi fallan, sube el rol del bot por encima de esos roles y vuelve a ejecutar.` : ''}`,
      footer: 'Administración',
    })],
    components: [],
  });
}

async function sincronizarColores(interaction) {
  await interaction.deferUpdate();
  const guild = interaction.guild;
  const db = getDb();
  const mapa = db.prepare('SELECT * FROM roles_map').all();
  const { todos } = construirEsperados();
  const porKey = Object.fromEntries(todos.map((t) => [t.key, t]));
  let actualizados = 0;
  for (const row of mapa) {
    const esp = porKey[row.cargo_key];
    if (!esp?.color) continue;
    const rol = guild.roles.cache.get(row.role_id);
    if (!rol?.editable) continue;
    try {
      const colorInt = parseInt(esp.color.replace('#', ''), 16);
      if (rol.color !== colorInt) {
        await rol.setColor(colorInt);
        actualizados++;
        await new Promise((r) => setTimeout(r, 250));
      }
    } catch (err) {
      console.error('[Sync color]', err);
    }
  }
  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.SYNC_COLORES', { actualizados });
  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: '🎨 Colores sincronizados',
      descripcion: `Roles actualizados: **${actualizados}**`,
      footer: 'Administración',
    })],
    components: [],
  });
}

module.exports = { prefix, handle };

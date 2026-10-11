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

/** Emojis de representación por tipo de faltante */
const EMOJI = {
  detectado: '✅',
  parcial: '⚠️',
  cargo: '📋',
  apoyo: '🏷️',
  llave: '🔑',
  bot: '🤖',
  original: '📌',
  problema: '🔺',
};

const EMOJI_RAMA = {
  cupula: '🏛️',
  medicina: '🩺',
  investigacion: '🔬',
  clase_d: '⛓️',
  seguridad: '🛡️',
  ftm: '⚔️',
  err: '🚨',
  inteligencia: '🕵️',
  seguridad_interna: '🔒',
  insurgencia: '💀',
  apoyo: '🏷️',
  llaves: '🔑',
};

function esAdmin(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)
  );
}

function asegurarColumnaOrigen() {
  const db = getDb();
  try {
    db.exec(`ALTER TABLE roles_map ADD COLUMN origen TEXT DEFAULT 'existente'`);
  } catch (_) {
    // columna ya existe
  }
}

function guardarMapa(cargoKey, roleId, nombreRol, origen) {
  const db = getDb();
  asegurarColumnaOrigen();
  db.prepare(
    `INSERT INTO roles_map (cargo_key, role_id, nombre_rol, origen) VALUES (?, ?, ?, ?)
     ON CONFLICT(cargo_key) DO UPDATE SET
       role_id = excluded.role_id,
       nombre_rol = excluded.nombre_rol,
       origen = excluded.origen,
       actualizado_en = datetime('now')`
  ).run(cargoKey, roleId, nombreRol, origen);
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
    case 'menu':
      return onMenu(interaction);
    case 'crear_rama':
      return onCrearRama(interaction);
    case 'crear_ejecutar':
      return onCrearEjecutar(interaction, args);
    case 'eliminar_confirmar':
      return onEliminarConfirmar(interaction);
    case 'eliminar_ejecutar':
      return onEliminarEjecutar(interaction);
    default:
      await interaction.reply({ content: 'Acción no reconocida.', flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}

async function onMenu(interaction) {
  const opcion = interaction.values[0];
  switch (opcion) {
    case 'analizar':
      return analizar(interaction);
    case 'crear':
      return mostrarMenuCrear(interaction);
    case 'eliminar_bot':
      return onEliminarConfirmar(interaction);
    case 'vincular':
      await interaction.update({
        embeds: [
          embedBase({
            color: COLORES.neutral,
            titulo: '🔗 Vincular roles',
            descripcion: 'Ejecuta **Analizar roles**. Los roles que ya existían se vinculan automáticamente al organigrama.',
            footer: 'Administración',
          }),
        ],
        components: [],
      });
      break;
    case 'sincronizar':
      return sincronizarColores(interaction);
  }
}

function construirEsperados() {
  const cargos = getTodosCargos().map((c) => ({
    key: c.key,
    nombreRol: c.nombreRol,
    color: c.color,
    rama: c.rama,
    tipo: 'cargo',
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
    key: l.id,
    nombreRol: `[KEY] ${l.nombre}`,
    color: '#D4A017',
    rama: 'llaves',
    tipo: 'llave',
  }));

  return { cargos, apoyo, llaves, todos: [...cargos, ...apoyo, ...llaves] };
}

/**
 * Busca un rol de la misma rama ya detectado para heredar estilo (hoist, mentionable).
 */
function estiloReferencia(guild, rama, detectados) {
  const deRama = detectados.filter((d) => d.esperado.rama === rama && d.rol);
  if (deRama.length) {
    const ref = deRama[0].rol;
    return {
      hoist: ref.hoist,
      mentionable: ref.mentionable,
      color: ref.color || null,
    };
  }
  // Buscar cualquier rol del servidor con prefijo similar
  const prefijo = ORGANIGRAMA[rama]?.prefijo;
  if (prefijo) {
    const similar = guild.roles.cache.find(
      (r) => r.name.startsWith(`[${prefijo}]`) || r.name.startsWith(`${prefijo} `)
    );
    if (similar) {
      return { hoist: similar.hoist, mentionable: similar.mentionable, color: similar.color || null };
    }
  }
  return { hoist: false, mentionable: false, color: null };
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
      if (normRol === normEsp) {
        match = rol;
        score = 1;
        break;
      }
      const s = similitudDice(normEsp, normRol);
      if (s >= 0.85 && s > score) {
        match = rol;
        score = s;
      }
    }

    if (match && score === 1) {
      detectados.push({ esperado, rol: match });
      usados.add(match.id);
      // Conservar origen bot si ya estaba marcado; si no, es existente
      const prev = db.prepare('SELECT origen FROM roles_map WHERE cargo_key = ?').get(esperado.key);
      const origen = prev?.origen === 'bot' ? 'bot' : 'existente';
      guardarMapa(esperado.key, match.id, match.name, origen);
    } else if (match && score >= 0.85) {
      parciales.push({ esperado, rol: match, score });
      usados.add(match.id);
    } else {
      faltantes.push(esperado);
    }
  }

  // Roles creados por el bot (según mapa)
  const delBot = db.prepare("SELECT * FROM roles_map WHERE origen = 'bot'").all();
  const originales = db.prepare("SELECT * FROM roles_map WHERE origen = 'existente' OR origen IS NULL").all();

  const problemas = [];
  const botMember = guild.members.me;
  if (botMember) {
    const botPos = botMember.roles.highest.position;
    for (const d of detectados) {
      if (d.rol.position >= botPos) {
        problemas.push(`${EMOJI.problema} **${d.rol.name}** está al nivel del bot o por encima.`);
      }
    }
  }

  const embeds = [];

  // Resumen
  embeds.push(
    embedBase({
      color: COLORES.neutral,
      titulo: '🧩 Informe de roles',
      campos: [
        { name: `${EMOJI.detectado} Detectados (ya existían)`, value: String(detectados.filter((d) => {
          const row = db.prepare('SELECT origen FROM roles_map WHERE cargo_key = ?').get(d.esperado.key);
          return row?.origen !== 'bot';
        }).length), inline: true },
        { name: `${EMOJI.bot} Creados por el bot`, value: String(delBot.length), inline: true },
        { name: `${EMOJI.parcial} Parciales`, value: String(parciales.length), inline: true },
        { name: `${EMOJI.cargo} Cargos faltantes`, value: String(faltantes.filter((f) => f.tipo === 'cargo').length), inline: true },
        { name: `${EMOJI.apoyo} Apoyo faltantes`, value: String(faltantes.filter((f) => f.tipo === 'apoyo').length), inline: true },
        { name: `${EMOJI.llave} Llaves faltantes`, value: String(faltantes.filter((f) => f.tipo === 'llave').length), inline: true },
      ],
      footer: 'Análisis · los roles originales no se modifican',
    })
  );

  // Detectados originales (muestra muestra)
  const originalesDetectados = detectados.filter((d) => {
    const row = db.prepare('SELECT origen FROM roles_map WHERE cargo_key = ?').get(d.esperado.key);
    return row?.origen !== 'bot';
  });
  if (originalesDetectados.length) {
    const lineas = originalesDetectados
      .slice(0, 15)
      .map((d) => `${EMOJI.original} **${d.rol.name}** → \`${d.esperado.key}\`)
      .join('\n');
    const extra = originalesDetectados.length > 15 ? `\n… y ${originalesDetectados.length - 15} más` : '';
    embeds.push(
      embedBase({
        color: COLORES.medicina,
        titulo: `${EMOJI.detectado} Roles que ya estaban`,
        descripcion: truncar(lineas + extra),
        footer: 'Se conservan · vinculados al organigrama',
        timestamp: false,
      })
    );
  }

  // Faltantes por tipo con emojis distintos
  const faltCargo = faltantes.filter((f) => f.tipo === 'cargo');
  if (faltCargo.length) {
    const porRama = {};
    for (const f of faltCargo) {
      if (!porRama[f.rama]) porRama[f.rama] = [];
      porRama[f.rama].push(f.nombreRol);
    }
    const lineas = Object.entries(porRama)
      .map(([rama, nombres]) => {
        const emoji = EMOJI_RAMA[rama] || EMOJI.cargo;
        const titulo = ORGANIGRAMA[rama]?.nombre || rama;
        return `${emoji} **${titulo}** (${nombres.length})\n${nombres.slice(0, 8).map((n) => `· ${n}`).join('\n')}${nombres.length > 8 ? `\n· … +${nombres.length - 8}` : ''}`;
      })
      .join('\n\n');
    embeds.push(
      embedBase({
        color: COLORES.denegado,
        titulo: `${EMOJI.cargo} Cargos faltantes`,
        descripcion: truncar(lineas),
        footer: 'Análisis',
        timestamp: false,
      })
    );
  }

  const faltApoyo = faltantes.filter((f) => f.tipo === 'apoyo');
  if (faltApoyo.length) {
    embeds.push(
      embedBase({
        color: COLORES.neutral,
        titulo: `${EMOJI.apoyo} Roles de apoyo faltantes`,
        descripcion: truncar(faltApoyo.map((f) => `${EMOJI.apoyo} ${f.nombreRol}`).join('\n')),
        footer: 'Análisis',
        timestamp: false,
      })
    );
  }

  const faltLlave = faltantes.filter((f) => f.tipo === 'llave');
  if (faltLlave.length) {
    embeds.push(
      embedBase({
        color: 0xd4a017,
        titulo: `${EMOJI.llave} Llaves faltantes`,
        descripcion: truncar(
          faltLlave.slice(0, 20).map((f) => `${EMOJI.llave} ${f.nombreRol}`).join('\n') +
          (faltLlave.length > 20 ? `\n… +${faltLlave.length - 20}` : '') +
          '\n\nSe gestionan con **/config_llaves**.'
        ),
        footer: 'Análisis',
        timestamp: false,
      })
    );
  }

  if (parciales.length) {
    embeds.push(
      embedBase({
        color: 0xe8b923,
        titulo: `${EMOJI.parcial} Coincidencias parciales`,
        descripcion: truncar(
          parciales
            .slice(0, 12)
            .map((p) => `${EMOJI.parcial} **${p.rol.name}** ≈ ${p.esperado.nombreRol} (${Math.round(p.score * 100)}%)`)
            .join('\n')
        ),
        footer: 'No se vinculan solas · revisa manualmente',
        timestamp: false,
      })
    );
  }

  if (delBot.length) {
    embeds.push(
      embedBase({
        color: COLORES.cupula,
        titulo: `${EMOJI.bot} Roles creados por el bot`,
        descripcion: truncar(
          delBot.slice(0, 15).map((r) => `${EMOJI.bot} ${r.nombre_rol || r.cargo_key}`).join('\n') +
          (delBot.length > 15 ? `\n… +${delBot.length - 15}` : '') +
          '\n\nPuedes eliminarlos con la opción **Eliminar roles creados por el bot**.'
        ),
        footer: 'Solo estos se pueden borrar desde el bot',
        timestamp: false,
      })
    );
  }

  if (problemas.length) {
    embeds.push(
      embedBase({
        color: COLORES.denegado,
        titulo: `${EMOJI.problema} Problemas`,
        descripcion: problemas.slice(0, 10).join('\n'),
        footer: 'Análisis',
        timestamp: false,
      })
    );
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ANALIZAR', {
    detectados: detectados.length,
    faltantes: faltantes.length,
    delBot: delBot.length,
    originales: originales.length,
  });

  await interaction.editReply({
    embeds: embeds.slice(0, 10),
    components: [],
  });
}

async function mostrarMenuCrear(interaction) {
  const opciones = [
    { label: 'Todo lo faltante (cargos + apoyo)', value: 'todo', emoji: '🛠️' },
    { label: 'Solo roles de apoyo', value: 'apoyo', emoji: '🏷️' },
  ];

  for (const [key, rama] of Object.entries(ORGANIGRAMA)) {
    if (opciones.length >= 25) break;
    opciones.push({
      label: rama.nombre,
      value: key,
      description: `Rama ${rama.prefijo}`,
      emoji: EMOJI_RAMA[key] || '📋',
    });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`config_roles:crear_rama:${interaction.user.id}`)
    .setPlaceholder('Selecciona el alcance')
    .addOptions(opciones);

  await interaction.update({
    embeds: [
      embedBase({
        color: COLORES.neutral,
        titulo: '🛠️ Crear roles faltantes',
        descripcion: 'Solo se crean los que **no existen**. Los que ya estaban se dejan intactos. El estilo (hoist / mencionable) se copia de roles de la misma rama si hay alguno detectado.',
        footer: 'Administración',
      }),
    ],
    components: [new ActionRowBuilder().addComponents(menu)],
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

  const existentes = new Set(
    [...guild.roles.cache.values()].map((r) => normalizarNombre(r.name))
  );
  const aCrear = candidatos.filter((c) => !existentes.has(normalizarNombre(c.nombreRol)));

  if (aCrear.length === 0) {
    await interaction.update({
      embeds: [
        embedBase({
          color: COLORES.medicina,
          titulo: '🛠️ Crear roles',
          descripcion: `${EMOJI.detectado} No hay faltantes en este alcance. Los roles que ya estaban se conservan.`,
          footer: 'Administración',
        }),
      ],
      components: [],
    });
    return;
  }

  if (guild.roles.cache.size + aCrear.length > 250) {
    await interaction.update({
      embeds: [
        embedBase({
          color: COLORES.denegado,
          titulo: '🛠️ Límite de roles',
          descripcion: `Crear ${aCrear.length} roles superaría el límite de 250.`,
          footer: 'Administración',
        }),
      ],
      components: [],
    });
    return;
  }

  const preview = aCrear
    .slice(0, 20)
    .map((c) => `${EMOJI_RAMA[c.rama] || EMOJI.cargo} ${c.nombreRol}`)
    .join('\n');
  const extra = aCrear.length > 20 ? `\n… y ${aCrear.length - 20} más` : '';

  const btn = new ButtonBuilder()
    .setCustomId(`config_roles:crear_ejecutar:${interaction.user.id}:${alcance}`)
    .setLabel(`Crear ${aCrear.length} faltantes`)
    .setStyle(ButtonStyle.Success);

  await interaction.update({
    embeds: [
      embedBase({
        color: COLORES.neutral,
        titulo: '🛠️ Vista previa · solo faltantes',
        descripcion: `Se crearán **${aCrear.length}** roles. Los existentes no se tocan.\n\n${preview}${extra}`,
        footer: 'Administración',
      }),
    ],
    components: [new ActionRowBuilder().addComponents(btn)],
  });
}

async function onCrearEjecutar(interaction, args) {
  const alcance = args[1];
  await interaction.deferUpdate();

  const guild = interaction.guild;
  if (!guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.editReply({
      embeds: [
        embedBase({
          color: COLORES.denegado,
          titulo: '🛠️ Sin permiso',
          descripcion: 'El bot necesita el permiso **Manage Roles**.',
          footer: 'Administración',
        }),
      ],
      components: [],
    });
    return;
  }

  await guild.roles.fetch();
  const { cargos, apoyo, todos } = construirEsperados();

  // Detectar existentes para heredar estilo
  const rolesServidor = [...guild.roles.cache.values()].filter((r) => !r.managed);
  const detectados = [];
  for (const esperado of todos) {
    const normEsp = normalizarNombre(esperado.nombreRol);
    const match = rolesServidor.find((r) => normalizarNombre(r.name) === normEsp);
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
    embeds: [
      embedBase({
        color: COLORES.medicina,
        titulo: '🛠️ Roles creados',
        descripcion: `${EMOJI.bot} Creados por el bot: **${creados}**\n${EMOJI.original} Originales: sin cambios${errores.length ? `\n${EMOJI.problema} Errores: ${errores.length}` : ''}`,
        footer: 'Administración',
      }),
    ],
    components: [],
  });
}

async function onEliminarConfirmar(interaction) {
  const db = getDb();
  asegurarColumnaOrigen();
  const delBot = db.prepare("SELECT * FROM roles_map WHERE origen = 'bot'").all();

  if (!delBot.length) {
    const method = interaction.deferred || interaction.replied ? 'editReply' : 'update';
    await interaction[method]({
      embeds: [
        embedBase({
          color: COLORES.neutral,
          titulo: '🗑️ Eliminar roles del bot',
          descripcion: 'No hay roles marcados como creados por el bot. Ejecuta **Analizar** primero si acabas de desplegar.',
          footer: 'Administración',
        }),
      ],
      components: [],
    }).catch(() => {});
    return;
  }

  const lista = delBot.slice(0, 20).map((r) => `${EMOJI.bot} ${r.nombre_rol || r.cargo_key}`).join('\n');
  const extra = delBot.length > 20 ? `\n… y ${delBot.length - 20} más` : '';

  const btn = new ButtonBuilder()
    .setCustomId(`config_roles:eliminar_ejecutar:${interaction.user.id}`)
    .setLabel(`Eliminar ${delBot.length} roles del bot`)
    .setStyle(ButtonStyle.Danger);

  const method = interaction.isStringSelectMenu() ? 'update' : 'editReply';
  await interaction[method]({
    embeds: [
      embedBase({
        color: COLORES.denegado,
        titulo: '🗑️ Eliminar roles creados por el bot',
        descripcion: `Se eliminarán **solo** estos roles. Los que ya existían en el servidor **no se tocan**.\n\n${lista}${extra}`,
        footer: 'Confirmación requerida',
      }),
    ],
    components: [new ActionRowBuilder().addComponents(btn)],
  }).catch(async () => {
    await interaction.reply({
      embeds: [
        embedBase({
          color: COLORES.denegado,
          titulo: '🗑️ Eliminar roles creados por el bot',
          descripcion: `Se eliminarán **solo** estos roles.\n\n${lista}${extra}`,
          footer: 'Confirmación requerida',
        }),
      ],
      components: [new ActionRowBuilder().addComponents(btn)],
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
  });
}

async function onEliminarEjecutar(interaction) {
  await interaction.deferUpdate();

  const guild = interaction.guild;
  if (!guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.editReply({
      embeds: [
        embedBase({
          color: COLORES.denegado,
          titulo: '🗑️ Sin permiso',
          descripcion: 'El bot necesita **Manage Roles**.',
          footer: 'Administración',
        }),
      ],
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
      const rol = guild.roles.cache.get(row.role_id) || await guild.roles.fetch(row.role_id).catch(() => null);
      if (rol && rol.editable) {
        await rol.delete(`Aegis · eliminar roles del bot · ${interaction.user.tag}`);
        eliminados++;
        await new Promise((r) => setTimeout(r, 350));
      } else if (rol && !rol.editable) {
        fallos.push(row.nombre_rol || row.cargo_key);
      }
      db.prepare('DELETE FROM roles_map WHERE cargo_key = ? AND origen = ?').run(row.cargo_key, 'bot');
    } catch (err) {
      fallos.push(row.nombre_rol || row.cargo_key);
      console.error('[Eliminar rol bot]', err);
    }
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ELIMINAR_BOT', { eliminados, fallos: fallos.length });

  await interaction.editReply({
    embeds: [
      embedBase({
        color: COLORES.medicina,
        titulo: '🗑️ Roles del bot eliminados',
        descripcion: `${EMOJI.bot} Eliminados: **${eliminados}**\n${EMOJI.original} Roles originales: intactos${fallos.length ? `\n${EMOJI.problema} No se pudieron borrar: ${fallos.length}` : ''}`,
        footer: 'Administración',
      }),
    ],
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
    if (!esp || !esp.color) continue;
    const rol = guild.roles.cache.get(row.role_id);
    if (!rol || !rol.editable) continue;
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
    embeds: [
      embedBase({
        color: COLORES.neutral,
        titulo: '🎨 Colores sincronizados',
        descripcion: `Roles actualizados: **${actualizados}**`,
        footer: 'Administración',
      }),
    ],
    components: [],
  });
}

module.exports = { prefix, handle };

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
const { ORGANIGRAMA, ROLES_APOYO, getTodosCargos, formatoRol } = require('../data/organigrama');
const { LLAVES_INICIALES } = require('../data/llaves');
const { normalizarNombre, similitudDice } = require('../utils/helpers');

const prefix = 'config_roles';

function esAdmin(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)
  );
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
      return onCrearRama(interaction, args);
    case 'crear_confirmar':
      return onCrearConfirmar(interaction, args);
    case 'crear_ejecutar':
      return onCrearEjecutar(interaction, args);
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
    case 'vincular':
      await interaction.update({
        embeds: [
          embedBase({
            color: COLORES.neutral,
            titulo: '🔗 Vincular roles',
            descripcion: 'Ejecuta primero **Analizar roles**. Las coincidencias parciales aparecerán con opciones de vinculación en el informe.',
            footer: 'Administración',
          }),
        ],
        components: [],
      });
      break;
    case 'sincronizar':
      return sincronizarColores(interaction);
    case 'exportar':
      return analizar(interaction);
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

async function analizar(interaction) {
  await interaction.deferUpdate();

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: 'Este comando solo funciona dentro de un servidor.', embeds: [], components: [] });
    return;
  }

  await guild.roles.fetch();
  const rolesServidor = [...guild.roles.cache.values()].filter((r) => r.id !== guild.id);

  const { cargos, apoyo, llaves, todos } = construirEsperados();
  const db = getDb();

  const detectados = [];
  const parciales = [];
  const faltantes = [];
  const noReconocidos = [];

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
      db.prepare(
        `INSERT INTO roles_map (cargo_key, role_id, nombre_rol) VALUES (?, ?, ?)
         ON CONFLICT(cargo_key) DO UPDATE SET role_id = excluded.role_id, nombre_rol = excluded.nombre_rol, actualizado_en = datetime('now')`
      ).run(esperado.key, match.id, match.name);
    } else if (match && score >= 0.85) {
      parciales.push({ esperado, rol: match, score });
      usados.add(match.id);
    } else {
      faltantes.push(esperado);
    }
  }

  for (const rol of rolesServidor) {
    if (!usados.has(rol.id) && !rol.managed) {
      noReconocidos.push(rol);
    }
  }

  // Problemas
  const problemas = [];
  const botMember = guild.members.me;
  if (botMember) {
    const botPos = botMember.roles.highest.position;
    for (const d of detectados) {
      if (d.rol.position >= botPos) {
        problemas.push(`El rol **${d.rol.name}** está por encima o al mismo nivel que el bot.`);
      }
      if (d.rol.permissions.has(PermissionFlagsBits.Administrator)) {
        problemas.push(`El rol **${d.rol.name}** tiene permiso Administrator.`);
      }
    }
  }
  if (rolesServidor.length > 240) {
    problemas.push(`Cercanía al límite de 250 roles (${rolesServidor.length} actuales).`);
  }

  const porRama = {};
  for (const f of faltantes.filter((x) => x.tipo === 'cargo')) {
    porRama[f.rama] = (porRama[f.rama] || 0) + 1;
  }

  const embeds = [];

  embeds.push(
    embedBase({
      color: COLORES.neutral,
      titulo: '🧩 Informe de roles',
      campos: [
        { name: '✅ Detectados', value: `${detectados.length} de ${todos.length}`, inline: true },
        { name: '⚠️ Parciales', value: String(parciales.length), inline: true },
        { name: '❌ Faltantes', value: String(faltantes.length), inline: true },
      ],
      footer: 'Análisis',
    })
  );

  if (faltantes.filter((f) => f.tipo === 'cargo').length) {
    const lineas = Object.entries(porRama)
      .map(([rama, n]) => `**${ORGANIGRAMA[rama]?.nombre || rama}**: ${n}`)
      .join('\n');
    embeds.push(
      embedBase({
        color: COLORES.denegado,
        titulo: '❌ Cargos faltantes',
        descripcion: lineas,
        footer: 'Análisis',
        timestamp: false,
      })
    );
  }

  const apoyoFaltantes = faltantes.filter((f) => f.tipo === 'apoyo');
  if (apoyoFaltantes.length) {
    embeds.push(
      embedBase({
        color: COLORES.neutral,
        titulo: '➕ Roles de apoyo recomendados',
        descripcion: apoyoFaltantes.map((f) => f.nombreRol).join('\n') + '\n\nSirven para áreas, niveles de autorización, estado (Verificado / Suspendido / Visitante) y administración del bot.',
        footer: 'Análisis',
        timestamp: false,
      })
    );
  }

  const llavesFaltantes = faltantes.filter((f) => f.tipo === 'llave');
  const llavesDetectadas = detectados.filter((d) => d.esperado.tipo === 'llave');
  embeds.push(
    embedBase({
      color: 0xd4a017,
      titulo: '🔑 Llaves',
      descripcion: `Detectadas: **${llavesDetectadas.length}** · Faltantes: **${llavesFaltantes.length}**\n\nLa creación y edición de llaves se gestiona con **/config_llaves**.`,
      footer: 'Análisis',
      timestamp: false,
    })
  );

  if (problemas.length) {
    embeds.push(
      embedBase({
        color: COLORES.denegado,
        titulo: '🔺 Problemas detectados',
        descripcion: problemas.slice(0, 10).join('\n'),
        footer: 'Análisis',
        timestamp: false,
      })
    );
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ANALIZAR', {
    detectados: detectados.length,
    faltantes: faltantes.length,
    parciales: parciales.length,
  });

  await interaction.editReply({
    embeds: embeds.slice(0, 10),
    components: [],
  });
}

async function mostrarMenuCrear(interaction) {
  const opciones = [
    { label: 'Todo lo faltante', value: 'todo', description: 'Cargos + apoyo (sin llaves)' },
    { label: 'Solo roles de apoyo', value: 'apoyo' },
  ];

  for (const [key, rama] of Object.entries(ORGANIGRAMA)) {
    if (opciones.length >= 25) break;
    opciones.push({ label: rama.nombre, value: key, description: `Rama ${rama.prefijo}` });
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
        descripcion: 'Selecciona el alcance. Se mostrará una vista previa antes de crear nada.',
        footer: 'Administración',
      }),
    ],
    components: [new ActionRowBuilder().addComponents(menu)],
  });
}

async function onCrearRama(interaction, args) {
  const alcance = interaction.values[0];
  const guild = interaction.guild;
  await guild.roles.fetch();

  const { cargos, apoyo } = construirEsperados();
  let candidatos = [];

  if (alcance === 'todo') {
    candidatos = [...cargos, ...apoyo];
  } else if (alcance === 'apoyo') {
    candidatos = [...apoyo];
  } else {
    candidatos = cargos.filter((c) => c.rama === alcance);
  }

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
          descripcion: 'No hay roles faltantes en el alcance seleccionado.',
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

  const preview = aCrear.slice(0, 20).map((c) => c.nombreRol).join('\n');
  const extra = aCrear.length > 20 ? `\n… y ${aCrear.length - 20} más` : '';

  // Guardar temporalmente en memoria via customId truncated - usamos confirmación con alcance
  const btn = new ButtonBuilder()
    .setCustomId(`config_roles:crear_ejecutar:${interaction.user.id}:${alcance}`)
    .setLabel(`Crear ${aCrear.length} roles`)
    .setStyle(ButtonStyle.Success);

  await interaction.update({
    embeds: [
      embedBase({
        color: COLORES.neutral,
        titulo: '🛠️ Vista previa',
        descripcion: `Se crearán **${aCrear.length}** roles:\n\n${preview}${extra}\n\nSin permisos Administrator. No mencionables.`,
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
  if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
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
  const { cargos, apoyo } = construirEsperados();
  let candidatos = [];
  if (alcance === 'todo') candidatos = [...cargos, ...apoyo];
  else if (alcance === 'apoyo') candidatos = [...apoyo];
  else candidatos = cargos.filter((c) => c.rama === alcance);

  const existentes = new Set(
    [...guild.roles.cache.values()].map((r) => normalizarNombre(r.name))
  );
  const aCrear = candidatos.filter((c) => !existentes.has(normalizarNombre(c.nombreRol)));

  const db = getDb();
  let creados = 0;
  const errores = [];

  for (const item of aCrear) {
    try {
      const colorInt = parseInt((item.color || '#888780').replace('#', ''), 16);
      const rol = await guild.roles.create({
        name: item.nombreRol,
        colors: colorInt,
        mentionable: false,
        reason: `Aegis · config_roles · ${interaction.user.tag}`,
      });

      db.prepare(
        `INSERT INTO roles_map (cargo_key, role_id, nombre_rol) VALUES (?, ?, ?)
         ON CONFLICT(cargo_key) DO UPDATE SET role_id = excluded.role_id, nombre_rol = excluded.nombre_rol, actualizado_en = datetime('now')`
      ).run(item.key, rol.id, rol.name);

      creados++;
      await new Promise((r) => setTimeout(r, 300));
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
        descripcion: `Creados: **${creados}**${errores.length ? `\nErrores: ${errores.length}` : ''}`,
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
    if (!rol) continue;
    try {
      const colorInt = parseInt(esp.color.replace('#', ''), 16);
      if (rol.color !== colorInt) {
        await rol.setColors(colorInt, `Aegis · sync colores · ${interaction.user.tag}`);
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

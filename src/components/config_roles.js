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

const prefix = 'config_roles';

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

/** Nombre oficial del item en Discord */
function nombreOficial(item) {
  return item.nombreRol || item.nombre || item.key;
}

/**
 * Para CREAR: solo coincide si el nombre normalizado es exactamente el oficial
 * (o el nombre base sin prefijo). Evita falsos "ya existe".
 */
function existeExacto(rolDiscord, item) {
  const oficial = normalizarNombre(nombreOficial(item));
  const nom = normalizarNombre(rolDiscord.name);
  const base = normalizarNombre(nombreBaseRol(rolDiscord.name));
  if (!oficial) return false;
  if (nom === oficial) return true;
  // Separadores: comparar texto del separador
  if (item.tipo === 'separador' && (nom === oficial || base === oficial)) return true;
  // Cargo: nombre base igual al nombre del cargo (sin prefijo)
  if (item.nombre && base === normalizarNombre(item.nombre)) return true;
  return false;
}

function escanear(guild) {
  const roles = [...guild.roles.cache.values()].filter(
    (r) => r.id !== guild.id && !r.managed
  );
  const catalogo = getJerarquiaCompleta();
  const usados = new Set();
  const detectados = [];
  const faltantes = [];

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
    } else {
      faltantes.push(item);
    }
  }
  return { detectados, faltantes, rolesLeidos: roles.length, catalogo };
}

async function handle(interaction, accion, args) {
  if (!esAdmin(interaction)) {
    await interaction.reply({
      content: 'No tienes autorizacion para esta accion.',
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
    return;
  }
  const ownerId = args[0];
  if (ownerId && ownerId !== interaction.user.id) {
    await interaction.reply({
      content: 'Solo quien abrio el menu puede usarlo.',
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
    return;
  }

  if (accion === 'eliminar_todos_ejecutar' || accion === 'eliminar_todos_cancelar') {
    const h = require('./eliminar_todos_handlers');
    return h.handle(
      interaction,
      accion === 'eliminar_todos_ejecutar' ? 'ejecutar' : 'cancelar',
      args
    );
  }

  switch (accion) {
    case 'menu':
      return onMenu(interaction);
    case 'crear_confirmar':
      return onCrearConfirmar(interaction);
    case 'crear_ejecutar':
      return onCrearEjecutar(interaction);
    case 'organizar_confirmar':
      return onOrganizarConfirmar(interaction);
    case 'organizar_ejecutar':
      return onOrganizarEjecutar(interaction);
    case 'desplegar_ejecutar':
      return onDesplegarEjecutar(interaction);
    default:
      await interaction.reply({
        content: 'Accion no reconocida.',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
  }
}

async function onMenu(interaction) {
  const opcion = interaction.values[0];
  if (opcion === 'organigrama') return verOrganigrama(interaction);
  if (opcion === 'analizar') return analizar(interaction);
  if (opcion === 'crear') return onCrearConfirmar(interaction);
  if (opcion === 'desplegar') return onDesplegarConfirmar(interaction);
  if (opcion === 'organizar') return onOrganizarConfirmar(interaction);
  if (opcion === 'eliminar_bot') {
    await interaction.update({
      embeds: [embedBase({
        color: COLORES.neutral,
        titulo: 'Eliminar roles',
        descripcion: 'Usa `/eliminar_roles` para borrar todos los roles editables.',
        footer: 'Administracion',
      })],
      components: [],
    }).catch(() => {});
  }
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

  const embeds = chunks.slice(0, 8).map((desc, i) => embedBase({
    color: COLORES.neutral,
    titulo: i === 0 ? 'Organigrama · Fundacion Aegis-Meridian' : `Organigrama (cont. ${i + 1})`,
    descripcion: desc,
    footer: 'Custodes Veritatis',
    timestamp: i === 0,
  }));

  await interaction.editReply({ embeds, components: [] });
}

async function analizar(interaction) {
  await interaction.deferUpdate();
  await interaction.guild.roles.fetch();
  const { detectados, faltantes, rolesLeidos } = escanear(interaction.guild);

  const embeds = [embedBase({
    color: COLORES.neutral,
    titulo: 'Informe de roles',
    campos: [
      { name: 'Leidos', value: String(rolesLeidos), inline: true },
      { name: 'Detectados', value: String(detectados.length), inline: true },
      { name: 'Faltantes', value: String(faltantes.length), inline: true },
    ],
    footer: 'Match exacto por nombre oficial',
  })];

  if (detectados.length) {
    embeds.push(embedBase({
      color: COLORES.medicina,
      titulo: `Detectados (${detectados.length})`,
      descripcion: truncar(
        detectados.slice(0, 25).map((d) => `· **${d.rol.name}**`).join('\n')
      ),
      footer: 'Ya existen',
      timestamp: false,
    }));
  }
  if (faltantes.length) {
    embeds.push(embedBase({
      color: COLORES.denegado,
      titulo: `Faltantes (${faltantes.length})`,
      descripcion: truncar(
        faltantes.slice(0, 30).map((f) => `· ${nombreOficial(f)}`).join('\n')
      ),
      footer: 'Usa Desplegar organigrama',
      timestamp: false,
    }));
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ANALIZAR', {
    detectados: detectados.length,
    faltantes: faltantes.length,
  });
  await interaction.editReply({ embeds: embeds.slice(0, 8), components: [] });
}

async function onDesplegarConfirmar(interaction) {
  await interaction.guild.roles.fetch();
  const { faltantes, detectados } = escanear(interaction.guild);
  const total = faltantes.length + detectados.length;

  const payload = {
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: 'Desplegar organigrama',
      descripcion: [
        `Se crearan **${faltantes.length}** roles faltantes`,
        `(separadores, cargos y permisos).`,
        `Ya existen: **${detectados.length}** / total catalogo: **${total}**.`,
        '',
        'Despues se ordenaran automaticamente en la jerarquia.',
        '',
        truncar(faltantes.slice(0, 20).map((f) => `· ${nombreOficial(f)}`).join('\n')),
        faltantes.length > 20 ? `… +${faltantes.length - 20}` : '',
      ].filter(Boolean).join('\n'),
      footer: 'Confirmacion',
    })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`config_roles:desplegar_ejecutar:${interaction.user.id}`)
        .setLabel(faltantes.length ? `Crear ${faltantes.length} y ordenar` : 'Solo ordenar')
        .setStyle(ButtonStyle.Success)
    )],
  };
  if (interaction.isStringSelectMenu()) await interaction.update(payload).catch(() => {});
  else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
}

async function onCrearConfirmar(interaction) {
  return onDesplegarConfirmar(interaction);
}

/** Crea faltantes y luego organiza. */
async function onDesplegarEjecutar(interaction) {
  await interaction.update({
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: 'Desplegando organigrama',
      descripcion: 'Creando roles y ordenando. No pulses de nuevo.',
      footer: 'Administracion',
    })],
    components: [],
  }).catch(async () => {
    await interaction.deferUpdate().catch(() => {});
  });

  const guild = interaction.guild;
  if (!guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.editReply({
      embeds: [embedBase({
        color: COLORES.denegado,
        titulo: 'Sin permiso',
        descripcion: 'El bot necesita **Manage Roles** y su rol debe estar por encima de los roles que crea.',
        footer: 'Administracion',
      })],
      components: [],
    });
    return;
  }

  await guild.roles.fetch();
  let { faltantes } = escanear(guild);
  let creados = 0;
  const errores = [];

  for (const item of faltantes) {
    try {
      const nombre = nombreOficial(item);
      // Discord limita nombres a 100 caracteres
      const nombreFinal = String(nombre).slice(0, 100);
      const colorInt = parseInt(String(item.color || '#888780').replace('#', ''), 16);
      const rol = await guild.roles.create({
        name: nombreFinal,
        color: Number.isFinite(colorInt) ? colorInt : 0x888780,
        hoist: false,
        mentionable: false,
        reason: `Aegis · desplegar organigrama · ${interaction.user.tag}`,
      });
      guardarMapa(item.key, rol.id, rol.name, 'bot');
      creados++;
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      errores.push(nombreOficial(item));
      console.error('[Crear rol]', nombreOficial(item), err.message || err);
    }
  }

  // Re-fetch y organizar
  await guild.roles.fetch();
  const { detectados } = escanear(guild);
  const ordenados = [...detectados].sort(
    (a, b) => (a.item.orden || 999) - (b.item.orden || 999)
  );

  const botPos = guild.members.me.roles.highest.position;
  let pos = botPos - 1;
  let movidos = 0;
  let fallosPos = 0;

  for (const d of ordenados) {
    const rol = guild.roles.cache.get(d.rol.id);
    if (!rol || !rol.editable || rol.position >= botPos) {
      fallosPos++;
      continue;
    }
    try {
      if (pos < 1) break;
      await rol.setPosition(pos, {
        reason: `Aegis · organizar · ${interaction.user.tag}`,
      });
      pos--;
      movidos++;
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      fallosPos++;
      console.error('[Organizar]', rol.name, err.message || err);
    }
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.DESPLEGAR', {
    creados,
    errores: errores.length,
    movidos,
    fallosPos,
  });

  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Organigrama desplegado',
      descripcion: [
        `Roles creados: **${creados}**`,
        errores.length ? `Errores al crear: **${errores.length}**` : null,
        `Roles ordenados: **${movidos}**`,
        fallosPos ? `Sin mover (jerarquia del bot): **${fallosPos}**` : null,
        '',
        'El rol del bot debe quedar **por encima** de todos los roles del organigrama.',
      ].filter((x) => x !== null && x !== undefined).join('\n'),
      footer: 'Administracion',
    })],
    components: [],
  });
}

async function onCrearEjecutar(interaction) {
  return onDesplegarEjecutar(interaction);
}

async function onOrganizarConfirmar(interaction) {
  const payload = {
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: 'Organizar jerarquia',
      descripcion:
        'Coloca cada rol del organigrama en su seccion (Fundacion arriba, luego Direcciones, Moderacion, etc.).',
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
  await interaction.update({
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: 'Organizando',
      descripcion: 'Procesando…',
      footer: 'Administracion',
    })],
    components: [],
  }).catch(async () => {
    await interaction.deferUpdate().catch(() => {});
  });

  const guild = interaction.guild;
  if (!guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.editReply({
      embeds: [embedBase({
        color: COLORES.denegado,
        titulo: 'Sin permiso',
        descripcion: 'Se necesita **Manage Roles**.',
        footer: 'Administracion',
      })],
      components: [],
    });
    return;
  }

  await guild.roles.fetch();
  const { detectados } = escanear(guild);
  const ordenados = [...detectados].sort(
    (a, b) => (a.item.orden || 999) - (b.item.orden || 999)
  );

  const botPos = guild.members.me.roles.highest.position;
  let pos = botPos - 1;
  let movidos = 0;
  let fallos = 0;

  for (const d of ordenados) {
    const rol = guild.roles.cache.get(d.rol.id);
    if (!rol || !rol.editable || rol.position >= botPos) {
      fallos++;
      continue;
    }
    try {
      if (pos < 1) break;
      await rol.setPosition(pos, {
        reason: `Aegis · organizar · ${interaction.user.tag}`,
      });
      pos--;
      movidos++;
      await new Promise((r) => setTimeout(r, 400));
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

module.exports = { prefix, handle };

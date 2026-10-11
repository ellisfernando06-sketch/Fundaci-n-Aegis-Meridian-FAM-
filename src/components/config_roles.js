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
const { normalizarNombre, truncar } = require('../utils/helpers');

const prefix = 'config_roles';

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
  return false;
}

function coincide(rol, item) {
  const base = normalizarNombre(nombreBaseRol(rol.name));
  const nom = normalizarNombre(rol.name);
  const esp = normalizarNombre(item.nombre || nombreBaseRol(item.nombreRol || ''));
  if (!esp) return false;
  if (base === esp || nom === esp) return true;
  if (item.aliases) {
    for (const a of item.aliases) {
      const na = normalizarNombre(a);
      if (base === na || nom === na) return true;
      if (na.length >= 5 && (base.includes(na) || nom.includes(na))) return true;
    }
  }
  if (esp.length >= 5 && (base.includes(esp) || nom.includes(esp))) return true;
  return false;
}

function escanear(guild) {
  const roles = [...guild.roles.cache.values()].filter(
    (r) => r.id !== guild.id && !r.managed && !debeIgnorar(r.name)
  );
  const catalogo = getJerarquiaCompleta();
  const usados = new Set();
  const detectados = [];
  const faltantes = [];

  for (const item of catalogo) {
    let match = null;
    for (const rol of roles) {
      if (usados.has(rol.id)) continue;
      if (coincide(rol, item)) {
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
    await interaction.reply({ content: 'No tienes autorizacion para esta accion.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }
  const ownerId = args[0];
  if (ownerId && ownerId !== interaction.user.id) {
    await interaction.reply({ content: 'Solo quien abrio el menu puede usarlo.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  if (accion === 'eliminar_todos_ejecutar' || accion === 'eliminar_todos_cancelar') {
    const h = require('./eliminar_todos_handlers');
    return h.handle(interaction, accion === 'eliminar_todos_ejecutar' ? 'ejecutar' : 'cancelar', args);
  }

  switch (accion) {
    case 'menu': return onMenu(interaction);
    case 'crear_confirmar': return onCrearConfirmar(interaction);
    case 'crear_ejecutar': return onCrearEjecutar(interaction);
    case 'organizar_confirmar': return onOrganizarConfirmar(interaction);
    case 'organizar_ejecutar': return onOrganizarEjecutar(interaction);
    default:
      await interaction.reply({ content: 'Accion no reconocida.', flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}

async function onMenu(interaction) {
  const opcion = interaction.values[0];
  if (opcion === 'analizar') return analizar(interaction);
  if (opcion === 'crear') return onCrearConfirmar(interaction);
  if (opcion === 'organizar') return onOrganizarConfirmar(interaction);
  if (opcion === 'renombrar') return onCrearConfirmar(interaction);
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
    footer: 'Organigrama Aegis-Meridian',
  })];

  if (detectados.length) {
    embeds.push(embedBase({
      color: COLORES.medicina,
      titulo: `Detectados (${detectados.length})`,
      descripcion: truncar(detectados.slice(0, 25).map((d) => `· **${d.rol.name}** → \`${d.item.key}\``).join('\n')),
      footer: 'Se reutilizan',
      timestamp: false,
    }));
  }
  if (faltantes.length) {
    embeds.push(embedBase({
      color: COLORES.denegado,
      titulo: `Faltantes (${faltantes.length})`,
      descripcion: truncar(faltantes.slice(0, 25).map((f) => `· ${f.nombreRol || f.nombre}`).join('\n')),
      footer: 'Usa Crear roles faltantes',
      timestamp: false,
    }));
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ANALIZAR', {
    detectados: detectados.length, faltantes: faltantes.length,
  });
  await interaction.editReply({ embeds: embeds.slice(0, 8), components: [] });
}

async function onCrearConfirmar(interaction) {
  await interaction.guild.roles.fetch();
  const { faltantes } = escanear(interaction.guild);

  if (!faltantes.length) {
    const payload = {
      embeds: [embedBase({
        color: COLORES.medicina,
        titulo: 'Crear roles',
        descripcion: 'No hay faltantes. Todo el organigrama ya existe por nombre.',
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
      titulo: `Crear ${faltantes.length} roles`,
      descripcion: `Se crearan con formato **XX ●┇Nombre**.\n\n${preview}${faltantes.length > 25 ? `\n… +${faltantes.length - 25}` : ''}`,
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
  // Quitar boton al confirmar
  await interaction.update({
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: 'Creando roles',
      descripcion: 'Procesando. No pulses de nuevo.',
      footer: 'Administracion',
    })],
    components: [],
  }).catch(async () => { await interaction.deferUpdate().catch(() => {}); });

  const guild = interaction.guild;
  if (!guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.editReply({
      embeds: [embedBase({ color: COLORES.denegado, titulo: 'Sin permiso', descripcion: 'Se necesita **Manage Roles**.', footer: 'Administracion' })],
      components: [],
    });
    return;
  }

  await guild.roles.fetch();
  const { faltantes } = escanear(guild);
  let creados = 0;
  const errores = [];

  for (const item of faltantes) {
    try {
      const nombre = item.nombreRol || item.nombre;
      const colorInt = parseInt(String(item.color || '#888780').replace('#', ''), 16);
      const rol = await guild.roles.create({
        name: nombre,
        color: Number.isFinite(colorInt) ? colorInt : 0x888780,
        hoist: false,
        mentionable: false,
        reason: `Aegis · crear organigrama · ${interaction.user.tag}`,
      });
      guardarMapa(item.key, rol.id, rol.name, 'bot');
      creados++;
      await new Promise((r) => setTimeout(r, 350));
    } catch (err) {
      errores.push(item.nombreRol || item.nombre || item.key);
      console.error('[Crear rol]', err.message || err);
    }
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.CREAR', { creados, errores: errores.length });
  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Roles creados',
      descripcion: `Creados: **${creados}**${errores.length ? `\nErrores: ${errores.length}` : ''}\n\nUsa **Organizar jerarquia** para ordenarlos.`,
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
      descripcion: 'Coloca cada rol del organigrama en su seccion (Gerente SI encima de Director General).',
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
    embeds: [embedBase({ color: COLORES.neutral, titulo: 'Organizando', descripcion: 'Procesando…', footer: 'Administracion' })],
    components: [],
  }).catch(async () => { await interaction.deferUpdate().catch(() => {}); });

  const guild = interaction.guild;
  if (!guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    await interaction.editReply({
      embeds: [embedBase({ color: COLORES.denegado, titulo: 'Sin permiso', descripcion: 'Se necesita **Manage Roles**.', footer: 'Administracion' })],
      components: [],
    });
    return;
  }

  await guild.roles.fetch();
  const { detectados } = escanear(guild);
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

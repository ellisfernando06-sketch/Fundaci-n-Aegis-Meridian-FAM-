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

function nombreOficial(item) {
  return item.nombreRol || item.nombre || item.key;
}

function existeExacto(rolDiscord, item) {
  const oficial = normalizarNombre(nombreOficial(item));
  const nom = normalizarNombre(rolDiscord.name);
  const base = normalizarNombre(nombreBaseRol(rolDiscord.name));
  if (!oficial) return false;
  if (nom === oficial) return true;
  if (item.tipo === 'separador' && (nom === oficial || base === oficial)) return true;
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
  const aRenombrar = [];

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
      const destino = String(nombreOficial(item)).slice(0, 100);
      if (match.name !== destino) {
        aRenombrar.push({
          item,
          rol: match,
          nombreActual: match.name,
          nombreDestino: destino,
        });
      }
    } else {
      faltantes.push(item);
    }
  }
  return { detectados, faltantes, aRenombrar, rolesLeidos: roles.length, catalogo };
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
    case 'menu': return onMenu(interaction);
    case 'crear_confirmar':
    case 'desplegar_ejecutar':
    case 'crear_ejecutar': return onCrearEjecutar(interaction);
    case 'renombrar_confirmar': return onRenombrarConfirmar(interaction);
    case 'renombrar_ejecutar': return onRenombrarEjecutar(interaction);
    case 'organizar_confirmar': return onOrganizarConfirmar(interaction);
    case 'organizar_ejecutar': return onOrganizarEjecutar(interaction);
    case 'eliminar_confirmar': return onEliminarConfirmar(interaction);
    case 'eliminar_ejecutar': return onEliminarEjecutar(interaction);
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
  if (opcion === 'crear' || opcion === 'desplegar') return onCrearConfirmar(interaction);
  if (opcion === 'renombrar') return onRenombrarConfirmar(interaction);
  if (opcion === 'organizar') return onOrganizarConfirmar(interaction);
  if (opcion === 'eliminar_bot') return onEliminarConfirmar(interaction);
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
  const { detectados, faltantes, aRenombrar, rolesLeidos } = escanear(interaction.guild);
  const embeds = [embedBase({
    color: COLORES.neutral,
    titulo: 'Informe de roles',
    campos: [
      { name: 'Leidos', value: String(rolesLeidos), inline: true },
      { name: 'Detectados', value: String(detectados.length), inline: true },
      { name: 'Faltantes', value: String(faltantes.length), inline: true },
      { name: 'Por renombrar', value: String(aRenombrar.length), inline: true },
    ],
    footer: 'Panel de roles',
  })];
  if (faltantes.length) {
    embeds.push(embedBase({
      color: COLORES.denegado,
      titulo: `Faltantes (${faltantes.length})`,
      descripcion: truncar(faltantes.slice(0, 25).map((f) => `· ${nombreOficial(f)}`).join('\n')),
      footer: 'Usa Crear roles',
      timestamp: false,
    }));
  }
  if (aRenombrar.length) {
    embeds.push(embedBase({
      color: 0xe8b923,
      titulo: `Por renombrar (${aRenombrar.length})`,
      descripcion: truncar(aRenombrar.slice(0, 20).map((r) => `**${r.nombreActual}** → \`${r.nombreDestino}\``).join('\n')),
      footer: 'Usa Renombrar',
      timestamp: false,
    }));
  }
  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ANALIZAR', {
    detectados: detectados.length, faltantes: faltantes.length, aRenombrar: aRenombrar.length,
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
        descripcion: 'No hay faltantes. Todo el organigrama ya existe.',
        footer: 'Administracion',
      })],
      components: [],
    };
    if (interaction.isStringSelectMenu()) await interaction.update(payload).catch(() => {});
    else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }
  const preview = faltantes.slice(0, 25).map((f) => `· ${nombreOficial(f)}`).join('\n');
  const payload = {
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: `Crear ${faltantes.length} roles`,
      descripcion: `Se crearan y luego se ordenaran.\n\n${preview}${faltantes.length > 25 ? `\n… +${faltantes.length - 25}` : ''}`,
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
      embeds: [embedBase({
        color: COLORES.denegado,
        titulo: 'Sin permiso',
        descripcion: 'Se necesita **Manage Roles** y el rol del bot por encima de los que cree.',
        footer: 'Administracion',
      })],
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
      const nombreFinal = String(nombreOficial(item)).slice(0, 100);
      const colorInt = parseInt(String(item.color || '#888780').replace('#', ''), 16);
      const rol = await guild.roles.create({
        name: nombreFinal,
        color: Number.isFinite(colorInt) ? colorInt : 0x888780,
        hoist: false,
        mentionable: false,
        reason: `Aegis · crear · ${interaction.user.tag}`,
      });
      guardarMapa(item.key, rol.id, rol.name, 'bot');
      creados++;
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      errores.push(nombreOficial(item));
      console.error('[Crear]', nombreOficial(item), err.message || err);
    }
  }

  // Ordenar tras crear
  await guild.roles.fetch();
  const movidos = await ordenarRoles(guild, interaction.user.tag);

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.CREAR', {
    creados, errores: errores.length, movidos,
  });

  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Roles creados',
      descripcion: [
        `Creados: **${creados}**`,
        errores.length ? `Errores: **${errores.length}**` : null,
        `Ordenados: **${movidos}**`,
      ].filter(Boolean).join('\n'),
      footer: 'Administracion',
    })],
    components: [],
  });
}

async function onRenombrarConfirmar(interaction) {
  await interaction.guild.roles.fetch();
  const { aRenombrar } = escanear(interaction.guild);
  if (!aRenombrar.length) {
    const payload = {
      embeds: [embedBase({
        color: COLORES.medicina,
        titulo: 'Renombrar roles',
        descripcion: 'Todos los detectados ya tienen el nombre oficial.',
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
      titulo: `Renombrar ${aRenombrar.length} roles`,
      descripcion: `Se aplica el nombre oficial del organigrama.\n\n${preview}${aRenombrar.length > 20 ? `\n… +${aRenombrar.length - 20}` : ''}`,
      footer: 'Confirmacion',
    })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`config_roles:renombrar_ejecutar:${interaction.user.id}`)
        .setLabel(`Renombrar ${aRenombrar.length}`)
        .setStyle(ButtonStyle.Primary)
    )],
  };
  if (interaction.isStringSelectMenu()) await interaction.update(payload).catch(() => {});
  else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
}

async function onRenombrarEjecutar(interaction) {
  await interaction.update({
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: 'Renombrando',
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
  const { aRenombrar } = escanear(guild);
  let hechos = 0;
  const fallos = [];

  for (const r of aRenombrar) {
    try {
      const rol = guild.roles.cache.get(r.rol.id);
      if (!rol || !rol.editable) { fallos.push(r.nombreActual); continue; }
      if (rol.name === r.nombreDestino) continue;
      await rol.setName(r.nombreDestino, `Aegis · renombrar · ${interaction.user.tag}`);
      guardarMapa(r.item.key, rol.id, r.nombreDestino, 'existente');
      hechos++;
      await new Promise((res) => setTimeout(res, 400));
    } catch (err) {
      fallos.push(r.nombreActual);
      console.error('[Renombrar]', r.nombreActual, err.message || err);
    }
  }

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.RENOMBRAR', { hechos, fallos: fallos.length });
  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Renombres aplicados',
      descripcion: `Actualizados: **${hechos}**${fallos.length ? `\nSin cambiar: ${fallos.length}` : ''}`,
      footer: 'Administracion',
    })],
    components: [],
  });
}

async function onOrganizarConfirmar(interaction) {
  const payload = {
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: 'Ordenar jerarquia',
      descripcion: 'Coloca cada rol detectado en su seccion (Fundacion arriba → Direcciones → Moderacion → …).',
      footer: 'Confirmacion',
    })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`config_roles:organizar_ejecutar:${interaction.user.id}`)
        .setLabel('Ordenar ahora')
        .setStyle(ButtonStyle.Primary)
    )],
  };
  if (interaction.isStringSelectMenu()) await interaction.update(payload).catch(() => {});
  else await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => {});
}

async function ordenarRoles(guild, tag) {
  const { detectados } = escanear(guild);
  const ordenados = [...detectados].sort(
    (a, b) => (a.item.orden || 999) - (b.item.orden || 999)
  );
  const botPos = guild.members.me.roles.highest.position;
  let pos = botPos - 1;
  let movidos = 0;
  for (const d of ordenados) {
    const rol = guild.roles.cache.get(d.rol.id);
    if (!rol || !rol.editable || rol.position >= botPos) continue;
    try {
      if (pos < 1) break;
      await rol.setPosition(pos, { reason: `Aegis · ordenar · ${tag}` });
      pos--;
      movidos++;
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      console.error('[Ordenar]', rol.name, err.message || err);
    }
  }
  return movidos;
}

async function onOrganizarEjecutar(interaction) {
  await interaction.update({
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: 'Ordenando',
      descripcion: 'Procesando…',
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
  const movidos = await ordenarRoles(guild, interaction.user.tag);
  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ORGANIZAR', { movidos });
  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Jerarquia ordenada',
      descripcion: `Roles en su lugar: **${movidos}**`,
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
        descripcion: 'No hay roles creados por el bot registrados.\n\nPara borrar todos los roles editables usa `/eliminar_roles`.',
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
      descripcion: preview + (lista.length > 25 ? `\n… +${lista.length - 25}` : ''),
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
  await interaction.update({
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: 'Eliminando',
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

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ELIMINAR_BOT', {
    eliminados, fallos: fallos.length,
  });
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

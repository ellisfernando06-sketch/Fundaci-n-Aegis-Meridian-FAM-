const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');
const { getDb, nextId } = require('../db');
const roblox = require('../services/roblox');
const auditoria = require('../services/auditoria');
const { embedBase, COLORES, accesoDenegado } = require('../utils/plantillas');
const { ORGANIGRAMA } = require('../data/organigrama');
const { sanitizar, truncar } = require('../utils/helpers');

const prefix = 'perfil';

const AREAS = Object.entries(ORGANIGRAMA)
  .filter(([k]) => k !== 'insurgencia')
  .map(([key, rama]) => ({
    label: rama.nombre,
    value: key,
    description: `Área · ${rama.nombre}`,
  }));

async function handle(interaction, accion, args) {
  const userId = args[0] || interaction.user.id;

  // Solo quien ejecutó el comando puede usar su menú
  if (userId !== interaction.user.id && !['ver_otro'].includes(accion)) {
    // Permitir ver ficha de otros en flujo específico
  }

  switch (accion) {
    case 'menu':
      return onMenu(interaction, args);
    case 'crear_modal':
      return mostrarModalCrear(interaction);
    case 'crear_submit':
      return onCrearSubmit(interaction);
    case 'area':
      return onAreaSeleccionada(interaction, args);
    case 'verificar':
      return onVerificar(interaction, args);
    case 'cancelar':
      return onCancelar(interaction, args);
    case 'confirmar_si':
      return onConfirmarSi(interaction, args);
    case 'confirmar_no':
      return onConfirmarNo(interaction, args);
    case 'ver':
      return onVer(interaction);
    case 'ver_select':
      return onVerSelect(interaction);
    case 'editar_modal':
      return mostrarModalEditar(interaction);
    case 'editar_submit':
      return onEditarSubmit(interaction);
    case 'eliminar_confirmar':
      return onEliminarConfirmar(interaction);
    case 'eliminar':
      return onEliminar(interaction);
    case 'revalidar':
      return onRevalidar(interaction);
    default:
      await interaction.reply({
        content: 'Acción no reconocida.',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
  }
}

async function onMenu(interaction, args) {
  const opcion = interaction.values[0];
  const ownerId = args[0];

  if (ownerId !== interaction.user.id) {
    await interaction.update({
      content: 'Solo quien abrió el menú puede usarlo.',
      embeds: [],
      components: [],
    }).catch(() => {});
    return;
  }

  switch (opcion) {
    case 'crear':
      return mostrarModalCrear(interaction);
    case 'ver':
      return onVer(interaction);
    case 'editar':
      return mostrarModalEditar(interaction);
    case 'eliminar':
      return onEliminarConfirmar(interaction);
    case 'revalidar':
      return onRevalidar(interaction);
  }
}

async function mostrarModalCrear(interaction) {
  const db = getDb();
  const existente = db.prepare('SELECT verificado FROM perfiles WHERE discord_id = ?').get(interaction.user.id);
  if (existente?.verificado) {
    await interaction.update({
      content: null,
      embeds: [
        embedBase({
          color: COLORES.medicina,
          titulo: '🗂️ Ficha de personal',
          descripcion: 'Ya tienes una ficha verificada. Usa **Revalidar** si cambió tu nombre de Roblox.',
          footer: 'Personal',
        }),
      ],
      components: [],
    }).catch(() => {});
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`perfil:crear_submit:${interaction.user.id}`)
    .setTitle('Crear ficha de personal');

  const personaje = new TextInputBuilder()
    .setCustomId('personaje')
    .setLabel('Nombre del personaje')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(60)
    .setPlaceholder('Nombre que usarás en el servidor');

  const robloxUser = new TextInputBuilder()
    .setCustomId('roblox')
    .setLabel('Usuario de Roblox')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(40)
    .setPlaceholder('Tu nombre de usuario en Roblox');

  modal.addComponents(
    new ActionRowBuilder().addComponents(personaje),
    new ActionRowBuilder().addComponents(robloxUser)
  );

  await interaction.showModal(modal);
}

async function onCrearSubmit(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const personaje = sanitizar(interaction.fields.getTextInputValue('personaje').trim());
  const robloxUsername = interaction.fields.getTextInputValue('roblox').trim();

  if (!personaje || !robloxUsername) {
    await interaction.editReply({ content: 'Debes completar todos los campos.' });
    return;
  }

  let user;
  try {
    user = await roblox.buscarPorUsuario(robloxUsername);
  } catch (err) {
    console.error('[Roblox]', err);
    await interaction.editReply({ content: 'No se pudo contactar con la API de Roblox. Inténtalo de nuevo más tarde.' });
    return;
  }

  if (!user || user.requestedUsername === undefined && !user.id) {
    // API puede devolver requestedUsername cuando no existe
  }
  if (!user || !user.id) {
    await interaction.editReply({
      embeds: [
        embedBase({
          color: COLORES.denegado,
          titulo: '🚫 Usuario no encontrado',
          descripcion: `No existe una cuenta de Roblox con el nombre **${sanitizar(robloxUsername)}**.`,
          footer: 'Verificación',
        }),
      ],
    });
    return;
  }

  const db = getDb();

  // Un Roblox ID solo puede estar vinculado a un Discord
  const yaVinculado = db.prepare('SELECT discord_id FROM perfiles WHERE roblox_id = ? AND discord_id != ?').get(String(user.id), interaction.user.id);
  if (yaVinculado) {
    await interaction.editReply({
      embeds: [
        embedBase({
          color: COLORES.denegado,
          titulo: '🚫 Cuenta ya vinculada',
          descripcion: 'Ese ID de Roblox ya está vinculado a otra ficha de Discord.',
          footer: 'Verificación',
        }),
      ],
    });
    return;
  }

  const codigo = roblox.generarCodigo();
  const vence = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO verificaciones (discord_id, roblox_id, roblox_usuario, codigo, personaje, vence_en)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(interaction.user.id, String(user.id), user.name || robloxUsername, codigo, personaje, vence);

  // Menú de área
  const menuArea = new StringSelectMenuBuilder()
    .setCustomId(`perfil:area:${interaction.user.id}:${user.id}:${codigo}`)
    .setPlaceholder('Selecciona el área solicitada')
    .addOptions(AREAS.slice(0, 25));

  const embed = embedBase({
    color: COLORES.cupula,
    titulo: '🔐 Verifica tu cuenta de Roblox',
    campos: [
      { name: 'Usuario de Roblox', value: `@${user.name || robloxUsername}`, inline: true },
      { name: 'Código', value: `\`${codigo}\``, inline: true },
      { name: 'Vence en', value: '10 minutos', inline: true },
    ],
    descripcion: 'Coloca el código en la **descripción** de tu perfil de Roblox. Luego selecciona el área y pulsa **Verificar ahora**.\n\nNunca te pediremos tu contraseña.',
    footer: 'Verificación',
  });

  await interaction.editReply({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menuArea)],
  });
}

async function onAreaSeleccionada(interaction, args) {
  const [ownerId, robloxId, codigo] = args;
  if (ownerId !== interaction.user.id) {
    await interaction.reply({ content: 'Solo quien inició la verificación puede continuar.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  const area = interaction.values[0];
  const db = getDb();

  db.prepare(
    'UPDATE verificaciones SET area_solicitada = ? WHERE discord_id = ? AND codigo = ? AND usado = 0'
  ).run(area, ownerId, codigo);

  const btnVerificar = new ButtonBuilder()
    .setCustomId(`perfil:verificar:${ownerId}:${robloxId}:${codigo}`)
    .setLabel('Verificar ahora')
    .setStyle(ButtonStyle.Success)
    .setEmoji('✅');

  const btnCancelar = new ButtonBuilder()
    .setCustomId(`perfil:cancelar:${ownerId}:${codigo}`)
    .setLabel('Cancelar')
    .setStyle(ButtonStyle.Secondary);

  const areaNombre = ORGANIGRAMA[area]?.nombre || area;

  await interaction.update({
    embeds: [
      embedBase({
        color: COLORES.cupula,
        titulo: '🔐 Verifica tu cuenta de Roblox',
        campos: [
          { name: 'Código', value: `\`${codigo}\``, inline: true },
          { name: 'Área solicitada', value: areaNombre, inline: true },
          { name: 'Vence en', value: '10 minutos', inline: true },
        ],
        descripcion: 'Coloca el código en la **descripción** de tu perfil de Roblox y pulsa **Verificar ahora**.\n\nNunca te pediremos tu contraseña.',
        footer: 'Verificación',
      }),
    ],
    components: [new ActionRowBuilder().addComponents(btnVerificar, btnCancelar)],
  });
}

async function onVerificar(interaction, args) {
  const [ownerId, robloxId, codigo] = args;
  if (ownerId !== interaction.user.id) {
    await interaction.reply({ content: 'Solo quien inició la verificación puede continuar.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  await interaction.deferUpdate();

  const db = getDb();
  const verif = db.prepare(
    'SELECT * FROM verificaciones WHERE discord_id = ? AND codigo = ? AND usado = 0 ORDER BY id DESC LIMIT 1'
  ).get(ownerId, codigo);

  if (!verif) {
    await interaction.editReply({
      embeds: [
        embedBase({
          color: COLORES.denegado,
          titulo: '🚫 Código inválido',
          descripcion: 'El código no existe o ya fue utilizado.',
          footer: 'Verificación',
        }),
      ],
      components: [],
    });
    return;
  }

  if (new Date(verif.vence_en) < new Date()) {
    await interaction.editReply({
      embeds: [
        embedBase({
          color: COLORES.denegado,
          titulo: '🚫 Código vencido',
          descripcion: 'El código expiró. Inicia de nuevo el proceso de verificación.',
          footer: 'Verificación',
        }),
      ],
      components: [],
    });
    return;
  }

  let coincide = false;
  try {
    coincide = await roblox.verificarCodigo(robloxId, codigo);
  } catch (err) {
    console.error('[Roblox verify]', err);
    await interaction.editReply({
      content: 'No se pudo contactar con la API de Roblox. Inténtalo de nuevo en unos segundos.',
      embeds: [],
      components: [],
    });
    return;
  }

  if (!coincide) {
    await interaction.editReply({
      embeds: [
        embedBase({
          color: COLORES.denegado,
          titulo: '🚫 Código no encontrado',
          descripcion: 'El código no aparece en la descripción de tu perfil de Roblox. Colócalo y vuelve a intentarlo antes de que venza.',
          footer: 'Verificación',
        }),
      ],
    });
    return;
  }

  let avatar = null;
  try {
    avatar = await roblox.obtenerAvatar(robloxId);
  } catch (_) {}

  const btnSi = new ButtonBuilder()
    .setCustomId(`perfil:confirmar_si:${ownerId}:${robloxId}:${codigo}`)
    .setLabel('Sí, soy yo')
    .setStyle(ButtonStyle.Success);

  const btnNo = new ButtonBuilder()
    .setCustomId(`perfil:confirmar_no:${ownerId}:${robloxId}:${codigo}`)
    .setLabel('No fui yo')
    .setStyle(ButtonStyle.Danger);

  const embed = embedBase({
    color: COLORES.cupula,
    titulo: '🛡️ ¿Eres tú?',
    descripcion: `Se vinculó la cuenta de Roblox **@${verif.roblox_usuario}** (ID ${robloxId}) a tu ficha. Si no fuiste tú, el vínculo se revierte y se avisa a Seguridad Interna.`,
    thumbnail: avatar,
    footer: 'Confirmación',
  });

  // Intentar DM; si falla, mostrar en el mismo menú
  try {
    await interaction.user.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(btnSi, btnNo)],
    });
    await interaction.editReply({
      embeds: [
        embedBase({
          color: COLORES.medicina,
          titulo: '🔐 Verificación en curso',
          descripcion: 'Se envió un mensaje privado de confirmación. Revisa tus mensajes directos.',
          footer: 'Verificación',
        }),
      ],
      components: [],
    });
  } catch {
    await interaction.editReply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(btnSi, btnNo)],
    });
  }
}

async function onConfirmarSi(interaction, args) {
  const [ownerId, robloxId, codigo] = args;
  if (ownerId !== interaction.user.id) {
    await interaction.reply({ content: 'Solo el titular puede confirmar.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  await interaction.deferUpdate();

  const db = getDb();
  const verif = db.prepare(
    'SELECT * FROM verificaciones WHERE discord_id = ? AND codigo = ? AND usado = 0 ORDER BY id DESC LIMIT 1'
  ).get(ownerId, codigo);

  if (!verif) {
    await interaction.editReply({ content: 'La verificación ya no es válida.', embeds: [], components: [] });
    return;
  }

  db.prepare('UPDATE verificaciones SET usado = 1 WHERE id = ?').run(verif.id);

  const numero = nextId('PER');
  const area = verif.area_solicitada || null;

  db.prepare(
    `INSERT INTO perfiles (discord_id, numero, personaje, roblox_id, roblox_usuario, verificado, area, estado, ingreso, nivel_auth)
     VALUES (?, ?, ?, ?, ?, 1, ?, 'Activo', datetime('now'), 0)
     ON CONFLICT(discord_id) DO UPDATE SET
       numero = excluded.numero,
       personaje = excluded.personaje,
       roblox_id = excluded.roblox_id,
       roblox_usuario = excluded.roblox_usuario,
       verificado = 1,
       area = excluded.area,
       estado = 'Activo',
       actualizado_en = datetime('now')`
  ).run(ownerId, numero, verif.personaje, String(robloxId), verif.roblox_usuario, area);

  // Asignar roles si existen en roles_map
  try {
    const guild = interaction.guild || interaction.client.guilds.cache.first();
    if (guild) {
      const member = await guild.members.fetch(ownerId).catch(() => null);
      if (member) {
        const rolVerificado = db.prepare("SELECT role_id FROM roles_map WHERE cargo_key = 'APOYO.VERIFICADO'").get();
        if (rolVerificado?.role_id) {
          await member.roles.add(rolVerificado.role_id).catch(() => {});
        }
        if (area) {
          const rolArea = db.prepare('SELECT role_id FROM roles_map WHERE cargo_key = ?').get(`AREA.${area.toUpperCase()}`);
          if (rolArea?.role_id) {
            await member.roles.add(rolArea.role_id).catch(() => {});
          }
        }
      }
    }
  } catch (err) {
    console.error('[Roles]', err);
  }

  auditoria.registrar(ownerId, 'PERFIL.VERIFICADO', { numero, robloxId, area });

  let avatar = null;
  try {
    avatar = await roblox.obtenerAvatar(robloxId);
  } catch (_) {}

  const ficha = embedBase({
    color: COLORES.medicina,
    titulo: `🗂️ Ficha de personal · ${numero}`,
    campos: [
      { name: 'Nombre del personaje', value: verif.personaje, inline: false },
      { name: 'Roblox', value: `@${verif.roblox_usuario} ✅ Verificado`, inline: true },
      { name: 'Estado', value: '🟢 Activo', inline: true },
      { name: 'Área', value: ORGANIGRAMA[area]?.nombre || area || '—', inline: true },
      { name: 'Cargo', value: '—', inline: true },
      { name: 'Autorización', value: 'Nivel 0 · Público', inline: true },
      { name: 'Ingreso', value: new Date().toLocaleDateString('es-PA'), inline: true },
    ],
    thumbnail: avatar,
    footer: 'Personal',
  });

  await interaction.editReply({
    embeds: [ficha],
    components: [],
  });

  // Confirmación breve
  try {
    await interaction.followUp({
      content: `✅ Ficha registrada · ${numero}`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (_) {}
}

async function onConfirmarNo(interaction, args) {
  const [ownerId, robloxId, codigo] = args;
  if (ownerId !== interaction.user.id) {
    await interaction.reply({ content: 'Solo el titular puede responder.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  await interaction.deferUpdate();

  const db = getDb();
  db.prepare('UPDATE verificaciones SET usado = 1 WHERE discord_id = ? AND codigo = ?').run(ownerId, codigo);
  db.prepare('DELETE FROM perfiles WHERE discord_id = ? AND verificado = 0').run(ownerId);

  auditoria.registrar(ownerId, 'PERFIL.VERIFICACION_RECHAZADA', { robloxId, codigo });

  await interaction.editReply({
    embeds: [
      embedBase({
        color: COLORES.denegado,
        titulo: '🛡️ Vínculo revertido',
        descripcion: 'El vínculo fue cancelado. Seguridad Interna ha sido notificada.',
        footer: 'Verificación',
      }),
    ],
    components: [],
  });
}

async function onCancelar(interaction, args) {
  const [ownerId, codigo] = args;
  if (ownerId !== interaction.user.id) return;

  const db = getDb();
  db.prepare('UPDATE verificaciones SET usado = 1 WHERE discord_id = ? AND codigo = ?').run(ownerId, codigo);

  await interaction.update({
    embeds: [
      embedBase({
        color: COLORES.neutral,
        titulo: '🔐 Verificación cancelada',
        descripcion: 'El proceso de verificación fue cancelado.',
        footer: 'Verificación',
      }),
    ],
    components: [],
  });
}

async function onVer(interaction) {
  const db = getDb();
  const propio = db.prepare('SELECT * FROM perfiles WHERE discord_id = ?').get(interaction.user.id);

  const menu = new UserSelectMenuBuilder()
    .setCustomId(`perfil:ver_select:${interaction.user.id}`)
    .setPlaceholder('Selecciona un miembro (o déjalo en blanco para ver el tuyo)')
    .setMinValues(0)
    .setMaxValues(1);

  // Si no hay select de 0 valores en algunas versiones, mostrar propio directamente + opción de buscar
  if (propio) {
    let avatar = null;
    if (propio.roblox_id) {
      try { avatar = await roblox.obtenerAvatar(propio.roblox_id); } catch (_) {}
    }

    const ficha = embedBase({
      color: COLORES.medicina,
      titulo: `🗂️ Ficha de personal · ${propio.numero || '—'}`,
      campos: [
        { name: 'Nombre del personaje', value: propio.personaje || '—', inline: false },
        { name: 'Roblox', value: propio.roblox_usuario ? `@${propio.roblox_usuario} ${propio.verificado ? '✅ Verificado' : ''}` : '—', inline: true },
        { name: 'Estado', value: propio.estado === 'Activo' ? '🟢 Activo' : propio.estado || '—', inline: true },
        { name: 'Área', value: ORGANIGRAMA[propio.area]?.nombre || propio.area || '—', inline: true },
        { name: 'Cargo', value: propio.cargo || '—', inline: true },
        { name: 'Autorización', value: `Nivel ${propio.nivel_auth ?? 0}`, inline: true },
        { name: 'Ingreso', value: propio.ingreso ? new Date(propio.ingreso).toLocaleDateString('es-PA') : '—', inline: true },
      ],
      thumbnail: avatar,
      footer: 'Personal',
    });

    await interaction.update({
      embeds: [ficha],
      components: [new ActionRowBuilder().addComponents(menu)],
    }).catch(async () => {
      await interaction.reply({ embeds: [ficha], components: [new ActionRowBuilder().addComponents(menu)], flags: MessageFlags.Ephemeral });
    });
  } else {
    await interaction.update({
      embeds: [
        embedBase({
          color: COLORES.neutral,
          titulo: '🗂️ Ficha de personal',
          descripcion: 'No tienes una ficha registrada. Usa **Crear y verificar mi ficha**.',
          footer: 'Personal',
        }),
      ],
      components: [],
    }).catch(() => {});
  }
}

async function onVerSelect(interaction) {
  const selected = interaction.users?.first();
  const targetId = selected ? selected.id : interaction.user.id;

  const db = getDb();
  const perfil = db.prepare('SELECT * FROM perfiles WHERE discord_id = ?').get(targetId);

  if (!perfil) {
    await interaction.update({
      embeds: [
        embedBase({
          color: COLORES.neutral,
          titulo: '🗂️ Ficha de personal',
          descripcion: 'Ese miembro no tiene una ficha registrada.',
          footer: 'Personal',
        }),
      ],
      components: [],
    });
    return;
  }

  let avatar = null;
  if (perfil.roblox_id) {
    try { avatar = await roblox.obtenerAvatar(perfil.roblox_id); } catch (_) {}
  }

  const ficha = embedBase({
    color: COLORES.medicina,
    titulo: `🗂️ Ficha de personal · ${perfil.numero || '—'}`,
    campos: [
      { name: 'Nombre del personaje', value: perfil.personaje || '—', inline: false },
      { name: 'Roblox', value: perfil.roblox_usuario ? `@${perfil.roblox_usuario} ${perfil.verificado ? '✅ Verificado' : ''}` : '—', inline: true },
      { name: 'Estado', value: perfil.estado === 'Activo' ? '🟢 Activo' : perfil.estado || '—', inline: true },
      { name: 'Área', value: ORGANIGRAMA[perfil.area]?.nombre || perfil.area || '—', inline: true },
      { name: 'Cargo', value: perfil.cargo || '—', inline: true },
      { name: 'Autorización', value: `Nivel ${perfil.nivel_auth ?? 0}`, inline: true },
      { name: 'Ingreso', value: perfil.ingreso ? new Date(perfil.ingreso).toLocaleDateString('es-PA') : '—', inline: true },
    ],
    thumbnail: avatar,
    footer: 'Personal',
  });

  await interaction.update({ embeds: [ficha], components: [] });
}

async function mostrarModalEditar(interaction) {
  const db = getDb();
  const perfil = db.prepare('SELECT * FROM perfiles WHERE discord_id = ?').get(interaction.user.id);

  if (!perfil) {
    const method = interaction.replied || interaction.deferred ? 'editReply' : 'update';
    await interaction[method]({
      embeds: [
        embedBase({
          color: COLORES.neutral,
          titulo: '🗂️ Ficha de personal',
          descripcion: 'No tienes una ficha para editar.',
          footer: 'Personal',
        }),
      ],
      components: [],
    }).catch(() => {});
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`perfil:editar_submit:${interaction.user.id}`)
    .setTitle('Editar ficha de personal');

  const personaje = new TextInputBuilder()
    .setCustomId('personaje')
    .setLabel('Nombre del personaje')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(60)
    .setValue(perfil.personaje || '');

  modal.addComponents(new ActionRowBuilder().addComponents(personaje));
  await interaction.showModal(modal);
}

async function onEditarSubmit(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const personaje = sanitizar(interaction.fields.getTextInputValue('personaje').trim());
  if (!personaje) {
    await interaction.editReply({ content: 'El nombre del personaje no puede estar vacío.' });
    return;
  }

  const db = getDb();
  db.prepare(
    'UPDATE perfiles SET personaje = ?, actualizado_en = datetime(\'now\') WHERE discord_id = ?'
  ).run(personaje, interaction.user.id);

  auditoria.registrar(interaction.user.id, 'PERFIL.EDITAR', { personaje });

  await interaction.editReply({
    content: '✅ Ficha actualizada',
  });
}

async function onEliminarConfirmar(interaction) {
  const db = getDb();
  const perfil = db.prepare('SELECT * FROM perfiles WHERE discord_id = ?').get(interaction.user.id);

  if (!perfil) {
    await interaction.update({
      embeds: [
        embedBase({
          color: COLORES.neutral,
          titulo: '🗂️ Ficha de personal',
          descripcion: 'No tienes una ficha para eliminar.',
          footer: 'Personal',
        }),
      ],
      components: [],
    }).catch(() => {});
    return;
  }

  const btn = new ButtonBuilder()
    .setCustomId(`perfil:eliminar:${interaction.user.id}`)
    .setLabel('Confirmar eliminación')
    .setStyle(ButtonStyle.Danger);

  await interaction.update({
    embeds: [
      embedBase({
        color: COLORES.denegado,
        titulo: '🗑️ Eliminar ficha',
        descripcion: `Se eliminará la ficha **${perfil.numero}**. Esta acción no se puede deshacer desde el bot.`,
        footer: 'Personal',
      }),
    ],
    components: [new ActionRowBuilder().addComponents(btn)],
  }).catch(() => {});
}

async function onEliminar(interaction) {
  if (!interaction.customId.includes(interaction.user.id)) {
    await interaction.reply({ content: 'Solo el titular puede eliminar su ficha.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  await interaction.deferUpdate();

  const db = getDb();
  const perfil = db.prepare('SELECT * FROM perfiles WHERE discord_id = ?').get(interaction.user.id);
  db.prepare('DELETE FROM perfiles WHERE discord_id = ?').run(interaction.user.id);

  auditoria.registrar(interaction.user.id, 'PERFIL.ELIMINAR', { numero: perfil?.numero });

  await interaction.editReply({
    embeds: [
      embedBase({
        color: COLORES.neutral,
        titulo: '🗑️ Ficha eliminada',
        descripcion: 'Tu ficha de personal ha sido eliminada.',
        footer: 'Personal',
      }),
    ],
    components: [],
  });
}

async function onRevalidar(interaction) {
  const db = getDb();
  const perfil = db.prepare('SELECT * FROM perfiles WHERE discord_id = ? AND verificado = 1').get(interaction.user.id);

  if (!perfil || !perfil.roblox_id) {
    await interaction.update({
      embeds: [
        embedBase({
          color: COLORES.neutral,
          titulo: '🔄 Revalidar',
          descripcion: 'No tienes una cuenta de Roblox verificada para revalidar.',
          footer: 'Verificación',
        }),
      ],
      components: [],
    }).catch(() => {});
    return;
  }

  await interaction.deferUpdate();

  try {
    const user = await roblox.obtenerUsuario(perfil.roblox_id);
    if (user && user.name && user.name !== perfil.roblox_usuario) {
      db.prepare('UPDATE perfiles SET roblox_usuario = ?, actualizado_en = datetime(\'now\') WHERE discord_id = ?')
        .run(user.name, interaction.user.id);
      auditoria.registrar(interaction.user.id, 'PERFIL.REVALIDAR', { anterior: perfil.roblox_usuario, nuevo: user.name });
      await interaction.editReply({
        embeds: [
          embedBase({
            color: COLORES.medicina,
            titulo: '🔄 Cuenta revalidada',
            descripcion: `Nombre actualizado: **@${perfil.roblox_usuario}** → **@${user.name}**`,
            footer: 'Verificación',
          }),
        ],
        components: [],
      });
    } else {
      await interaction.editReply({
        embeds: [
          embedBase({
            color: COLORES.medicina,
            titulo: '🔄 Cuenta revalidada',
            descripcion: `Sin cambios. Usuario actual: **@${perfil.roblox_usuario}**`,
            footer: 'Verificación',
          }),
        ],
        components: [],
      });
    }
  } catch (err) {
    console.error('[Revalidar]', err);
    await interaction.editReply({
      content: 'No se pudo contactar con la API de Roblox.',
      embeds: [],
      components: [],
    });
  }
}

module.exports = { prefix, handle };

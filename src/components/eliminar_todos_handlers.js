const {
  PermissionFlagsBits,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { getDb } = require('../db');
const auditoria = require('../services/auditoria');
const { embedBase, COLORES } = require('../utils/plantillas');

const prefix = 'eliminar_todos';

function esAdmin(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)
  );
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
  if (accion === 'cancelar') return onCancelar(interaction);
  if (accion === 'ejecutar') return onEjecutar(interaction);
  await interaction.reply({
    content: 'Accion no reconocida.',
    flags: MessageFlags.Ephemeral,
  }).catch(() => {});
}

async function onCancelar(interaction) {
  const payload = {
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: 'Eliminar roles',
      descripcion: 'Operacion cancelada. No se elimino ningun rol.',
      footer: 'Administracion',
    })],
    components: [],
  };
  await interaction.update(payload).catch(async () => {
    await interaction.editReply(payload).catch(() => {});
  });
}

async function onEjecutar(interaction) {
  // Al confirmar: quitar botones de inmediato (evita doble clic y duplicacion)
  await interaction.update({
    embeds: [embedBase({
      color: COLORES.neutral,
      titulo: 'Eliminando roles',
      descripcion: 'Procesando. No pulses de nuevo.',
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
  const candidatos = [...guild.roles.cache.values()]
    .filter((r) => r.id !== guild.id && !r.managed && r.editable)
    .sort((a, b) => b.position - a.position);

  let eliminados = 0;
  const fallos = [];
  const vistos = new Set();

  for (const rol of candidatos) {
    if (vistos.has(rol.id)) continue;
    vistos.add(rol.id);
    try {
      const actual = guild.roles.cache.get(rol.id);
      if (!actual || !actual.editable) continue;
      await actual.delete(`Aegis · eliminar todos · ${interaction.user.tag}`);
      eliminados++;
      await new Promise((r) => setTimeout(r, 350));
    } catch (err) {
      fallos.push(rol.name);
      console.error('[Eliminar todos]', rol.name, err.message || err);
    }
  }

  try {
    getDb().prepare('DELETE FROM roles_map').run();
  } catch (_) {}

  auditoria.registrar(interaction.user.id, 'CONFIG_ROLES.ELIMINAR_TODOS', {
    eliminados,
    fallos: fallos.length,
  });

  // Ofrecer crear el organigrama de inmediato
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`config_roles:crear_ejecutar:${interaction.user.id}`)
      .setLabel('Crear roles del organigrama')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Eliminacion completada',
      descripcion: [
        `Roles eliminados: **${eliminados}**${fallos.length ? `\nSin eliminar: ${fallos.length}` : ''}`,
        '',
        '@everyone, roles de bots y roles por encima del bot no se tocan.',
        'Mapa de roles reiniciado (sin duplicados).',
        '',
        'Puedes **crear ahora** todos los roles del organigrama (formato XX ●┇Nombre).',
      ].join('\n'),
      footer: 'Administracion',
    })],
    components: [row],
  });
}

module.exports = { prefix, handle };

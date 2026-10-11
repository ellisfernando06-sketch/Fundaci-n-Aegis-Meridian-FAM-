/**
 * config_roles — punto de entrada del modulo.
 * La logica completa se restaura; este archivo enruta acciones basicas
 * y evita el crash del payload gzip truncado.
 */
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { embedBase, COLORES } = require('../utils/plantillas');

const prefix = 'config_roles';

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

  // Redirigir eliminacion masiva al modulo dedicado (botones se quitan al confirmar)
  if (accion === 'eliminar_todos_ejecutar' || accion === 'eliminar_todos_cancelar') {
    const { handle: h } = require('./eliminar_todos_handlers');
    const map = {
      eliminar_todos_ejecutar: 'ejecutar',
      eliminar_todos_cancelar: 'cancelar',
    };
    return h(interaction, map[accion], args);
  }

  if (accion === 'menu') {
    const opcion = interaction.values?.[0];
    if (opcion === 'eliminar_bot' || opcion === 'analizar' || opcion === 'crear' || opcion === 'organizar' || opcion === 'renombrar') {
      await interaction.update({
        embeds: [embedBase({
          color: COLORES.neutral,
          titulo: 'Configuracion de roles',
          descripcion: [
            'El modulo de analisis/prefijos se esta restaurando.',
            '',
            'Para **eliminar todos los roles** usa el comando:',
            '`/eliminar_roles`',
            '',
            'Al confirmar, los botones se quitan solos y no se duplica la accion.',
          ].join('\n'),
          footer: 'Administracion',
        })],
        components: [],
      }).catch(() => {});
      return;
    }
  }

  await interaction.reply({
    content: 'Accion no disponible temporalmente. Usa /eliminar_roles para borrar roles.',
    flags: MessageFlags.Ephemeral,
  }).catch(() => {});
}

module.exports = { prefix, handle };

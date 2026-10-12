const {
  MessageFlags,
} = require('discord.js');
const { onColoresConfirmar, onColoresEjecutar } = require('./config_roles_colores');
const ops = require('./config_roles_ops');

const prefix = 'config_roles';

async function handle(interaction, accion, args) {
  if (!ops.esAdmin(interaction)) {
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
    case 'crear_ejecutar': return ops.onCrearEjecutar(interaction);
    case 'renombrar_confirmar': return ops.onRenombrarConfirmar(interaction);
    case 'renombrar_ejecutar': return ops.onRenombrarEjecutar(interaction);
    case 'organizar_confirmar': return ops.onOrganizarConfirmar(interaction);
    case 'organizar_ejecutar': return ops.onOrganizarEjecutar(interaction);
    case 'eliminar_confirmar': return ops.onEliminarConfirmar(interaction);
    case 'eliminar_ejecutar': return ops.onEliminarEjecutar(interaction);
    case 'colores_confirmar': return onColoresConfirmar(interaction);
    case 'colores_ejecutar': return onColoresEjecutar(interaction);
    default:
      await interaction.reply({
        content: 'Accion no reconocida.',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
  }
}

async function onMenu(interaction) {
  const opcion = interaction.values[0];
  if (opcion === 'organigrama') return ops.verOrganigrama(interaction);
  if (opcion === 'analizar') return ops.analizar(interaction);
  if (opcion === 'crear' || opcion === 'desplegar') return ops.onCrearConfirmar(interaction);
  if (opcion === 'renombrar') return ops.onRenombrarConfirmar(interaction);
  if (opcion === 'organizar') return ops.onOrganizarConfirmar(interaction);
  if (opcion === 'eliminar_bot') return ops.onEliminarConfirmar(interaction);
  if (opcion === 'colores') return onColoresConfirmar(interaction);
}

module.exports = { prefix, handle };

const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const { embedBase, COLORES } = require('../utils/plantillas');

function esAdmin(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)
  );
}

async function stub(interaction, nombre) {
  const reply = interaction.deferred || interaction.replied ? interaction.editReply : interaction.update;
  await reply.call(interaction, {
    embeds: [embedBase({
      color: COLORES.amarillo || 0xe8b923,
      titulo: nombre,
      descripcion:
        'Esta accion se esta restaurando en el deploy.\n' +
        'La opcion **Aplicar colores por faccion** si esta operativa.\n' +
        'Vuelve a intentar Crear / Renombrar / Ordenar en unos minutos.',
      footer: 'Administracion',
    })],
    components: [],
  }).catch(() => {});
}

async function verOrganigrama(i) { return stub(i, 'Organigrama');
}
async function analizar(i) { return stub(i, 'Analizar');
}
async function onCrearConfirmar(i) { return stub(i, 'Crear roles');
}
async function onCrearEjecutar(i) { return stub(i, 'Crear roles');
}
async function onRenombrarConfirmar(i) { return stub(i, 'Renombrar');
}
async function onRenombrarEjecutar(i) { return stub(i, 'Renombrar');
}
async function onOrganizarConfirmar(i) { return stub(i, 'Ordenar');
}
async function onOrganizarEjecutar(i) { return stub(i, 'Ordenar');
}
async function onEliminarConfirmar(i) { return stub(i, 'Eliminar');
}
async function onEliminarEjecutar(i) { return stub(i, 'Eliminar');
}

module.exports = {
  esAdmin,
  verOrganigrama,
  analizar,
  onCrearConfirmar,
  onCrearEjecutar,
  onRenombrarConfirmar,
  onRenombrarEjecutar,
  onOrganizarConfirmar,
  onOrganizarEjecutar,
  onEliminarConfirmar,
  onEliminarEjecutar,
};

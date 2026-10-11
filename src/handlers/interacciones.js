const { Collection } = require('discord.js');
const path = require('path');
const fs = require('fs');

/**
 * Manejador global de interacciones.
 * Los customId se codifican como modulo:accion:id (y más segmentos si hace falta).
 * Los botones y menús sobreviven a reinicios del bot.
 */

const handlers = new Collection();

function cargarHandlers() {
  const componentsPath = path.join(__dirname, '..', 'components');
  if (!fs.existsSync(componentsPath)) return;

  const archivos = fs.readdirSync(componentsPath).filter((f) => f.endsWith('.js'));
  for (const archivo of archivos) {
    const modulo = require(path.join(componentsPath, archivo));
    if (modulo.prefix && typeof modulo.handle === 'function') {
      handlers.set(modulo.prefix, modulo);
    }
  }
}

/**
 * Parsea un customId en { modulo, accion, args[] }
 */
function parseCustomId(customId) {
  const partes = customId.split(':');
  if (partes.length < 2) return null;
  return {
    modulo: partes[0],
    accion: partes[1],
    args: partes.slice(2),
  };
}

async function manejarInteraccion(interaction) {
  try {
    if (interaction.isChatInputCommand()) {
      const comando = interaction.client.commands.get(interaction.commandName);
      if (!comando) {
        await interaction.reply({
          content: 'Este comando no está disponible.',
          ephemeral: true,
        }).catch(() => {});
        return;
      }
      await comando.execute(interaction);
      return;
    }

    if (
      interaction.isButton() ||
      interaction.isStringSelectMenu() ||
      interaction.isUserSelectMenu() ||
      interaction.isChannelSelectMenu() ||
      interaction.isRoleSelectMenu() ||
      interaction.isModalSubmit()
    ) {
      const parsed = parseCustomId(interaction.customId);
      if (!parsed) {
        await interaction.reply({
          content: 'Interacción no reconocida.',
          ephemeral: true,
        }).catch(() => {});
        return;
      }

      const handler = handlers.get(parsed.modulo);
      if (!handler) {
        await interaction.reply({
          content: 'Este menú ya no está activo.',
          ephemeral: true,
        }).catch(() => {});
        return;
      }

      await handler.handle(interaction, parsed.accion, parsed.args);
      return;
    }
  } catch (error) {
    console.error('[Interacción]', error);

    const payload = {
      content: 'Se produjo un error al procesar la solicitud. El incidente ha sido registrado.',
      ephemeral: true,
    };

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch (_) {
      // La interacción ya no es válida
    }
  }
}

module.exports = {
  cargarHandlers,
  manejarInteraccion,
  parseCustomId,
};

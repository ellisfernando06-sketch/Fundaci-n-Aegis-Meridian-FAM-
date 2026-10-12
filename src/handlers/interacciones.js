const { Collection, MessageFlags } = require('discord.js');
const path = require('path');
const fs = require('fs');

/**
 * Manejador global de interacciones.
 * customId: modulo:accion:id
 */

const handlers = new Collection();

function cargarHandlers() {
  const componentsPath = path.join(__dirname, '..', 'components');
  if (!fs.existsSync(componentsPath)) return;

  const archivos = fs.readdirSync(componentsPath).filter((f) => f.endsWith('.js'));
  for (const archivo of archivos) {
    try {
      const full = path.join(componentsPath, archivo);
      delete require.cache[require.resolve(full)];
      const modulo = require(full);
      if (modulo.prefix && typeof modulo.handle === 'function') {
        handlers.set(modulo.prefix, modulo);
        console.log('[AEGIS] Handler cargado:', modulo.prefix);
      }
    } catch (err) {
      console.error('[AEGIS] Error cargando component', archivo, err);
    }
  }
}

function parseCustomId(customId) {
  const partes = String(customId || '').split(':');
  if (partes.length < 2) return null;
  return {
    modulo: partes[0],
    accion: partes[1],
    args: partes.slice(2),
  };
}

async function manejarInteraccion(interaction) {
  try {
    if (interaction.isAutocomplete()) {
      const comando = interaction.client.commands.get(interaction.commandName);
      if (comando && typeof comando.autocomplete === 'function') {
        await comando.autocomplete(interaction);
      } else {
        await interaction.respond([]).catch(() => {});
      }
      return;
    }

    if (interaction.isChatInputCommand()) {
      const comando = interaction.client.commands.get(interaction.commandName);
      if (!comando) {
        await interaction.reply({
          content: 'Este comando no esta disponible.',
          flags: MessageFlags.Ephemeral,
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
          content: 'Interaccion no reconocida.',
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
        return;
      }

      const handler = handlers.get(parsed.modulo);
      if (!handler) {
        await interaction.reply({
          content: 'Este menu ya no esta activo.',
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
        return;
      }

      await handler.handle(interaction, parsed.accion, parsed.args);
      return;
    }
  } catch (error) {
    console.error('[Interaccion]', error);

    if (interaction.isAutocomplete()) {
      await interaction.respond([]).catch(() => {});
      return;
    }

    const payload = {
      content: 'Se produjo un error al procesar la solicitud. El incidente ha sido registrado.',
      flags: MessageFlags.Ephemeral,
    };

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch (_) {}
  }
}

module.exports = {
  cargarHandlers,
  manejarInteraccion,
  parseCustomId,
};

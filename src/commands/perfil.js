const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');
const { getDb } = require('../db');
const { embedBase, COLORES } = require('../utils/plantillas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('Gestión de ficha de personal de la Fundación'),

  async execute(interaction) {
    const db = getDb();
    const perfil = db.prepare('SELECT * FROM perfiles WHERE discord_id = ?').get(interaction.user.id);

    const opciones = [
      {
        label: 'Crear y verificar mi ficha',
        value: 'crear',
        description: 'Vincula tu cuenta de Roblox y genera tu ficha',
        emoji: '🆕',
      },
      {
        label: 'Ver ficha',
        value: 'ver',
        description: 'Consulta tu ficha o la de otro miembro',
        emoji: '👁️',
      },
      {
        label: 'Editar ficha',
        value: 'editar',
        description: 'Modifica el nombre de personaje u otros datos',
        emoji: '✏️',
      },
      {
        label: 'Eliminar ficha',
        value: 'eliminar',
        description: 'Borra tu ficha de personal',
        emoji: '🗑️',
      },
      {
        label: 'Revalidar cuenta de Roblox',
        value: 'revalidar',
        description: 'Detecta cambios de nombre en Roblox',
        emoji: '🔄',
      },
    ];

    if (perfil?.verificado) {
      // Ya verificado: ocultar crear como primera opción prioritaria no es necesario, se deja
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`perfil:menu:${interaction.user.id}`)
      .setPlaceholder('¿Qué deseas hacer?')
      .addOptions(opciones);

    const row = new ActionRowBuilder().addComponents(menu);

    const embed = embedBase({
      color: COLORES.medicina,
      titulo: '🗂️ Ficha de personal',
      descripcion: perfil
        ? `Ficha actual: **${perfil.numero || '—'}** · ${perfil.verificado ? '✅ Verificado' : '⏳ Pendiente de verificación'}`
        : 'No tienes una ficha registrada. Selecciona una opción para continuar.',
      footer: 'Personal',
    });

    await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  },
};

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { embedBase, COLORES } = require('../utils/plantillas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config_roles')
    .setDescription('Analisis, creacion y organizacion de roles del organigrama')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`config_roles:menu:${interaction.user.id}`)
      .setPlaceholder('Selecciona una accion')
      .addOptions([
        {
          label: 'Analizar roles del servidor',
          value: 'analizar',
          description: 'Detecta existentes y faltantes por nombre',
          emoji: '🔍',
        },
        {
          label: 'Crear roles faltantes',
          value: 'crear',
          description: 'Crea el organigrama (XX ●┇Nombre)',
          emoji: '🛠️',
        },
        {
          label: 'Organizar jerarquia',
          value: 'organizar',
          description: 'Coloca cada rol en su seccion',
          emoji: '📐',
        },
      ]);

    const embed = embedBase({
      color: COLORES.neutral,
      titulo: 'Configuracion de roles',
      descripcion: [
        '**Analizar** — detecta roles por nombre.',
        '**Crear faltantes** — crea los del organigrama que falten.',
        '**Organizar** — los ordena por seccion.',
        '',
        'Para borrar todos: `/eliminar_roles`',
        '(despues de borrar puedes crear el organigrama de un clic).',
      ].join('\n'),
      footer: 'Administracion · Fundacion Aegis-Meridian',
    });

    await interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)],
      flags: MessageFlags.Ephemeral,
    });
  },
};

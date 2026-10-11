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
    .setDescription('Analisis, prefijos y organizacion de roles del organigrama')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`config_roles:menu:${interaction.user.id}`)
      .setPlaceholder('Selecciona una accion')
      .addOptions([
        {
          label: 'Analizar roles del servidor',
          value: 'analizar',
          description: 'Lee todos los roles y los empareja por nombre',
          emoji: '🔍',
        },
        {
          label: 'Aplicar prefijos oficiales',
          value: 'renombrar',
          description: 'Solo cambia el prefijo · deja el nombre como esta',
          emoji: '✏️',
        },
        {
          label: 'Crear roles faltantes',
          value: 'crear',
          description: 'Crea solo los que no existen por nombre',
          emoji: '🛠️',
        },
        {
          label: 'Organizar jerarquia',
          value: 'organizar',
          description: 'Coloca cada rol en su seccion',
          emoji: '📐',
        },
        {
          label: 'Eliminar roles creados por el bot',
          value: 'eliminar_bot',
          description: 'Borra solo los que el bot creo',
          emoji: '🗑️',
        },
      ]);

    const embed = embedBase({
      color: COLORES.neutral,
      titulo: 'Configuracion de roles',
      descripcion: [
        'El bot **lee todos los roles** y los usa **segun su nombre**.',
        '',
        '**Aplicar prefijos** no borra ni recrea nada:',
        'solo pone `XX ●┇` delante del nombre que ya tenia el rol.',
        '',
        'Miembros, permisos y color se conservan.',
        '**Organizar** los coloca en su lugar de la jerarquia.',
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

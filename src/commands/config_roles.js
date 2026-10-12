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
    .setDescription('Panel de roles: crear, renombrar, eliminar y ordenar')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`config_roles:menu:${interaction.user.id}`)
      .setPlaceholder('Selecciona una accion')
      .addOptions([
        {
          label: 'Crear roles del organigrama',
          value: 'crear',
          description: 'Crea los faltantes (cargos, separadores, permisos)',
          emoji: '🛠️',
        },
        {
          label: 'Renombrar a nombres oficiales',
          value: 'renombrar',
          description: 'Aplica el nombre oficial XX ●┇ a los detectados',
          emoji: '✏️',
        },
        {
          label: 'Ordenar jerarquia',
          value: 'organizar',
          description: 'Coloca cada rol en su seccion del organigrama',
          emoji: '📐',
        },
        {
          label: 'Eliminar roles del bot',
          value: 'eliminar_bot',
          description: 'Borra solo los roles que el bot creo',
          emoji: '🗑️',
        },
        {
          label: 'Analizar roles',
          value: 'analizar',
          description: 'Cuantos existen y cuantos faltan',
          emoji: '🔍',
        },
        {
          label: 'Aplicar colores por faccion',
          value: 'colores',
          description: 'Director oscuro, faccion mismo tono mas claro',
          emoji: '🎨',
        },
        {
          label: 'Ver organigrama',
          value: 'organigrama',
          description: 'Lista oficial completa',
          emoji: '📋',
        },
      ]);

    const embed = embedBase({
      color: COLORES.neutral,
      titulo: 'Panel de roles',
      descripcion: [
        '**Crear** — genera los roles faltantes del organigrama.',
        '**Renombrar** — deja cada rol con su nombre oficial.',
        '**Ordenar** — los coloca en su seccion (Fundacion → Direcciones → …).',
        '**Eliminar (bot)** — quita solo los que creo el bot.',
        '**Colores** — unifica color por faccion (director oscuro).',
        '',
        'Para borrar **todos** los roles editables: `/eliminar_roles`',
        'El rol del bot debe quedar **por encima** de los que gestione.',
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

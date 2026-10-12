const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { desplegarEstructura } = require('../services/canales');
const { embedBase, COLORES } = require('../utils/plantillas');
const { actorTexto } = require('../services/solicitudes');
const { truncar } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config_canales')
    .setDescription('Despliega categorias y canales del roleplay (Fase 6)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s.setName('desplegar')
        .setDescription('Borra plantilla vieja y crea categorias/canales/voz con keys')
    )
    .addSubcommand((s) =>
      s.setName('resumen')
        .setDescription('Muestra la plantilla de canales que se desplegarian')
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: 'Se requiere Administrator.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'resumen') {
      const { ESTRUCTURA } = require('../data/canales');
      const lineas = [];
      for (const cat of ESTRUCTURA) {
        lineas.push(`**${cat.nombre}**`);
        for (const c of cat.canales || []) {
          lineas.push(`· ${c.nombre}${c.keys?.length ? ` → ${c.keys.join(', ')}` : ''}`);
        }
        for (const v of cat.voz || []) {
          lineas.push(`· 🔊 ${v.nombre}`);
        }
      }
      await interaction.reply({
        embeds: [embedBase({
          color: COLORES.neutral,
          titulo: 'Plantilla de canales',
          descripcion: truncar(lineas.join('\n'), 4000),
          footer: 'Configuracion',
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'desplegar') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const actor = actorTexto(interaction.user);
        const r = await desplegarEstructura(interaction.guild, actor);
        await interaction.editReply({
          embeds: [embedBase({
            color: r.errores.length ? COLORES.amarillo : COLORES.medicina,
            titulo: 'Despliegue de canales',
            campos: [
              { name: 'Borrados (plantilla vieja)', value: String(r.borrados ?? 0), inline: true },
              { name: 'Categorias', value: String(r.categorias), inline: true },
              { name: 'Canales de texto', value: String(r.textos), inline: true },
              { name: 'Canales de voz', value: String(r.voces), inline: true },
              { name: 'Enlaces key↔canal', value: String(r.keysEnlazadas), inline: true },
              { name: 'Ejecutado por', value: actor, inline: false },
              {
                name: 'Errores',
                value: r.errores.length ? truncar(r.errores.join('\n'), 1000) : 'Ninguno',
                inline: false,
              },
            ],
            footer: 'Configuracion',
          })],
        });
      } catch (err) {
        await interaction.editReply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'Despliegue no completado',
            descripcion: String(err.message || err).slice(0, 500),
            footer: 'Configuracion',
          })],
        });
      }
    }
  },
};

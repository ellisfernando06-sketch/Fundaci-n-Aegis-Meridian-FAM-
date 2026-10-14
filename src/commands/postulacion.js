const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb } = require('../db');
const { embedBase, COLORES } = require('../utils/plantillas');
const { cargosMapeados, esAdminDiscord } = require('../services/acceso');

const CARGOS_REVISION = ['ST.FUNDADOR', 'ST.CO_CALIDAD', 'ST.CO_ESTRATEGIA'];

function puedeRevisar(interaction) {
  if (esAdminDiscord(interaction)) return true;
  const cargos = new Set(cargosMapeados(interaction.member));
  return CARGOS_REVISION.some((c) => cargos.has(c));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('postulacion')
    .setDescription('Postulacion / hoja de vida RP · F.A.M.')
    .addSubcommand((s) =>
      s.setName('enviar').setDescription('Envia tu postulacion (hoja de vida RP) · Uso: cualquiera')
    )
    .addSubcommand((s) =>
      s
        .setName('restaurar_botones')
        .setDescription('Vuelve a poner botones Aprobar/Negar/Entrevistar en pendientes · Fundacion')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'enviar') {
      const modal = new ModalBuilder()
        .setCustomId(`postulacion:enviar:${interaction.user.id}`)
        .setTitle('Postulacion · F.A.M.');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('personaje')
            .setLabel('Nombre del personaje')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(60),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('area')
            .setLabel('Area o direccion a la que aspiras')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(80)
            .setPlaceholder('Ej. Seguridad Interna, Investigacion...'),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('experiencia')
            .setLabel('Experiencia RP / historial relevante')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(800),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('motivacion')
            .setLabel('Por que quieres ingresar a F.A.M.')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(500),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('disponibilidad')
            .setLabel('Disponibilidad (dias / horario)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(100),
        ),
      );

      await interaction.showModal(modal);
      return;
    }

    if (sub === 'restaurar_botones') {
      if (!puedeRevisar(interaction)) {
        await interaction.reply({
          content: 'Solo Fundador o Cofundadores.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const {
        botonesRevision,
        embedPostulacion,
        CANAL_POSTULACIONES,
        asegurarTabla,
      } = require('../components/postulacion');

      asegurarTabla();
      const pendientes = getDb()
        .prepare(
          "SELECT * FROM postulaciones WHERE estado IN ('Pendiente', 'Entrevista') ORDER BY creado_en DESC LIMIT 30"
        )
        .all();

      if (!pendientes.length) {
        await interaction.editReply({ content: 'No hay postulaciones pendientes.' });
        return;
      }

      const canal =
        (await interaction.guild.channels.fetch(CANAL_POSTULACIONES).catch(() => null)) ||
        null;

      let ok = 0;
      let fallos = 0;

      for (const row of pendientes) {
        try {
          let msg = null;
          let ch = canal;
          if (row.canal_id && row.msg_id) {
            ch = await interaction.guild.channels.fetch(row.canal_id).catch(() => canal);
            if (ch) msg = await ch.messages.fetch(row.msg_id).catch(() => null);
          }
          if (msg) {
            await msg.edit({
              content: `Postulacion **${row.id}** · <@${row.discord_id}>`,
              embeds: [embedPostulacion(row)],
              components: botonesRevision(row.id),
            });
            ok += 1;
          } else if (canal?.isTextBased()) {
            const nuevo = await canal.send({
              content: `Postulacion **${row.id}** · <@${row.discord_id}>`,
              embeds: [embedPostulacion(row)],
              components: botonesRevision(row.id),
            });
            getDb()
              .prepare('UPDATE postulaciones SET msg_id = ?, canal_id = ? WHERE id = ?')
              .run(nuevo.id, canal.id, row.id);
            ok += 1;
          } else {
            fallos += 1;
          }
        } catch (err) {
          console.error('[restaurar botones]', row.id, err.message);
          fallos += 1;
        }
      }

      await interaction.editReply({
        embeds: [
          embedBase({
            color: COLORES.medicina,
            titulo: 'Botones restaurados',
            descripcion: `Actualizadas: **${ok}** · Fallos: **${fallos}**`,
            footer: 'Postulaciones',
          }),
        ],
      });
    }
  },
};

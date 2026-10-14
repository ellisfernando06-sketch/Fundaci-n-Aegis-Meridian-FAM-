const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const {
  ZONAS,
  otorgarZona,
  zonasDe,
  asegurarTablas,
  publicarLog,
} = require('../services/roleplay');
const { embedBase, COLORES } = require('../utils/plantillas');
const { cargosMapeados, esAdminDiscord } = require('../services/acceso');
const { actorTexto } = require('../services/solicitudes');

const CARGOS_ZONA = [
  'ST.FUNDADOR', 'ST.CO_CALIDAD', 'ST.CO_ESTRATEGIA', 'DIR.GENERAL',
  'SEG.COMANDANTE', 'SI.GERENTE', 'SI.JEFE',
];

function puedeOtorgar(interaction) {
  if (esAdminDiscord(interaction)) return true;
  const cargos = new Set(cargosMapeados(interaction.member));
  return CARGOS_ZONA.some((c) => cargos.has(c));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('zona')
    .setDescription('Acceso a zonas del sitio · Uso: mando otorga / cualquiera consulta')
    .addSubcommand((s) =>
      s
        .setName('otorgar')
        .setDescription('Otorga acceso temporal o permanente a una zona')
        .addUserOption((o) => o.setName('miembro').setDescription('Personal').setRequired(true))
        .addStringOption((o) =>
          o
            .setName('zona')
            .setDescription('Zona del sitio')
            .setRequired(true)
            .addChoices(...ZONAS.slice(0, 25).map((z) => ({ name: z, value: z })))
        )
        .addIntegerOption((o) =>
          o.setName('nivel').setDescription('Nivel de acceso (0-5)').setRequired(false).setMinValue(0).setMaxValue(5)
        )
        .addIntegerOption((o) =>
          o.setName('horas').setDescription('Duracion en horas (omitir = permanente)').setRequired(false).setMinValue(1)
        )
        .addStringOption((o) => o.setName('motivo').setDescription('Motivo').setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName('consultar')
        .setDescription('Consulta accesos de un miembro')
        .addUserOption((o) => o.setName('miembro').setDescription('Personal').setRequired(false))
    )
    .addSubcommand((s) => s.setName('listar').setDescription('Lista zonas del sitio')),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    asegurarTablas();
    const sub = interaction.options.getSubcommand();

    if (sub === 'listar') {
      await interaction.editReply({
        embeds: [
          embedBase({
            color: COLORES.seguridad,
            author: true,
            titulo: 'Zonas del sitio',
            descripcion: ZONAS.map((z, i) => `\`${String(i + 1).padStart(2, '0')}\` ${z}`).join('\n'),
            footer: 'Accesos',
          }),
        ],
      });
      return;
    }

    if (sub === 'consultar') {
      const user = interaction.options.getUser('miembro') || interaction.user;
      const zonas = zonasDe(user.id);
      const texto = zonas.length
        ? zonas
            .map(
              (z) =>
                `**${z.zona}** · N${z.nivel} · ${z.id}` +
                (z.expira_en ? ` · expira ${z.expira_en}` : ' · permanente')
            )
            .join('\n')
        : 'Sin accesos activos.';
      await interaction.editReply({
        embeds: [
          embedBase({
            color: COLORES.oro,
            titulo: `Accesos · ${user.username}`,
            descripcion: texto,
            footer: 'Accesos',
          }),
        ],
      });
      return;
    }

    if (sub === 'otorgar') {
      if (!puedeOtorgar(interaction)) {
        await interaction.editReply({ content: 'Sin permiso para otorgar zonas.' });
        return;
      }
      const miembro = interaction.options.getUser('miembro');
      const zona = interaction.options.getString('zona');
      const nivel = interaction.options.getInteger('nivel') ?? 1;
      const horas = interaction.options.getInteger('horas');
      const motivo = interaction.options.getString('motivo');
      const row = otorgarZona(miembro.id, zona, nivel, actorTexto(interaction.user), motivo, horas);

      const embed = embedBase({
        color: COLORES.medicina,
        author: true,
        titulo: `Acceso otorgado · ${row.id}`,
        campos: [
          { name: 'Miembro', value: `<@${miembro.id}>`, inline: true },
          { name: 'Zona', value: zona, inline: true },
          { name: 'Nivel', value: String(nivel), inline: true },
          { name: 'Duracion', value: horas ? `${horas} h` : 'Permanente', inline: true },
          { name: 'Otorgado por', value: actorTexto(interaction.user), inline: true },
          { name: 'Motivo', value: motivo || '—', inline: false },
        ],
        footer: 'Accesos',
      });

      await publicarLog(interaction.guild, 'canal_accesos', {
        content: `<@${miembro.id}>`,
        embeds: [embed],
      });
      await interaction.editReply({ embeds: [embed] });

      try {
        await miembro.send({ embeds: [embed] });
      } catch (_) {}
    }
  },
};

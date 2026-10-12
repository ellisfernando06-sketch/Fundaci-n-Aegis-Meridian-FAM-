const {
  SlashCommandBuilder,
  MessageFlags,
} = require('discord.js');
const {
  asegurarTablas,
  esFundador,
  embedPanelControl,
  botonesPanel,
  obtenerSaldo,
  formatear,
  ultimosMovimientos,
} = require('../services/finanzas');
const { embedBase, COLORES } = require('../utils/plantillas');
const { actorTexto } = require('../services/solicitudes');
const { truncar, sanitizar } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('finanzas')
    .setDescription('Oficina de Finanzas de la Fundacion')
    .addSubcommand((s) =>
      s.setName('panel')
        .setDescription('Panel de control del Fundador (salarios, nomina, pagos)')
    )
    .addSubcommand((s) =>
      s.setName('saldo')
        .setDescription('Consulta tu saldo de creditos Aegis')
    )
    .addSubcommand((s) =>
      s.setName('historial')
        .setDescription('Tus ultimos movimientos')
    )
    .addSubcommand((s) =>
      s.setName('saldo_otro')
        .setDescription('Fundador: consulta saldo de un miembro')
        .addUserOption((o) =>
          o.setName('miembro').setDescription('Miembro').setRequired(true)
        )
    ),

  async execute(interaction) {
    asegurarTablas();
    const sub = interaction.options.getSubcommand();

    if (sub === 'panel') {
      if (!esFundador(interaction.member)) {
        await interaction.reply({
          embeds: [embedBase({
            color: COLORES.denegado,
            titulo: 'Acceso restringido',
            descripcion: 'El panel de control financiero es exclusivo del **Fundador**.',
            footer: 'Finanzas',
          })],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.reply({
        embeds: [embedPanelControl()],
        components: botonesPanel(),
        flags: MessageFlags.Ephemeral,
      });

      // Tambien publicar version persistente en canal si se desea — por ahora efimero de control
      return;
    }

    if (sub === 'saldo') {
      const saldo = obtenerSaldo(interaction.user.id);
      await interaction.reply({
        embeds: [embedBase({
          color: 0xc9a227,
          titulo: 'Cuenta personal · creditos Aegis',
          campos: [
            { name: 'Titular', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Saldo disponible', value: formatear(saldo), inline: true },
          ],
          footer: 'Finanzas',
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'historial') {
      const rows = ultimosMovimientos(50).filter((m) => m.discord_id === interaction.user.id).slice(0, 15);
      const desc = rows.length
        ? rows.map((m) =>
          `**${m.id}** · ${m.tipo} **${formatear(m.monto)}**\n${sanitizar(m.concepto || '—').slice(0, 100)}`
        ).join('\n\n')
        : 'Sin movimientos en tu cuenta.';
      await interaction.reply({
        embeds: [embedBase({
          color: 0x1a1a2e,
          titulo: 'Historial de cuenta',
          descripcion: truncar(desc, 4000),
          footer: 'Finanzas',
        })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === 'saldo_otro') {
      if (!esFundador(interaction.member)) {
        await interaction.reply({
          content: 'Solo el Fundador puede consultar saldos ajenos.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const user = interaction.options.getUser('miembro');
      const saldo = obtenerSaldo(user.id);
      await interaction.reply({
        embeds: [embedBase({
          color: 0xc9a227,
          titulo: 'Consulta de saldo',
          campos: [
            { name: 'Titular', value: `<@${user.id}>`, inline: true },
            { name: 'Saldo', value: formatear(saldo), inline: true },
            { name: 'Consultado por', value: actorTexto(interaction.user), inline: false },
          ],
          footer: 'Finanzas',
        })],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

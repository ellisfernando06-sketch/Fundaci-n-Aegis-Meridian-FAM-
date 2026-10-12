const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const {
  asegurarTablas,
  esFundador,
  embedPanelControl,
  botonesPanel,
  menuCargosSalario,
  modalSalario,
  modalPagoManual,
  upsertSalario,
  emitirTransferencia,
  firmarTransferencia,
  procesarNomina,
  ultimosMovimientos,
  formatear,
  obtenerSaldo,
} = require('../services/finanzas');
const { embedBase, COLORES } = require('../utils/plantillas');
const { actorTexto } = require('../services/solicitudes');
const { getCargoPorKey } = require('../data/organigrama');
const { truncar, sanitizar } = require('../utils/helpers');

const prefix = 'finanzas';

function soloFundador(interaction) {
  return esFundador(interaction.member);
}

async function handle(interaction, accion, args) {
  asegurarTablas();

  switch (accion) {
    case 'cfg_salario':
      return onCfgSalario(interaction);
    case 'sel_cargo':
      return onSelCargo(interaction);
    case 'modal_salario':
      return onModalSalario(interaction, args[0]);
    case 'pago_manual':
      return onPagoManualBtn(interaction);
    case 'modal_pago':
      return onModalPago(interaction);
    case 'nomina':
      return onNomina(interaction);
    case 'libro':
      return onLibro(interaction);
    case 'refrescar':
      return onRefrescar(interaction);
    case 'firmar':
      return onFirma(interaction, args[0], true);
    case 'rechazar':
      return onFirma(interaction, args[0], false);
    default:
      await interaction.reply({
        content: 'Accion financiera no reconocida.',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
  }
}

async function onCfgSalario(interaction) {
  if (!soloFundador(interaction)) {
    await interaction.reply({
      content: 'Solo el Fundador puede configurar la escala salarial.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.reply({
    embeds: [embedBase({
      color: 0x1a1a2e,
      titulo: 'Configurar salario por cargo',
      descripcion: 'Selecciona el cargo. A continuacion indicaras **monto** e **intervalo en dias**.',
      footer: 'Finanzas',
    })],
    components: [menuCargosSalario()],
    flags: MessageFlags.Ephemeral,
  });
}

async function onSelCargo(interaction) {
  if (!soloFundador(interaction)) {
    await interaction.reply({ content: 'Acceso denegado.', flags: MessageFlags.Ephemeral });
    return;
  }
  const cargoKey = interaction.values[0];
  await interaction.showModal(modalSalario(cargoKey));
}

async function onModalSalario(interaction, cargoKey) {
  if (!soloFundador(interaction)) {
    await interaction.reply({ content: 'Acceso denegado.', flags: MessageFlags.Ephemeral });
    return;
  }
  const monto = Number(String(interaction.fields.getTextInputValue('monto')).replace(',', '.'));
  const intervalo = parseInt(interaction.fields.getTextInputValue('intervalo'), 10);
  if (Number.isNaN(monto) || monto < 0) {
    await interaction.reply({ content: 'Monto invalido.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (Number.isNaN(intervalo) || intervalo < 0) {
    await interaction.reply({ content: 'Intervalo invalido.', flags: MessageFlags.Ephemeral });
    return;
  }

  const actor = actorTexto(interaction.user);
  upsertSalario(cargoKey, monto, intervalo, actor);
  const cargo = getCargoPorKey(cargoKey);

  await interaction.reply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Escala salarial actualizada',
      campos: [
        { name: 'Cargo', value: cargo?.nombre || cargoKey, inline: true },
        { name: 'Monto', value: formatear(monto), inline: true },
        { name: 'Intervalo', value: intervalo === 0 ? 'Solo manual' : `Cada ${intervalo} dias`, inline: true },
        { name: 'Registrado por', value: actor, inline: false },
      ],
      footer: 'Finanzas',
    })],
    flags: MessageFlags.Ephemeral,
  });
}

async function onPagoManualBtn(interaction) {
  if (!soloFundador(interaction)) {
    await interaction.reply({
      content: 'Solo el Fundador puede autorizar pagos manuales.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.showModal(modalPagoManual());
}

async function onModalPago(interaction) {
  if (!soloFundador(interaction)) {
    await interaction.reply({ content: 'Acceso denegado.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const discordId = sanitizar(interaction.fields.getTextInputValue('discord_id')).replace(/[<@!>]/g, '');
  const monto = Number(String(interaction.fields.getTextInputValue('monto')).replace(',', '.'));
  const concepto = sanitizar(interaction.fields.getTextInputValue('concepto'));

  if (!/^\d{15,20}$/.test(discordId)) {
    await interaction.editReply({ content: 'ID de Discord invalido.' });
    return;
  }
  if (Number.isNaN(monto) || monto <= 0) {
    await interaction.editReply({ content: 'Monto invalido.' });
    return;
  }

  const actor = actorTexto(interaction.user);
  const r = await emitirTransferencia({
    client: interaction.client,
    guild: interaction.guild,
    beneficiarioId: discordId,
    monto,
    concepto,
    autorizadoPor: actor,
  });

  await interaction.editReply({
    embeds: [embedBase({
      color: 0xc9a227,
      titulo: 'Transferencia emitida',
      campos: [
        { name: 'Referencia', value: r.id, inline: true },
        { name: 'Beneficiario', value: `<@${discordId}>`, inline: true },
        { name: 'Importe', value: formatear(monto), inline: true },
        { name: 'DM de firma', value: r.dm ? 'Enviado' : 'No entregado (DMs cerrados)', inline: true },
        { name: 'Autorizado por', value: actor, inline: false },
        { name: 'Concepto', value: truncar(concepto, 200), inline: false },
      ],
      descripcion: 'El credito se aplicara cuando el beneficiario **firme** la notificacion en su DM.',
      footer: 'Finanzas',
    })],
  });
}

async function onNomina(interaction) {
  if (!soloFundador(interaction)) {
    await interaction.reply({
      content: 'Solo el Fundador puede procesar la nomina.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const actor = actorTexto(interaction.user);
  const r = await procesarNomina(interaction.guild, interaction.client, actor);
  await interaction.editReply({
    embeds: [embedBase({
      color: COLORES.medicina,
      titulo: 'Nomina procesada',
      campos: [
        { name: 'Transferencias emitidas', value: String(r.emitidos), inline: true },
        { name: 'Omitidos', value: String(r.omitidos), inline: true },
        { name: 'Autorizado por', value: actor, inline: false },
        {
          name: 'Detalle',
          value: r.errores.length ? truncar(r.errores.join('\n'), 800) : 'Sin errores de emision.',
          inline: false,
        },
      ],
      descripcion: 'Cada beneficiario recibio un DM para **firmar** y acreditar el monto.',
      footer: 'Finanzas',
    })],
  });
}

async function onLibro(interaction) {
  if (!soloFundador(interaction)) {
    await interaction.reply({ content: 'Solo el Fundador consulta el libro mayor completo.', flags: MessageFlags.Ephemeral });
    return;
  }
  const rows = ultimosMovimientos(20);
  const desc = rows.length
    ? rows.map((m) =>
      `**${m.id}** · <@${m.discord_id}> · ${m.tipo} ${formatear(m.monto)}\n` +
      `${sanitizar(m.concepto || '—').slice(0, 80)} · firma: ${m.firma_estado}`
    ).join('\n\n')
    : 'Sin movimientos registrados.';

  await interaction.reply({
    embeds: [embedBase({
      color: 0x1a1a2e,
      titulo: 'Libro mayor · ultimos movimientos',
      descripcion: truncar(desc, 4000),
      footer: 'Finanzas',
    })],
    flags: MessageFlags.Ephemeral,
  });
}

async function onRefrescar(interaction) {
  if (!soloFundador(interaction)) {
    await interaction.reply({ content: 'Acceso denegado.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.update({
    embeds: [embedPanelControl()],
    components: botonesPanel(),
  }).catch(async () => {
    await interaction.reply({
      embeds: [embedPanelControl()],
      components: botonesPanel(),
      flags: MessageFlags.Ephemeral,
    });
  });
}

async function onFirma(interaction, pendienteId, aceptar) {
  await interaction.deferUpdate();
  try {
    const r = await firmarTransferencia(pendienteId, interaction.user.id, aceptar);
    if (!aceptar) {
      await interaction.editReply({
        embeds: [embedBase({
          color: COLORES.denegado,
          titulo: 'Transferencia rechazada',
          descripcion: `Referencia **${pendienteId}** marcada como rechazada. No se acredito saldo.`,
          footer: 'Finanzas',
        })],
        components: [],
      });
      return;
    }
    await interaction.editReply({
      embeds: [embedBase({
        color: COLORES.medicina,
        titulo: 'Firma registrada',
        descripcion:
          `Has firmado la transferencia **${pendienteId}**.\n` +
          `Importe acreditado: **${formatear(r.p.monto)}**\n` +
          `Saldo actual: **${formatear(r.saldo)}**`,
        footer: 'Finanzas · Comprobante',
      })],
      components: [],
    });
  } catch (err) {
    await interaction.followUp({
      content: String(err.message || err).slice(0, 300),
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
  }
}

module.exports = { prefix, handle };

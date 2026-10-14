const { MessageFlags } = require('discord.js');
const { getDb } = require('../db');
const { embedBase, COLORES } = require('../utils/plantillas');

const prefix = 'contratos';

async function handle(interaction, accion, args) {
  if (accion !== 'ver') {
    await interaction.reply({ content: 'Accion no reconocida.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  const ownerId = args[0];
  if (ownerId && ownerId !== interaction.user.id) {
    await interaction.reply({
      content: 'Solo quien abrio el menu puede usarlo.',
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
    return;
  }

  const id = interaction.values?.[0];
  if (!id) {
    await interaction.reply({ content: 'No se selecciono contrato.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  const r = getDb().prepare('SELECT * FROM contratos WHERE id = ?').get(id);
  if (!r) {
    await interaction.update({
      content: 'Contrato no encontrado.',
      embeds: [],
      components: [],
    }).catch(() => {});
    return;
  }

  const ff = r.firma_fundacion_json ? JSON.parse(r.firma_fundacion_json) : null;
  const fm = r.firma_miembro_json ? JSON.parse(r.firma_miembro_json) : null;

  await interaction.update({
    embeds: [
      embedBase({
        color: r.estado === 'Completo' ? COLORES.medicina : COLORES.oro,
        author: true,
        titulo: `Contrato · ${r.id}`,
        campos: [
          { name: 'Miembro', value: `<@${r.miembro_id}>`, inline: true },
          { name: 'Personaje', value: r.personaje, inline: true },
          { name: 'Rango contratado', value: r.rango, inline: true },
          { name: 'Fecha ingreso', value: r.fecha_ingreso || '—', inline: true },
          { name: 'Estado', value: r.estado, inline: true },
          { name: 'Roles aplicados', value: r.roles_aplicados ? 'Si' : 'No', inline: true },
          { name: 'Emitido por', value: r.emitido_por || '—', inline: false },
          {
            name: 'Firma Fundacion',
            value: ff ? `Si · <@${ff.discordId}> · ${ff.fecha || ''}` : 'No',
            inline: true,
          },
          {
            name: 'Firma Miembro',
            value: fm ? `Si · <@${fm.discordId}> · ${fm.fecha || ''}` : 'No',
            inline: true,
          },
        ],
        footer: 'Contratos',
      }),
    ],
    components: [],
  });
}

module.exports = { prefix, handle };

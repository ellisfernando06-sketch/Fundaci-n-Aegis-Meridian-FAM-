const { MessageFlags } = require('discord.js');
const { getDb, getConfig, nextId } = require('../db');
const auditoria = require('../services/auditoria');
const { embedBase, COLORES } = require('../utils/plantillas');
const { sanitizar, truncar } = require('../utils/helpers');

const prefix = 'postulacion';

function asegurarTabla() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS postulaciones (
      id TEXT PRIMARY KEY,
      discord_id TEXT NOT NULL,
      personaje TEXT NOT NULL,
      area TEXT NOT NULL,
      experiencia TEXT,
      motivacion TEXT,
      disponibilidad TEXT,
      estado TEXT DEFAULT 'Pendiente',
      revisado_por TEXT,
      creado_en TEXT DEFAULT (datetime('now'))
    )
  `);
}

async function handle(interaction, accion, args) {
  if (accion !== 'enviar') {
    await interaction.reply({ content: 'Accion no reconocida.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  asegurarTabla();

  const personaje = sanitizar(interaction.fields.getTextInputValue('personaje'));
  const area = sanitizar(interaction.fields.getTextInputValue('area'));
  const experiencia = sanitizar(interaction.fields.getTextInputValue('experiencia'));
  const motivacion = sanitizar(interaction.fields.getTextInputValue('motivacion'));
  const disponibilidad = sanitizar(interaction.fields.getTextInputValue('disponibilidad') || '—');

  const id = nextId('POS');
  getDb()
    .prepare(`
      INSERT INTO postulaciones (id, discord_id, personaje, area, experiencia, motivacion, disponibilidad)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(id, interaction.user.id, personaje, area, experiencia, motivacion, disponibilidad);

  auditoria.registrar(interaction.user.id, 'POSTULACION.ENVIAR', { id, area });

  const embed = embedBase({
    color: COLORES.oro,
    author: true,
    titulo: `Postulacion · ${id}`,
    descripcion: 'Hoja de vida RP recibida. Revision por Fundacion / Cofundadores.',
    campos: [
      { name: 'Aspirante', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Personaje', value: personaje, inline: true },
      { name: 'Area aspirada', value: area, inline: true },
      { name: 'Disponibilidad', value: disponibilidad, inline: true },
      { name: 'Experiencia RP', value: truncar(experiencia, 900), inline: false },
      { name: 'Motivacion', value: truncar(motivacion, 600), inline: false },
    ],
    footer: 'Postulaciones',
  });

  const destId =
    getConfig('canal_solicitudes') ||
    getConfig('canal_fichas') ||
    getConfig('canal_logs');

  if (destId && interaction.guild) {
    const ch = await interaction.guild.channels.fetch(destId).catch(() => null);
    if (ch?.isTextBased()) {
      await ch.send({ content: `Nueva postulacion **${id}**`, embeds: [embed] });
    }
  }

  await interaction.editReply({
    embeds: [
      embedBase({
        color: COLORES.medicina,
        titulo: 'Postulacion enviada',
        descripcion:
          `Tu hoja de vida RP (**${id}**) fue registrada.\n` +
          'La Fundacion revisara tu solicitud. Si es aprobada, se emitira un contrato de ingreso.',
        footer: 'Postulaciones',
      }),
    ],
  });
}

module.exports = { prefix, handle };

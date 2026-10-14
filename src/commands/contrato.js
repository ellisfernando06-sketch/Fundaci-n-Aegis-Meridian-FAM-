const {
  SlashCommandBuilder,
  AttachmentBuilder,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb, getConfig } = require('../db');
const { generarContrato } = require('../services/contrato');
const auditoria = require('../services/auditoria');
const { actorTexto } = require('../services/solicitudes');
const { embedBase, COLORES } = require('../utils/plantillas');
const { sanitizar } = require('../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('contrato')
    .setDescription('Genera el Contrato de Ingreso Word editable · Uso: Fundador, Cofundadores, Dir. General, Admin Jefe')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption((o) =>
      o.setName('miembro').setDescription('Miembro que firma el contrato').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('personaje').setDescription('Nombre del personaje / miembro en el documento').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('rango').setDescription('Rango o direccion asignada').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('fecha').setDescription('Fecha de ingreso (ej. 11/10/2026)').setRequired(false)
    )
    .addChannelOption((o) =>
      o.setName('canal')
        .setDescription('Canal de destino (por defecto canal de logs / fichas)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser('miembro');
    const personaje = sanitizar(interaction.options.getString('personaje'));
    const rango = sanitizar(interaction.options.getString('rango'));
    const fecha =
      interaction.options.getString('fecha') ||
      new Date().toLocaleDateString('es-PA');
    const canalOpt = interaction.options.getChannel('canal');

    const perfil = getDb().prepare('SELECT * FROM perfiles WHERE discord_id = ?').get(user.id);
    const discordTag = user.tag || user.username;

    let buffer;
    try {
      buffer = await generarContrato({
        miembro: personaje,
        discord: discordTag,
        rango,
        fecha,
        fundador: 'Ing. F. Ellis',
      });
    } catch (err) {
      console.error('[contrato]', err);
      await interaction.editReply({
        embeds: [
          embedBase({
            color: COLORES.denegado,
            titulo: 'No se pudo generar el contrato',
            descripcion: String(err.message || err).slice(0, 400),
            footer: 'Contratos',
          }),
        ],
      });
      return;
    }

    const nombreArchivo = `Contrato_Ingreso_${personaje.replace(/\s+/g, '_')}_${user.id}.docx`;
    const attachment = new AttachmentBuilder(buffer, { name: nombreArchivo });

    const destId =
      canalOpt?.id ||
      getConfig('canal_fichas') ||
      getConfig('canal_logs') ||
      getConfig('canal_solicitudes');

    let publicado = false;
    if (destId) {
      const ch = await interaction.guild.channels.fetch(destId).catch(() => null);
      if (ch && ch.isTextBased()) {
        await ch.send({
          content:
            `**Contrato de ingreso** · <@${user.id}>\n` +
            `Emitido por ${actorTexto(interaction.user)}`,
          embeds: [
            embedBase({
              color: COLORES.oro,
              author: true,
              titulo: 'Contrato de Ingreso y Servicio',
              campos: [
                { name: 'Miembro', value: `<@${user.id}>`, inline: true },
                { name: 'Personaje', value: personaje, inline: true },
                { name: 'Rango / Direccion', value: rango, inline: true },
                { name: 'Fecha', value: fecha, inline: true },
                { name: 'Ficha', value: perfil?.numero || '—', inline: true },
                { name: 'Emitido por', value: actorTexto(interaction.user), inline: true },
              ],
              descripcion:
                'Documento Word editable (.docx). El miembro puede descargarlo, firmar y devolverlo.',
              footer: 'Contratos',
            }),
          ],
          files: [attachment],
        });
        publicado = true;
      }
    }

    auditoria.registrar(interaction.user.id, 'CONTRATO.EMITIR', {
      miembro: user.id,
      personaje,
      rango,
      canal: destId || null,
    });

    // Copia efimera al emisor
    await interaction.editReply({
      embeds: [
        embedBase({
          color: COLORES.oro,
          author: true,
          titulo: 'Contrato generado',
          descripcion: publicado
            ? `El documento se publico en <#${destId}>. Copia adjunta para tu archivo.`
            : 'No hay canal de logs/fichas configurado. Se adjunta aqui. Usa `/config` → Canales o el parametro `canal`.',
          campos: [
            { name: 'Archivo', value: nombreArchivo, inline: false },
            { name: 'Miembro', value: `<@${user.id}>`, inline: true },
            { name: 'Rango', value: rango, inline: true },
          ],
          footer: 'Contratos',
        }),
      ],
      files: [attachment],
    });
  },
};

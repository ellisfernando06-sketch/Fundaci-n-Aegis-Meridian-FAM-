const {
  SlashCommandBuilder,
  MessageFlags,
} = require('discord.js');
const { getDb } = require('../db');
const auditoria = require('../services/auditoria');
const { embedBase, COLORES } = require('../utils/plantillas');
const { sanitizar } = require('../utils/helpers');

function asegurarTabla() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS firmas_digitales (
      discord_id TEXT PRIMARY KEY,
      texto TEXT,
      imagen_url TEXT,
      tipo_preferido TEXT DEFAULT 'texto',
      cargo_etiqueta TEXT,
      creado_en TEXT DEFAULT (datetime('now')),
      actualizado_en TEXT DEFAULT (datetime('now'))
    )
  `);
  try { getDb().exec('ALTER TABLE firmas_digitales ADD COLUMN imagen_url TEXT'); } catch (_) {}
  try { getDb().exec("ALTER TABLE firmas_digitales ADD COLUMN tipo_preferido TEXT DEFAULT 'texto'"); } catch (_) {}
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('firma')
    .setDescription('Registra o actualiza tu firma digital · Uso: cualquiera')
    .addSubcommand((s) =>
      s
        .setName('texto')
        .setDescription('Guarda una firma de texto')
        .addStringOption((o) =>
          o
            .setName('contenido')
            .setDescription('Como debe aparecer tu firma')
            .setRequired(true)
            .setMaxLength(60)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('imagen')
        .setDescription('Sube una imagen de tu firma (archivo adjunto)')
        .addAttachmentOption((o) =>
          o
            .setName('archivo')
            .setDescription('Imagen PNG, JPG o WebP de tu firma')
            .setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s.setName('ver').setDescription('Muestra tu firma registrada')
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    asegurarTabla();
    const sub = interaction.options.getSubcommand();

    if (sub === 'texto') {
      const texto = sanitizar(interaction.options.getString('contenido')).slice(0, 60);
      if (!texto) {
        await interaction.editReply({ content: 'La firma no puede estar vacia.' });
        return;
      }
      getDb()
        .prepare(`
          INSERT INTO firmas_digitales (discord_id, texto, tipo_preferido, actualizado_en)
          VALUES (?, ?, 'texto', datetime('now'))
          ON CONFLICT(discord_id) DO UPDATE SET
            texto = excluded.texto,
            tipo_preferido = 'texto',
            actualizado_en = datetime('now')
        `)
        .run(interaction.user.id, texto);
      auditoria.registrar(interaction.user.id, 'FIRMA.TEXTO', { texto });
      await interaction.editReply({
        embeds: [
          embedBase({
            color: COLORES.medicina,
            titulo: 'Firma de texto guardada',
            descripcion: `**${texto}**\nSe usara al firmar contratos (solo en el Word).`,
            footer: 'Firmas',
          }),
        ],
      });
      return;
    }

    if (sub === 'imagen') {
      const att = interaction.options.getAttachment('archivo');
      if (!att) {
        await interaction.editReply({ content: 'Adjunta una imagen.' });
        return;
      }
      const ct = (att.contentType || '').toLowerCase();
      const nombre = (att.name || '').toLowerCase();
      const esImagen =
        ct.startsWith('image/') ||
        /\.(png|jpe?g|webp|gif)$/i.test(nombre);
      if (!esImagen) {
        await interaction.editReply({
          content: 'El archivo debe ser una imagen (PNG, JPG, WebP).',
        });
        return;
      }
      if (att.size > 8 * 1024 * 1024) {
        await interaction.editReply({ content: 'La imagen no debe superar 8 MB.' });
        return;
      }

      const url = att.url || att.proxyURL;
      getDb()
        .prepare(`
          INSERT INTO firmas_digitales (discord_id, imagen_url, tipo_preferido, actualizado_en)
          VALUES (?, ?, 'imagen', datetime('now'))
          ON CONFLICT(discord_id) DO UPDATE SET
            imagen_url = excluded.imagen_url,
            tipo_preferido = 'imagen',
            actualizado_en = datetime('now')
        `)
        .run(interaction.user.id, url);
      auditoria.registrar(interaction.user.id, 'FIRMA.IMAGEN', {});

      await interaction.editReply({
        embeds: [
          embedBase({
            color: COLORES.medicina,
            titulo: 'Firma por imagen guardada',
            descripcion:
              'Tu firma digitalizada quedo registrada.\n' +
              'Al firmar un contrato, elige **Usar firma por imagen**; se insertara solo en el Word.',
            footer: 'Firmas',
            thumbnail: url,
          }),
        ],
      });
      return;
    }

    if (sub === 'ver') {
      const f = getDb()
        .prepare('SELECT * FROM firmas_digitales WHERE discord_id = ?')
        .get(interaction.user.id);
      if (!f || (!f.texto && !f.imagen_url)) {
        await interaction.editReply({
          embeds: [
            embedBase({
              color: COLORES.oro,
              titulo: 'Sin firma',
              descripcion:
                'No tienes firma registrada.\n' +
                '`/firma texto` o `/firma imagen` (adjunta el archivo en el mismo comando).',
              footer: 'Firmas',
            }),
          ],
        });
        return;
      }
      await interaction.editReply({
        embeds: [
          embedBase({
            color: COLORES.oro,
            titulo: 'Tu firma digital',
            descripcion:
              (f.texto ? `Texto: **${f.texto}**\n` : '') +
              (f.imagen_url ? `Imagen: [ver](${f.imagen_url})\n` : '') +
              `Preferida: **${f.tipo_preferido || 'texto'}**`,
            footer: 'Firmas',
            thumbnail: f.imagen_url || null,
          }),
        ],
      });
    }
  },
};

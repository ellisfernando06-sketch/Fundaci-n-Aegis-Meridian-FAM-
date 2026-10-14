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
      imagen_b64 TEXT,
      imagen_tipo TEXT,
      tipo_preferido TEXT DEFAULT 'texto',
      cargo_etiqueta TEXT,
      creado_en TEXT DEFAULT (datetime('now')),
      actualizado_en TEXT DEFAULT (datetime('now'))
    )
  `);
  try { getDb().exec('ALTER TABLE firmas_digitales ADD COLUMN imagen_url TEXT'); } catch (_) {}
  try { getDb().exec('ALTER TABLE firmas_digitales ADD COLUMN imagen_b64 TEXT'); } catch (_) {}
  try { getDb().exec('ALTER TABLE firmas_digitales ADD COLUMN imagen_tipo TEXT'); } catch (_) {}
  try { getDb().exec("ALTER TABLE firmas_digitales ADD COLUMN tipo_preferido TEXT DEFAULT 'texto'"); } catch (_) {}
}

async function descargarAdjunto(att) {
  const url = att.url || att.proxyURL;
  if (!url) return null;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AegisMeridianBot/1.0', Accept: 'image/*,*/*' },
  });
  if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = (att.contentType || res.headers.get('content-type') || '').toLowerCase();
  let tipo = 'png';
  if (ct.includes('jpeg') || ct.includes('jpg') || /\.jpe?g$/i.test(att.name || '')) tipo = 'jpg';
  else if (ct.includes('gif') || /\.gif$/i.test(att.name || '')) tipo = 'gif';
  else if (ct.includes('webp') || /\.webp$/i.test(att.name || '')) tipo = 'png';
  else if (ct.includes('png') || /\.png$/i.test(att.name || '')) tipo = 'png';
  return { b64: buf.toString('base64'), tipo, url, size: buf.length };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('firma')
    .setDescription('Registra o actualiza tu firma digital · Uso: cualquiera')
    .addSubcommand((s) =>
      s.setName('texto').setDescription('Guarda una firma de texto')
        .addStringOption((o) => o.setName('contenido').setDescription('Como debe aparecer tu firma').setRequired(true).setMaxLength(60))
    )
    .addSubcommand((s) =>
      s.setName('imagen').setDescription('Sube una imagen de tu firma (archivo en el comando)')
        .addAttachmentOption((o) => o.setName('archivo').setDescription('Imagen PNG o JPG de tu firma').setRequired(true))
    )
    .addSubcommand((s) => s.setName('ver').setDescription('Muestra tu firma registrada')),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    asegurarTabla();
    const sub = interaction.options.getSubcommand();

    if (sub === 'texto') {
      const texto = sanitizar(interaction.options.getString('contenido')).slice(0, 60);
      if (!texto) { await interaction.editReply({ content: 'La firma no puede estar vacia.' }); return; }
      getDb().prepare(`
        INSERT INTO firmas_digitales (discord_id, texto, tipo_preferido, actualizado_en)
        VALUES (?, ?, 'texto', datetime('now'))
        ON CONFLICT(discord_id) DO UPDATE SET texto = excluded.texto, tipo_preferido = 'texto', actualizado_en = datetime('now')
      `).run(interaction.user.id, texto);
      auditoria.registrar(interaction.user.id, 'FIRMA.TEXTO', { texto });
      await interaction.editReply({
        embeds: [embedBase({ color: COLORES.medicina, titulo: 'Firma de texto guardada', descripcion: `**${texto}**\nSe usara al firmar contratos (solo en el Word).`, footer: 'Firmas' })],
      });
      return;
    }

    if (sub === 'imagen') {
      const att = interaction.options.getAttachment('archivo');
      if (!att) { await interaction.editReply({ content: 'Adjunta una imagen.' }); return; }
      const ct = (att.contentType || '').toLowerCase();
      const nombre = (att.name || '').toLowerCase();
      const esImagen = ct.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(nombre);
      if (!esImagen) { await interaction.editReply({ content: 'El archivo debe ser una imagen (PNG o JPG).' }); return; }
      if (att.size > 4 * 1024 * 1024) { await interaction.editReply({ content: 'La imagen no debe superar 4 MB.' }); return; }

      let desc;
      try { desc = await descargarAdjunto(att); }
      catch (err) {
        console.error('[firma descargar]', err);
        await interaction.editReply({ content: `No se pudo leer la imagen: ${err.message}` });
        return;
      }

      getDb().prepare(`
        INSERT INTO firmas_digitales (discord_id, imagen_url, imagen_b64, imagen_tipo, tipo_preferido, actualizado_en)
        VALUES (?, ?, ?, ?, 'imagen', datetime('now'))
        ON CONFLICT(discord_id) DO UPDATE SET
          imagen_url = excluded.imagen_url,
          imagen_b64 = excluded.imagen_b64,
          imagen_tipo = excluded.imagen_tipo,
          tipo_preferido = 'imagen',
          actualizado_en = datetime('now')
      `).run(interaction.user.id, desc.url, desc.b64, desc.tipo);

      auditoria.registrar(interaction.user.id, 'FIRMA.IMAGEN', { bytes: desc.size, tipo: desc.tipo });
      await interaction.editReply({
        embeds: [embedBase({
          color: COLORES.medicina,
          titulo: 'Firma por imagen guardada',
          descripcion: `Imagen almacenada (${Math.round(desc.size / 1024)} KB).\nAl firmar un contrato elige **Usar firma por imagen**.`,
          footer: 'Firmas',
          thumbnail: desc.url,
        })],
      });
      return;
    }

    if (sub === 'ver') {
      const f = getDb().prepare('SELECT * FROM firmas_digitales WHERE discord_id = ?').get(interaction.user.id);
      if (!f || (!f.texto && !f.imagen_b64 && !f.imagen_url)) {
        await interaction.editReply({
          embeds: [embedBase({ color: COLORES.oro, titulo: 'Sin firma', descripcion: 'Usa `/firma texto` o `/firma imagen`.', footer: 'Firmas' })],
        });
        return;
      }
      const tieneImg = !!(f.imagen_b64 || f.imagen_url);
      await interaction.editReply({
        embeds: [embedBase({
          color: COLORES.oro,
          titulo: 'Tu firma digital',
          descripcion: (f.texto ? `Texto: **${f.texto}**\n` : '') + (tieneImg ? `Imagen: **si** (${f.imagen_tipo || 'png'})\n` : '') + `Preferida: **${f.tipo_preferido || 'texto'}**`,
          footer: 'Firmas',
          thumbnail: f.imagen_url || null,
        })],
      });
    }
  },
};

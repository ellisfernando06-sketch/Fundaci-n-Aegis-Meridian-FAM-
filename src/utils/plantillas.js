const { EmbedBuilder } = require('discord.js');

/**
 * Utilidades de plantillas de la Fundación Aegis-Meridian
 */

const COLORES = {
  cupula: 0x7f77dd,
  medicina: 0x1d9e75,
  investigacion: 0x1d9e75,
  seguridad: 0x378add,
  inteligencia: 0xba7517,
  sancion: 0xe24b4a,
  llave: 0xd4a017,
  neutral: 0x888780,
  denegado: 0xe24b4a,
  verde: 0x2e9e5b,
  amarillo: 0xe8b923,
  naranja: 0xe67e22,
  rojo: 0xe24b4a,
  negro: 0x1a1a1a,
  institucional: 0x0f0f1a,
  oro: 0xc9a227,
};

const MARCA = {
  nombre: 'Fundación Aegis-Meridian',
  lema: 'Custodes Veritatis',
};

function pie(contexto) {
  return `${MARCA.nombre} · ${contexto}`;
}

/**
 * Embed institucional.
 * footerIcon / thumbnail / image: URLs https
 * author: { name, iconURL, url }
 */
function embedBase({
  color,
  titulo,
  descripcion = null,
  campos = [],
  footer = null,
  footerIcon = null,
  thumbnail = null,
  image = null,
  author = null,
  timestamp = true,
}) {
  const embed = new EmbedBuilder()
    .setColor(color ?? COLORES.institucional)
    .setTitle(titulo);

  if (descripcion) embed.setDescription(descripcion);
  if (campos.length) embed.addFields(campos);

  if (author) {
    embed.setAuthor({
      name: author.name || MARCA.nombre,
      iconURL: author.iconURL || undefined,
      url: author.url || undefined,
    });
  }

  if (footer) {
    embed.setFooter({
      text: pie(footer),
      iconURL: footerIcon || undefined,
    });
  }

  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);
  if (timestamp) embed.setTimestamp();

  return embed;
}

function accesoDenegado({ recurso, nivelRequerido, nivelActual }) {
  return embedBase({
    color: COLORES.denegado,
    titulo: 'Acceso denegado',
    campos: [
      { name: 'Recurso solicitado', value: recurso || '—', inline: true },
      { name: 'Nivel requerido', value: String(nivelRequerido ?? '—'), inline: true },
      { name: 'Tu nivel', value: String(nivelActual ?? '—'), inline: true },
    ],
    footer: 'Control de acceso',
  });
}

function listado({ tema, filas, pagina = 1, totalPaginas = 1 }) {
  const texto = filas.length
    ? filas.map((f) => `**${f.id}** · ${f.titulo} · ${f.estado} · ${f.fecha}`).join('\n')
    : 'Sin registros.';

  return embedBase({
    color: COLORES.neutral,
    titulo: `Listado · ${tema}`,
    descripcion: texto,
    footer: `Página ${pagina} de ${totalPaginas}`,
  });
}

function configuracion({ ajuste, valorAnterior, valorNuevo, cambiadoPor }) {
  return embedBase({
    color: COLORES.neutral,
    titulo: 'Configuración',
    campos: [
      { name: 'Ajuste', value: ajuste, inline: true },
      { name: 'Valor anterior', value: valorAnterior || '—', inline: true },
      { name: 'Valor nuevo', value: valorNuevo || '—', inline: true },
      { name: 'Cambiado por', value: cambiadoPor || '—', inline: true },
    ],
    footer: 'Administración',
  });
}

module.exports = {
  COLORES,
  MARCA,
  pie,
  embedBase,
  accesoDenegado,
  listado,
  configuracion,
};

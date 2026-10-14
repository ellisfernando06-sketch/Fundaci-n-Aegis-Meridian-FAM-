/**
 * Panel de bienvenida · Fundación Aegis-Meridian
 * Diseño institucional: marca, estructura, separadores y guía de ingreso.
 */

const { EmbedBuilder } = require('discord.js');
const { SEPARADORES } = require('../data/organigrama');
const { COLORES, MARCA, logoUrl, bannerUrl } = require('../utils/plantillas');

const CANAL_BIENVENIDA = '1559071663155323022';

/**
 * Genera embeds de bienvenida (máx. 10). Diseño formal de institución.
 */
function embedBienvenida(client, guild) {
  const icon = logoUrl(client, guild);
  const banner = bannerUrl();

  const embedPrincipal = new EmbedBuilder()
    .setColor(COLORES.institucional)
    .setAuthor({
      name: MARCA.nombre,
      iconURL: icon || undefined,
    })
    .setTitle('Bienvenido a la Fundación Aegis-Meridian')
    .setDescription(
      [
        `**${MARCA.lema}**`,
        '',
        'Somos una institución privada e independiente dedicada a la contención,',
        'el estudio y la protección frente a anomalías. Ante el público operamos',
        'como organización científica; en el interior mantenemos la estructura',
        'de mando, las direcciones y el silencio operativo.',
        '',
        'Este servidor es el espacio oficial de **roleplay** y administración',
        'de la Fundación. Aquí se registran el personal, las operaciones y',
        'el organigrama.',
      ].join('\n')
    )
    .addFields(
      {
        name: 'Identidad',
        value: '**F.A.M.** · Privada e independiente · Est. 1991',
        inline: true,
      },
      {
        name: 'Principio',
        value: 'Cadena de mando · Rol y realidad separados · Una sola cuenta',
        inline: true,
      }
    )
    .setFooter({
      text: `${MARCA.nombre} · Bienvenida`,
      iconURL: icon || undefined,
    })
    .setTimestamp();

  if (banner) embedPrincipal.setImage(banner);
  if (icon) embedPrincipal.setThumbnail(icon);

  const embedIngreso = new EmbedBuilder()
    .setColor(COLORES.oro)
    .setTitle('Proceso de ingreso')
    .setDescription(
      [
        'Sigue este orden para formar parte del personal activo:',
        '',
        '**1.** Verifícate con Roblox · `/perfil`',
        '**2.** Envía tu postulación (hoja de vida RP) · `/postulacion`',
        '**3.** Espera la revisión de Fundador / Cofundadores',
        '**4.** Si eres aceptado, se emite el **Contrato de Ingreso**',
        '**5.** Firma el contrato · al completar ambas firmas se asigna tu rango',
        '',
        'Hasta la aprobación permanecerás en cuarentena / visitante.',
      ].join('\n')
    )
    .addFields(
      {
        name: 'Normas esenciales',
        value:
          '· Respeto dentro y fuera del rol\n' +
          '· Obediencia a la cadena de mando\n' +
          '· Reglamento de silencio (confidencialidad)\n' +
          '· Prohibidas cuentas alternas',
        inline: false,
      },
      {
        name: 'Ayuda',
        value: 'Usa `/ayuda` para ver todos los comandos y quién puede ejecutarlos.\nTickets de soporte según el panel del servidor.',
        inline: false,
      }
    )
    .setFooter({
      text: `${MARCA.nombre} · Ingreso`,
      iconURL: icon || undefined,
    });

  // Separadores del organigrama — listado completo, diseño limpio
  const listaSep = (SEPARADORES || [])
    .slice()
    .sort((a, b) => (a.orden || 0) - (b.orden || 0))
    .map((s, i) => {
      const etiqueta = String(s.nombreRol || s.key || '')
        .replace(/━+/g, '')
        .replace(/[『』]/g, '')
        .trim();
      return `\`${String(i + 1).padStart(2, '0')}\`  **${etiqueta}**`;
    })
    .join('\n');

  const embedEstructura = new EmbedBuilder()
    .setColor(COLORES.cupula)
    .setTitle('Estructura · Separadores del organigrama')
    .setDescription(
      [
        'El personal se organiza en bloques. Cada separador marca una sección',
        'de rangos en el servidor:',
        '',
        listaSep || '_Sin separadores cargados._',
        '',
        'Consulta el detalle de cargos con `/organigrama`.',
      ].join('\n')
    )
    .setFooter({
      text: `${MARCA.nombre} · Organigrama`,
      iconURL: icon || undefined,
    });

  const embedCierre = new EmbedBuilder()
    .setColor(COLORES.institucional)
    .setTitle('Custodes Veritatis')
    .setDescription(
      [
        'La Fundación no busca protagonismo: busca **orden, contención y verdad**.',
        '',
        'Si estás aquí para rolear con seriedad, respetar el mando y proteger',
        'lo que no debe salir a la luz, tienes un lugar en F.A.M.',
        '',
        '_Documento de bienvenida · uso interno del servidor._',
      ].join('\n')
    )
    .setFooter({
      text: `${MARCA.nombre} · Privada e independiente · Est. 1991`,
      iconURL: icon || undefined,
    });

  return [embedPrincipal, embedIngreso, embedEstructura, embedCierre];
}

/**
 * Mensaje corto al unirse un miembro (DM o canal).
 */
function embedMiembroNuevo(member, client) {
  const icon = logoUrl(client, member.guild);
  return new EmbedBuilder()
    .setColor(COLORES.oro)
    .setAuthor({
      name: MARCA.nombre,
      iconURL: icon || undefined,
    })
    .setTitle('Has entrado a la Fundación')
    .setDescription(
      [
        `Bienvenido, ${member}.`,
        '',
        'Lee el canal de bienvenida y sigue el proceso de ingreso.',
        'Comienza con `/perfil` y, cuando estés listo, `/postulacion`.',
        '',
        `**${MARCA.lema}**`,
      ].join('\n')
    )
    .setFooter({
      text: MARCA.nombre,
      iconURL: icon || undefined,
    })
    .setTimestamp();
}

module.exports = {
  CANAL_BIENVENIDA,
  embedBienvenida,
  embedMiembroNuevo,
};

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { embedBase, COLORES, MARCA } = require('../utils/plantillas');

const CATALOGO = [
  {
    grupo: 'Ingreso y personal',
    items: [
      { cmd: '/perfil', uso: 'Cualquiera', desc: 'Ficha, verificacion Roblox y estado' },
      { cmd: '/postulacion enviar', uso: 'Cualquiera', desc: 'Hoja de vida RP para ingresar' },
      { cmd: '/postulacion restaurar_botones', uso: 'Fundador / Cofundadores', desc: 'Reponer botones Aprobar/Negar/Entrevistar' },
      { cmd: '/organigrama', uso: 'Cualquiera', desc: 'Estructura de rangos y separadores' },
      { cmd: '/personal', uso: 'Fundador, Cofundadores, Dir. General, Admin Jefe · N1+', desc: 'Asignar cargo, area e historial' },
      { cmd: '/autorizacion', uso: 'Fundador, Cofundadores, Dir. General · N2+', desc: 'Niveles de autorizacion N0–N5' },
      { cmd: '/area', uso: 'Fundador, Cofundadores, Dir. General, Admin Jefe · N1+', desc: 'Asignar area / departamento' },
      { cmd: '/llaves', uso: 'Catalogo: cualquiera · Otorgar: mando', desc: 'Llaves (KEYS) de acceso' },
    ],
  },
  {
    grupo: 'Contratos y firmas',
    items: [
      { cmd: '/contrato', uso: 'Fundador / Cofundadores', desc: 'Emitir contrato de ingreso (.docx)' },
      { cmd: '/contratos registro', uso: 'Fundador, Cofundadores, Dir. General', desc: 'Registro de contratos (menu)' },
      { cmd: '/firma texto', uso: 'Cualquiera', desc: 'Registrar firma de texto' },
      { cmd: '/firma imagen', uso: 'Cualquiera', desc: 'Subir firma (archivo en el comando)' },
      { cmd: '/firma ver', uso: 'Cualquiera', desc: 'Ver tu firma guardada' },
    ],
  },
  {
    grupo: 'Operaciones (roleplay)',
    items: [
      { cmd: '/anomalia', uso: 'Investigacion · N2+ · KEY-INV', desc: 'Archivos de anomalias' },
      { cmd: '/incidente', uso: 'Seguridad / SI · N2+ · KEY-SEG / KEY-SI', desc: 'Incidentes operativos' },
      { cmd: '/alerta', uso: 'Dir. Operaciones SEG, Fundacion · N3+', desc: 'Nivel de alerta del sitio' },
      { cmd: '/mision', uso: 'Dir. Operaciones SEG, SI · N2+ · KEY-SEG', desc: 'Misiones y operativos' },
    ],
  },
  {
    grupo: 'Disciplina y Seguridad Interna',
    items: [
      { cmd: '/sancion', uso: 'SI, Dir. General, Admin Jefe · N2+ · KEY-SI', desc: 'Sanciones disciplinarias' },
      { cmd: '/interna', uso: 'SI alto / Inteligencia · N3+ (MD o canal oculto)', desc: 'Casos internos confidenciales' },
      { cmd: '/si', uso: 'Personal SI y direccion · N1+ · KEY-SI', desc: 'Panel SI: detencion, interrogatorio, listar' },
    ],
  },
  {
    grupo: 'Servicios del servidor',
    items: [
      { cmd: '/tickets', uso: 'Segun panel (soporte / admin)', desc: 'Mesa de asistencia y tickets' },
      { cmd: '/finanzas', uso: 'Fundador (pagos) · KEY-CUP', desc: 'Nominas, saldos y pagos' },
      { cmd: '/tienda', uso: 'Miembros con saldo', desc: 'Economato interno' },
      { cmd: '/bienvenida publicar', uso: 'Administrator Discord', desc: 'Panel de bienvenida institucional' },
      { cmd: '/ayuda', uso: 'Cualquiera', desc: 'Este catalogo de comandos' },
    ],
  },
  {
    grupo: 'Administracion del bot',
    items: [
      { cmd: '/config', uso: 'Administrator Discord', desc: 'Canales, sitios y contadores' },
      { cmd: '/config_roles', uso: 'Administrator Discord', desc: 'Crear, renombrar, ordenar y colorear roles' },
      { cmd: '/config_llaves', uso: 'Administrator Discord', desc: 'Definir llaves del sistema' },
      { cmd: '/config_canales', uso: 'Administrator Discord', desc: 'Desplegar categorias y canales' },
      { cmd: '/eliminar_roles', uso: 'Administrator Discord', desc: 'Limpieza masiva de roles del bot' },
    ],
  },
  {
    grupo: 'Prefijo de mensaje (!)',
    items: [
      { cmd: '!say texto', uso: 'Solo Fundador', desc: 'El bot envia el mensaje exacto' },
      { cmd: '!hablar #canal texto', uso: 'Solo Fundador', desc: 'Mensaje del bot en otro canal' },
      { cmd: '!decir texto', uso: 'Solo Fundador', desc: 'Alias de !say' },
    ],
  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ayuda')
    .setDescription('Catalogo de comandos de la Fundacion · Uso: cualquiera')
    .addStringOption((o) =>
      o.setName('seccion').setDescription('Filtrar por seccion').setRequired(false).addChoices(
        { name: 'Ingreso y personal', value: '0' },
        { name: 'Contratos y firmas', value: '1' },
        { name: 'Operaciones', value: '2' },
        { name: 'Disciplina y SI', value: '3' },
        { name: 'Servicios', value: '4' },
        { name: 'Administracion', value: '5' },
        { name: 'Prefijo !', value: '6' },
        { name: 'Todo', value: 'all' },
      )
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const filtro = interaction.options.getString('seccion') || 'all';
    const grupos = filtro === 'all' ? CATALOGO : [CATALOGO[parseInt(filtro, 10)]].filter(Boolean);
    const embeds = [];

    embeds.push(embedBase({
      color: COLORES.institucional,
      author: true,
      titulo: `Comandos · ${MARCA.corto}`,
      descripcion:
        `**${MARCA.nombre}** · ${MARCA.lema}\n\n` +
        'Debajo de cada comando se indica **quien puede usarlo**.\n' +
        'Niveles (N0–N5) y KEYS: `/autorizacion` y `/llaves`.',
      footer: 'Ayuda',
    }));

    for (const g of grupos) {
      if (!g) continue;
      const lineas = g.items.map((i) => `**${i.cmd}**\n_${i.uso}_\n${i.desc}`);
      let bloque = '';
      const campos = [];
      for (const linea of lineas) {
        if ((bloque + '\n\n' + linea).length > 1000) {
          campos.push({ name: campos.length ? '\u200b' : g.grupo, value: bloque });
          bloque = linea;
        } else {
          bloque = bloque ? `${bloque}\n\n${linea}` : linea;
        }
      }
      if (bloque) campos.push({ name: campos.length ? '\u200b' : g.grupo, value: bloque });
      embeds.push(embedBase({ color: COLORES.oro, titulo: g.grupo, campos, footer: 'Ayuda' }));
    }

    await interaction.editReply({ embeds: embeds.slice(0, 10) });
  },
};

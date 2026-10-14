const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { embedBase, COLORES } = require('../utils/plantillas');

const CATALOGO = [
  {
    grupo: 'Personal y acceso',
    items: [
      { cmd: '/perfil', uso: 'Cualquiera', desc: 'Ficha y verificacion Roblox' },
      { cmd: '/organigrama', uso: 'Cualquiera', desc: 'Estructura de rangos' },
      { cmd: '/personal', uso: 'Fundador, Cofundadores, Dir. General, Admin Jefe · N1+ · KEY-CUP / KEY-SI', desc: 'Asignar cargo e historial' },
      { cmd: '/autorizacion', uso: 'Fundador, Cofundadores, Dir. General · N2+ · KEY-CUP / KEY-SI', desc: 'Niveles de acceso N0–N5' },
      { cmd: '/area', uso: 'Fundador, Cofundadores, Dir. General, Admin Jefe · N1+', desc: 'Asignar area / departamento' },
      { cmd: '/llaves', uso: 'Catalogo: cualquiera · Otorgar: Manage Roles + mando', desc: 'Llaves de acceso' },
      { cmd: '/contrato', uso: 'Fundador, Cofundadores, Dir. General, Admin Jefe', desc: 'Contrato de ingreso Word editable' },
    ],
  },
  {
    grupo: 'Operaciones',
    items: [
      { cmd: '/anomalia', uso: 'Dir. Investigacion, mando INV · N2+ · KEY-INV', desc: 'Archivos de anomalias' },
      { cmd: '/incidente', uso: 'Seguridad, SI · N2+ · KEY-SEG / KEY-SI', desc: 'Incidentes operativos' },
      { cmd: '/alerta', uso: 'Dir. Operaciones SEG, Fundacion · N3+', desc: 'Nivel de alerta del sitio' },
      { cmd: '/mision', uso: 'Dir. Operaciones SEG, SI · N2+ · KEY-SEG', desc: 'Misiones y operativos' },
    ],
  },
  {
    grupo: 'Disciplina y SI',
    items: [
      { cmd: '/sancion', uso: 'SI, Dir. General, Admin Jefe · N2+ · KEY-SI', desc: 'Sanciones disciplinarias' },
      { cmd: '/interna', uso: 'SI alto, Inteligencia · N3+ · KEY-SI (solo MD o canal oculto)', desc: 'Casos internos' },
      { cmd: '/si', uso: 'Personal SI y direccion · N1+ · KEY-SI', desc: 'Panel, detenciones e interrogatorios' },
    ],
  },
  {
    grupo: 'Servicios',
    items: [
      { cmd: '/tickets', uso: 'Segun panel (soporte / admin)', desc: 'Panel de tickets' },
      { cmd: '/finanzas', uso: 'Fundador (pagos) · panel salarios', desc: 'Nominas y saldos' },
      { cmd: '/tienda', uso: 'Miembros con saldo', desc: 'Economato interno' },
    ],
  },
  {
    grupo: 'Administracion',
    items: [
      { cmd: '/config', uso: 'Administrator Discord', desc: 'Canales, sitios, contadores' },
      { cmd: '/config_roles', uso: 'Administrator Discord', desc: 'Crear, renombrar, ordenar roles' },
      { cmd: '/config_llaves', uso: 'Administrator Discord', desc: 'Catalogo de llaves' },
      { cmd: '/config_canales', uso: 'Administrator Discord', desc: 'Desplegar canales del roleplay' },
      { cmd: '/eliminar_roles', uso: 'Administrator Discord', desc: 'Limpieza masiva de roles' },
      { cmd: '/ayuda', uso: 'Cualquiera', desc: 'Este listado' },
    ],
  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ayuda')
    .setDescription('Catalogo de comandos y quien puede usarlos · Uso: cualquiera'),

  async execute(interaction) {
    const embeds = CATALOGO.map((g, i) =>
      embedBase({
        color: COLORES.institucional,
        author: i === 0,
        titulo: i === 0 ? 'Comandos · Fundacion Aegis-Meridian' : g.grupo,
        descripcion:
          (i === 0 ? `**${g.grupo}**\n\n` : '') +
          g.items
            .map((it) => `**${it.cmd}**\n${it.desc}\n_Quien puede:_ ${it.uso}`)
            .join('\n\n'),
        footer: 'Ayuda',
        timestamp: i === 0,
      })
    );

    // Discord max 10 embeds; we have 5
    await interaction.reply({
      embeds: embeds.slice(0, 10),
      flags: MessageFlags.Ephemeral,
    });
  },
};

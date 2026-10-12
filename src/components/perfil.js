const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');
const { getDb, nextId } = require('../db');
const roblox = require('../services/roblox');
const auditoria = require('../services/auditoria');
const { embedBase, COLORES } = require('../utils/plantillas');
const { ORGANIGRAMA } = require('../data/organigrama');
const { sanitizar, truncar } = require('../utils/helpers');

const prefix = 'perfil';

// El archivo completo se mantiene en el servicio; este bootstrap
// reexporta el handler restaurado desde el blob previo parcheado en deploy.
// Para evitar PLACEHOLDER, se carga la logica desde archivos locales del repo
// cuando Railway despliega el commit completo.

module.exports = require('./perfil_handler.js');

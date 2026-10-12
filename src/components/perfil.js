const parts = [
  require('./perfil_c0'),
  require('./perfil_c1'),
  require('./perfil_c2'),
  require('./perfil_c3'),
  require('./perfil_c4'),
  require('./perfil_c5'),
  require('./perfil_c6'),
];
const Module = require('module');
const code = parts.join('');
const m = new Module(module.id, module.parent);
m.filename = __filename;
m.paths = module.paths;
m._compile(code, __filename);
module.exports = m.exports;

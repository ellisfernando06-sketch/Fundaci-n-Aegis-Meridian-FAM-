const a = require('./perfil_src_a');
const b = require('./perfil_src_b');
const Module = require('module');
const code = a + b;
const m = new Module(module.id, module.parent);
m.filename = __filename;
m.paths = module.paths;
m._compile(code, __filename);
module.exports = m.exports;

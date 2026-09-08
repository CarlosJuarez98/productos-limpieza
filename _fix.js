const fs = require('fs');
const p = '_test_caja.js';
let t = fs.readFileSync(p, 'utf8');
t = t.replace('(C.transferencias', '(c.transferencias');
t = t.replace("json'.'Content", "json' :'Content");
t = t.replace('RETHRO_', 'RETIRO_');
fs.writeFileSync(p, t);
console.log('fixed');
const fs = require('fs');
const p = '_test_caja.js';
let t = fs.readFileSync(p, 'utf8');
t = t.replace("json' :'Content", "json', 'Content");
fs.writeFileSync(p, t);
console.log(t).split('\n')[31]);
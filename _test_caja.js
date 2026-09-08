const http = require('http');
const fs = require('fs');
function req(opts, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
function sum(c) {
  return {
    totalTransferencias: c.totalTransferencias,
    totalRetirosTransferencia: c.totalRetirosTransferencia,
    totalTransferenciasNetas: c.totalTransferenciasNetas,
    totalCaja: c.totalCaja,
    transferenciasLen: (c.transferencias || []).length
  };
}
(async () => {
  const base = { hostname: 'localhost', port: 8083 };
  const g1 = await req({ ...base, path: '/api/caja', method: 'GET' });
  const before = JSON.parse(g1.body);
  console.log('BEFORE', JSON.stringify(sum(before)));
  const payload = JSON.stringify({fecha:'2026-09-08',tipo:'RETIRO_TRANSFERENCIA',monto:5,motivo:'test-retiro-banco'});
  const post = await req({
    ...base, path: '/api/caja/movimientos', method: 'POST',
    headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload)}
  }, payload);
  console.log('POST', post.status, post.body);
  if (post.status >= 400) { process.exit(1); }
  const creado = JSON.parse(post.body);
  const g2 = await req({ ...base, path: '/api/caja', method: 'GET' });
  const after = JSON.parse(g2.body);
  console.log('AFTER_POST', JSON.stringify(sum(after)));
  const del = await req({ ...base, path: `/api/caja/movimientos/${creado.id}`, method: 'DELETE' });
  console.log('DELETE', del.status);
  const g3 = await req({ ...base, path: '/api/caja', method: 'GET' });
  const final = JSON.parse(g3.body);
  console.log('AFTER_DELETE', JSON.stringify(sum(final)));
  fs.writeFileSync('_caja_test_result.json', JSON.stringify({before:sum(before), post:{status:post.status,body:creado}, afterPost:sum(after), deleteStatus:del.status, afterDelete:sum(final)}, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
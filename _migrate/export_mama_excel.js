/**
 * Exporta Excel Mama → JSON seed (formato DataImportRunner).
 * Uso: node export_mama_excel.mjs
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const XLSX_PATH = 'A:/Descargas/Productos de limpieza Mama.xlsx';
const OUT = path.join(__dirname, 'mama_seed');
fs.mkdirSync(OUT, { recursive: true });

const wb = XLSX.readFile(XLSX_PATH, { cellDates: true, raw: false });

function sheetRows(name) {
  const ws = wb.Sheets[name];
  if (!ws) {
    const alt = wb.SheetNames.find((n) => n.toLowerCase().startsWith(name.toLowerCase().slice(0, 6)));
    if (!alt) return [];
    return XLSX.utils.sheet_to_json(wb.Sheets[alt], { defval: '', raw: false });
  }
  return XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
}

function sheetAoa(name) {
  const ws =
    wb.Sheets[name] ||
    wb.Sheets[wb.SheetNames.find((n) => n.toLowerCase().startsWith(name.toLowerCase().slice(0, 5)))];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
}

function money(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  let s = String(v).trim().replace(/[$€\s,]/g, '').replace(/[−–—]/g, '-');
  if (!s || s === '-' || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function fecha(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v)) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // M/D/YY or M/D/YYYY (Excel US)
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    // Heurística: si mes>12 imposible → día/mes; si día>12 → mes/día US
    let mo = Number(m[1]);
    let da = Number(m[2]);
    if (mo > 12 && da <= 12) {
      const t = mo;
      mo = da;
      da = t;
    }
    return `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
  }
  // 29-Oct-25 / 10-sep-2026
  m = s.match(/^(\d{1,2})[- ]([A-Za-z.]+)[- ](\d{2,4})$/i);
  if (m) {
    const meses = {
      ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
      jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
      jan: 1, apr: 4, aug: 8, dec: 12,
    };
    const key = m[2]
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\./g, '')
      .toLowerCase()
      .slice(0, 3);
    const mm = meses[key];
    if (!mm) return null;
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return `${y}-${String(mm).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (!isNaN(d)) return fecha(d);
  return null;
}

function pick(row, ...keys) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== '') return row[k];
  }
  // fuzzy: first key that includes fragment
  const entries = Object.entries(row);
  for (const frag of keys) {
    const f = String(frag).toLowerCase().slice(0, 12);
    const hit = entries.find(([k]) => k.toLowerCase().includes(f));
    if (hit && String(hit[1]).trim() !== '') return hit[1];
  }
  return '';
}

// Inventario
const invRaw = sheetRows('Inventario');
const inventario = [];
const stockEsperado = {};
for (const row of invRaw) {
  const nombre = String(pick(row, 'Productos', 'Producto', 'productos')).trim();
  if (!nombre) continue;
  const compra = money(pick(row, 'Precio compra', 'compra'));
  const cantIni = money(pick(row, 'Cantidad Inicial', 'Cantidad', 'inicial'));
  const stock = money(pick(row, 'Stock Actual', 'Stock'));
  const venta = money(pick(row, 'Precio Venta', 'venta hoy', 'Precio Venta Hoy'));
  inventario.push({
    nombre,
    precioCompra: compra ?? 0,
    cantidadInicial: cantIni ?? 0,
  });
  stockEsperado[nombre] = stock ?? 0;
  row.__venta = venta;
}

// Historico
const historico = [];
for (const row of sheetRows('Historico Precios')) {
  const producto = String(pick(row, 'Producto', 'Productos')).trim();
  const fv = fecha(pick(row, 'Fecha vigencia', 'Fecha'));
  const precio = money(pick(row, 'Costo', 'Precio', 'litro'));
  if (!producto || !fv || precio == null) continue;
  historico.push({ producto, fechaVigencia: fv, precio });
}
for (const row of invRaw) {
  const nombre = String(pick(row, 'Productos', 'Producto')).trim();
  const venta = row.__venta;
  if (!nombre || venta == null) continue;
  historico.push({ producto: nombre, fechaVigencia: '2026-09-10', precio: venta });
}

// Ventas (AOA: sheet_to_json pierde filas con fecha vacía en JSON)
const ventas = [];
const ventasAoa = sheetAoa('Ventas');
for (let r = 1; r < ventasAoa.length; r++) {
  const row = ventasAoa[r] || [];
  const f = fecha(row[0]);
  const producto = String(row[1] || '').trim();
  const tipo = String(row[2] || '').trim();
  const cantidad = money(row[3]);
  const total = money(row[4]);
  if (!f || !tipo) continue;
  const o = {
    fecha: f,
    tipoVenta: tipo,
    cantidad: cantidad ?? 0,
    total: total ?? 0,
  };
  if (producto) o.producto = producto;
  ventas.push(o);
}

// Entradas
const entradas = [];
const entAoa = sheetAoa('Entradas');
for (let r = 1; r < entAoa.length; r++) {
  const row = entAoa[r] || [];
  const f = fecha(row[0]);
  const producto = String(row[1] || '').trim();
  const cantidad = money(row[2]);
  const precioProveedor = money(row[3]);
  if (!f || !producto || cantidad == null) continue;
  entradas.push({
    fecha: f,
    producto,
    cantidad,
    precioProveedor: precioProveedor ?? 0,
  });
}

// Caja
const cajaAoa = sheetAoa('Caja');
const cajaConfig = {
  fechaInicio: fecha(cajaAoa[1]?.[1]) || '2026-04-15',
  fechaFin: fecha(cajaAoa[2]?.[1]) || '2026-09-10',
  fondoInicial: money(cajaAoa[3]?.[1]) ?? 0,
};
const movs = [];
for (let r = 2; r < cajaAoa.length; r++) {
  const row = cajaAoa[r] || [];
  const fRet = fecha(row[3]);
  const mRet = money(row[4]);
  const motRet = String(row[5] || '').trim();
  if (fRet && mRet != null && mRet !== 0) {
    movs.push({ fecha: fRet, tipo: 'RETIRO', monto: mRet, motivo: motRet || 'Retiro' });
  }
  const fIng = fecha(row[7]);
  const mIng = money(row[8]);
  if (fIng && mIng != null && mIng !== 0) {
    movs.push({ fecha: fIng, tipo: 'INGRESO', monto: mIng, motivo: 'Ingreso' });
  }
}

// Apartados AOA
const apAoa = sheetAoa('Apartados');
const apartados = [];
for (let r = 2; r < Math.min(apAoa.length, 200); r++) {
  const row = apAoa[r] || [];
  const fP = fecha(row[3]);
  const mP = money(row[4]);
  if (fP && mP != null && mP !== 0) {
    apartados.push({ fecha: fP, categoria: 'PRODUCTOS', ingreso: mP, tipo: 'INGRESO', motivo: null });
  }
  const fS = fecha(row[7]);
  const mS = money(row[8]);
  if (fS && mS != null && mS !== 0) {
    apartados.push({ fecha: fS, categoria: 'SALARIOS', ingreso: mS, tipo: 'INGRESO', motivo: null });
  }
  const fG = fecha(row[11]);
  const mG = money(row[12]);
  const motG = String(row[13] || '').trim();
  if (fG && mG != null && mG !== 0) {
    apartados.push({
      fecha: fG,
      categoria: 'PRODUCTOS',
      ingreso: mG,
      tipo: 'GASTO',
      motivo: motG || null,
    });
  }
}

// Inversion
const invName = wb.SheetNames.find((n) => n.toLowerCase().startsWith('inversi')) || 'Inversión';
const invAoa = sheetAoa(invName);
const invProductos = [];
const invInfra = [];
for (let r = 1; r < invAoa.length; r++) {
  const row = invAoa[r] || [];
  const nom = String(row[0] || '').trim();
  const cant = money(row[1]);
  const pu = money(row[2]);
  const tot = money(row[3]);
  if (nom && cant != null) {
    invProductos.push({
      nombre: nom,
      cantidad: cant,
      precioUnidad: pu ?? 0,
      total: tot ?? Number((cant * (pu ?? 0)).toFixed(2)),
    });
  }
  const mot = String(row[9] || '').trim();
  const cost = money(row[10]);
  if (mot && cost != null) {
    invInfra.push({ concepto: mot, monto: cost });
  }
}

function write(name, data) {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2), 'utf8');
}

write('inventario.json', inventario);
write('historico-precios.json', historico);
write('ventas.json', ventas);
write('entradas.json', entradas);
write('caja-config.json', cajaConfig);
write('caja-movimientos.json', movs);
write('apartados.json', apartados);
write('inversion.json', { productos: invProductos, infraestructura: invInfra });
write(
  'stock-esperado.json',
  Object.entries(stockEsperado).map(([producto, stock]) => ({ producto, stock }))
);

console.log(
  JSON.stringify(
    {
      inventario: inventario.length,
      ventas: ventas.length,
      entradas: entradas.length,
      precios: historico.length,
      movs: movs.length,
      apartados: apartados.length,
      invProd: invProductos.length,
      invInfra: invInfra.length,
      caja: cajaConfig,
    },
    null,
    2
  )
);

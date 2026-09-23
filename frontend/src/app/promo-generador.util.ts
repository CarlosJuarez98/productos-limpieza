/**
 * Flyers Amorcas formato Ropa / Trastes (4:5):
 * logo arriba notorio, título, slogan, solo nombres de productos,
 * stickers deco, pie de contacto. Precios van en el texto de WhatsApp.
 */

/** Departamento de un lote de publicidad. */
export type DeptoPromo = 'LIMPIEZA' | 'JARCERIA';

export type PromoGenerada = {
  id: string;
  titulo: string;
  descripcion: string;
  src: string;
  textoShare: string;
  blob: Blob;
  vertical?: boolean;
  /** Departamento del lote (limpieza / jarcería). */
  departamento?: DeptoPromo;
};

export type ProductoPromo = {
  id: number;
  nombre: string;
  precioVentaHoy: number;
  vendePor: 'LITROS' | 'PIEZA';
  departamento?: 'LIMPIEZA' | 'JARCERIA' | string;
};

type PrecioItem = { nombre: string; precio: string };

type Categoria = 'LIMPIEZA' | 'JARCERIA' | 'MIXTO';

type GrupoTema = 'lavado' | 'cocina' | 'suavizante' | 'jarceria' | 'mixto';

type StickerKey = 'detergente' | 'trastes' | 'jarceria' | 'burbujas';

type TemaFlyer = {
  titulo: string;
  categoria: Categoria;
  grupo: GrupoTema;
  headline: string;
  slogan: string;
  seccion: string;
  fondo: string;
  acentoTitulo: string;
  acentoSlogan: string;
};

type Composicion = {
  id: string;
  tema: TemaFlyer;
  vertical: boolean;
  precios: PrecioItem[];
  stickerKeys: StickerKey[];
};

/** Paleta Amorcas extraída del logo (navy · teal · lima). */
const Brand = {
  navy: '#183060',
  navyDeep: '#102038',
  teal: '#28A0B8',
  tealDeep: '#1A7A8C',
  lime: '#B0D040',
  limeDeep: '#7CB82E',
  limeSoft: '#D4E878',
  soft: '#E8F5F8',
  mint: '#F2F8E8',
  paper: '#F7FBFC',
  sky: '#E4F4F8',
  drop: '#A8D0D8',
} as const;

const CONTACTO = 'WhatsApp 247-120-6128 · Fracc. Los Álamos #121-C';
const TEL = '247-120-6128';
const DIR = 'FRACC. LOS ALAMOS #121-C';

/** Agrupa productos parecidos (como Ropa = jabones, Trastes = cocina). */
const KEY_GRUPO: Record<GrupoTema, RegExp> = {
  lavado:
    /ariel|persil|zote|vanish|carisma|detercon|mas\s*color|jab[oó]n|deterg|roma|ace|blancox|clorox|fabuloso|pinol/i,
  cocina:
    /axion|braso|sosa|cloro|trastes|desengr|lavatrastes|ajax|lim[oó]n|mr\.?\s*m[uú]sculo|quitasarro|sarro/i,
  suavizante: /downy|suaviz|aroma|vainilla|coco|manos|crema|jabon\s*manos/i,
  jarceria:
    /escoba|trapo|fibra|jalador|recogedor|trapeador|cepillo|esponja|cubeta|trape|mechudo|pa[nñ]o|guante/i,
  mixto: /./,
};

const TEMAS: TemaFlyer[] = [
  {
    titulo: 'Día de lavado',
    categoria: 'LIMPIEZA',
    grupo: 'lavado',
    headline: 'PRODUCTOS DE LIMPIEZA\nA GRANEL',
    slogan: 'LAVA MÁS, GASTA MENOS: LA INTELIGENCIA DE COMPRAR A GRANEL.',
    seccion: 'JABÓN TIPO:',
    fondo: Brand.paper,
    acentoTitulo: Brand.teal,
    acentoSlogan: Brand.navy,
  },
  {
    titulo: 'Ropa limpia',
    categoria: 'LIMPIEZA',
    grupo: 'lavado',
    headline: 'PRODUCTOS DE LIMPIEZA\nA GRANEL',
    slogan: 'LAVA MÁS, GASTA MENOS CON AMORCAS.',
    seccion: 'JABÓN TIPO:',
    fondo: Brand.sky,
    acentoTitulo: Brand.limeDeep,
    acentoSlogan: Brand.navy,
  },
  {
    titulo: 'Cocina / trastes',
    categoria: 'LIMPIEZA',
    grupo: 'cocina',
    headline: 'PRODUCTOS DE LIMPIEZA\nA GRANEL',
    slogan: 'LIMPIA, DESENGRASA Y AHORRA CON AMORCAS.',
    seccion: 'PRODUCTOS PARA COCINA TIPO:',
    fondo: Brand.mint,
    acentoTitulo: Brand.navy,
    acentoSlogan: Brand.tealDeep,
  },
  {
    titulo: 'Suavizantes',
    categoria: 'LIMPIEZA',
    grupo: 'suavizante',
    headline: 'PRODUCTOS DE LIMPIEZA\nA GRANEL',
    slogan: 'AROMA Y SUAVIDAD PARA TU ROPA.',
    seccion: 'SUAVIZANTE TIPO:',
    fondo: Brand.soft,
    acentoTitulo: Brand.teal,
    acentoSlogan: Brand.limeDeep,
  },
  {
    titulo: 'Jarcería y hogar',
    categoria: 'JARCERIA',
    grupo: 'jarceria',
    headline: 'JARCERÍA Y HOGAR\nAMORCAS',
    slogan: 'TODO PARA TU CASA, CERCA DE TI.',
    seccion: 'JARCERÍA:',
    fondo: Brand.sky,
    acentoTitulo: Brand.navy,
    acentoSlogan: Brand.teal,
  },
  {
    titulo: 'Equípate hoy',
    categoria: 'JARCERIA',
    grupo: 'jarceria',
    headline: 'JARCERÍA Y HOGAR\nAMORCAS',
    slogan: 'ESCOBAS, TRAPOS, FIBRAS Y MÁS.',
    seccion: 'PARA TU HOGAR:',
    fondo: Brand.mint,
    acentoTitulo: Brand.tealDeep,
    acentoSlogan: Brand.navy,
  },
  {
    titulo: 'Kit de limpieza',
    categoria: 'JARCERIA',
    grupo: 'jarceria',
    headline: 'JARCERÍA\nAMORCAS',
    slogan: 'LO QUE NECESITAS PARA DEJAR BRILLANTE.',
    seccion: 'JARCERÍA:',
    fondo: Brand.paper,
    acentoTitulo: Brand.limeDeep,
    acentoSlogan: Brand.navy,
  },
  {
    titulo: 'Hogar listo',
    categoria: 'JARCERIA',
    grupo: 'jarceria',
    headline: 'JARCERÍA Y HOGAR\nAMORCAS',
    slogan: 'CUBETAS, CEPILLOS, FIBRAS Y MÁS.',
    seccion: 'PARA TU CASA:',
    fondo: Brand.soft,
    acentoTitulo: Brand.navy,
    acentoSlogan: Brand.tealDeep,
  },
];

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    const done = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      resolve(w > 0 && h > 0 ? img : null);
    };
    img.onload = () => {
      if (typeof img.decode === 'function') {
        img.decode().then(done).catch(done);
      } else {
        done();
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rand<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fmtPrecio(p: ProductoPromo): string {
  const n = Number(p.precioVentaHoy);
  if (!Number.isFinite(n) || n <= 0) return '';
  const entero = Math.abs(n - Math.round(n)) < 0.005;
  const num = entero ? `$${Math.round(n)}` : `$${n.toFixed(2)}`;
  return p.vendePor === 'LITROS' ? `${num}/litro` : `${num}/pieza`;
}

function deptoDe(p: ProductoPromo): 'LIMPIEZA' | 'JARCERIA' {
  if (p.departamento === 'JARCERIA' || p.departamento === 'LIMPIEZA') return p.departamento;
  return p.vendePor === 'PIEZA' ? 'JARCERIA' : 'LIMPIEZA';
}

/** Elige productos del mismo departamento (sin mezclar limpieza ↔ jarcería). */
function pickDesdeInventario(
  inv: ProductoPromo[],
  categoria: Categoria,
  cuantos: number,
  grupo: GrupoTema
): PrecioItem[] {
  const activos = inv.filter((p) => Number(p.precioVentaHoy) > 0 && (p.nombre || '').trim());
  const depto: DeptoPromo =
    categoria === 'JARCERIA' ? 'JARCERIA' : 'LIMPIEZA';
  let pool = activos.filter((p) => deptoDe(p) === depto);
  // Si hay muy pocos del depto, igual no mezclar con el otro
  if (!pool.length) return [];

  const key = KEY_GRUPO[grupo];
  const preferidos = pool.filter((p) => key.test(p.nombre));
  if (preferidos.length >= 3) {
    pool = preferidos;
  } else if (preferidos.length > 0) {
    const resto = shuffle(pool.filter((p) => !preferidos.includes(p)));
    pool = [...shuffle(preferidos), ...resto];
  } else {
    pool = shuffle(pool);
  }

  return pool.slice(0, Math.min(cuantos, pool.length)).map((p) => ({
    nombre: p.nombre.trim(),
    precio: fmtPrecio(p),
  }));
}

function stickersDe(grupo: GrupoTema): StickerKey[] {
  switch (grupo) {
    case 'lavado':
    case 'suavizante':
      return ['detergente', 'burbujas'];
    case 'cocina':
      return ['trastes', 'burbujas'];
    case 'jarceria':
      return ['jarceria', 'trastes'];
    default:
      return shuffle(['detergente', 'trastes', 'jarceria'] as StickerKey[]).slice(0, 2);
  }
}

/** Quita fondo negro/blanco de stickers deco (como en Ropa / Trastes). */
function cleanSticker(img: HTMLImageElement, size: number): HTMLCanvasElement | null {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return null;
  const scale = Math.min(size / iw, size / ih);
  const dw = Math.max(1, Math.round(iw * scale));
  const dh = Math.max(1, Math.round(ih * scale));
  const off = document.createElement('canvas');
  off.width = dw;
  off.height = dh;
  const octx = off.getContext('2d', { willReadFrequently: true });
  if (!octx) return null;
  octx.clearRect(0, 0, dw, dh);
  octx.drawImage(img, 0, 0, dw, dh);
  const pix = octx.getImageData(0, 0, dw, dh);
  const d = pix.data;
  const n = dw * dh;
  const protect = new Uint8Array(n);
  const chroma = (r: number, g: number, b: number) =>
    Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (d[o + 3] < 180) continue;
    const r = d[o];
    const g = d[o + 1];
    const b = d[o + 2];
    // Fondo negro o casi blanco → no proteger (se elimina)
    const casiNegro = r < 28 && g < 28 && b < 28;
    const casiBlanco = r > 245 && g > 245 && b > 245;
    if (casiNegro || casiBlanco) continue;
    if (chroma(r, g, b) > 22 || r < 140) protect[i] = 1;
  }
  const rad = Math.max(3, Math.round(Math.min(dw, dh) * 0.01));
  const protect2 = new Uint8Array(n);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const i = y * dw + x;
      if (!protect[i]) continue;
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (dx * dx + dy * dy > rad * rad) continue;
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= dw || yy >= dh) continue;
          protect2[yy * dw + xx] = 1;
        }
      }
    }
  }
  for (let i = 0; i < n; i++) {
    if (protect2[i]) continue;
    const o = i * 4;
    d[o] = 0;
    d[o + 1] = 0;
    d[o + 2] = 0;
    d[o + 3] = 0;
  }
  octx.putImageData(pix, 0, 0);
  return off;
}

function drawSticker(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number,
  cy: number,
  size: number,
  rotDeg: number
): void {
  if (!img) return;
  const cleaned = cleanSticker(img, size);
  if (!cleaned) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.drawImage(cleaned, -cleaned.width / 2, -cleaned.height / 2);
  ctx.restore();
}

/** Quita el rectángulo blanco del PNG del logo. */
function logoSinFondo(img: HTMLImageElement, boxW: number, boxH: number): HTMLCanvasElement | null {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return null;
  const sc = Math.min(boxW / iw, boxH / ih);
  const dw = Math.max(1, Math.round(iw * sc));
  const dh = Math.max(1, Math.round(ih * sc));
  const off = document.createElement('canvas');
  off.width = dw;
  off.height = dh;
  const octx = off.getContext('2d', { willReadFrequently: true });
  if (!octx) return null;
  octx.clearRect(0, 0, dw, dh);
  octx.drawImage(img, 0, 0, dw, dh);
  const pix = octx.getImageData(0, 0, dw, dh);
  const d = pix.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    // Blanco / casi blanco del fondo → transparente
    if (r > 232 && g > 232 && b > 232) {
      d[i + 3] = 0;
    }
  }
  octx.putImageData(pix, 0, 0);
  return off;
}

/** Logo arriba a la derecha, sin fondo blanco ni sombra (como Ropa / Trastes). */
function drawLogoTopRight(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  W: number,
  margin: number,
  boxW: number
): number {
  const LOGO_AR = 1152 / 896;
  const boxH = Math.round(boxW / LOGO_AR);
  const x = W - margin - boxW;
  const y = margin - 6;
  if (!logo) {
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = `900 ${Math.round(boxW * 0.2)}px "Segoe UI", sans-serif`;
    ctx.fillStyle = Brand.navy;
    ctx.fillText('AMORCAS', W - margin, y + boxH * 0.35);
    return boxH;
  }
  const cleaned = logoSinFondo(logo, boxW, boxH);
  if (cleaned) {
    ctx.drawImage(cleaned, x + (boxW - cleaned.width) / 2, y + (boxH - cleaned.height) / 2);
  } else {
    const iw = logo.naturalWidth || logo.width;
    const ih = logo.naturalHeight || logo.height;
    const sc = Math.min(boxW / iw, boxH / ih);
    const dw = iw * sc;
    const dh = ih * sc;
    ctx.drawImage(logo, x + (boxW - dw) / 2, y + (boxH - dh) / 2, dw, dh);
  }
  return boxH;
}

function drawSparkles(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const colors = [Brand.teal, Brand.lime, Brand.limeSoft, Brand.navy, Brand.drop, Brand.limeDeep];
  const pts = [
    [W * 0.06, H * 0.18],
    [W * 0.48, H * 0.1],
    [W * 0.72, H * 0.22],
    [W * 0.1, H * 0.42],
    [W * 0.92, H * 0.38],
    [W * 0.18, H * 0.68],
    [W * 0.78, H * 0.72],
    [W * 0.5, H * 0.78],
  ];
  for (const [x, y] of pts) {
    const s = 10 + Math.random() * 12;
    ctx.fillStyle = rand(colors);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4 - Math.PI / 2;
      const r = i % 2 === 0 ? s : s * 0.35;
      const px = x + Math.cos(ang) * r;
      const py = y + Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const rows: string[] = [];
  let cur = words[0];
  for (let i = 1; i < words.length; i++) {
    const trial = `${cur} ${words[i]}`;
    if (ctx.measureText(trial).width <= maxW) cur = trial;
    else {
      rows.push(cur);
      cur = words[i];
    }
  }
  rows.push(cur);
  return rows;
}

function pickComposiciones(
  n: number,
  inv: ProductoPromo[],
  depto: DeptoPromo
): Composicion[] {
  const temasDepto = TEMAS.filter((t) => t.categoria === depto);
  const temas = shuffle(temasDepto.length ? [...temasDepto] : [...TEMAS]);
  const out: Composicion[] = [];
  for (let i = 0; i < n; i++) {
    const tema = temas[i % temas.length];
    const cuantos = 4 + Math.floor(Math.random() * 2); // 4–5, caben enteros en el flyer
    const precios = pickDesdeInventario(inv, tema.categoria, cuantos, tema.grupo);
    if (!precios.length) continue;
    out.push({
      id: `gen-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      tema,
      vertical: true,
      precios,
      stickerKeys: stickersDe(tema.grupo),
    });
  }
  // Si faltan (poco inventario), reintentar con temas del depto
  let guard = 0;
  while (out.length < n && guard++ < n * 3) {
    const tema = rand(temas);
    const precios = pickDesdeInventario(inv, tema.categoria, 5, tema.grupo);
    if (!precios.length) break;
    out.push({
      id: `gen-${Date.now().toString(36)}-x${guard}-${Math.random().toString(36).slice(2, 6)}`,
      tema,
      vertical: true,
      precios,
      stickerKeys: stickersDe(tema.grupo),
    });
  }
  return shuffle(out).slice(0, n);
}

const FRASES_SERVICIO = [
  'Ya estamos atendiendo.🫡\nVisítenos o haga su pedido 🏠.',
  '¡Ya abrimos! ✅🟢\nEstamos listos para servirles 🧼✨',
  'En servicio 🟢\nPase a visitarnos o pida a domicilio 🛵🏠',
  '¡Negocio abierto! 🚪✨\nLo esperamos o le llevamos su pedido 🏠.',
  'Atendiendo con gusto 🙌\nVisítenos o escríbanos por WhatsApp 💬',
];

function textoShareDe(_titulo: string, precios: PrecioItem[]): string {
  const lista = precios.map((p) => `• ${p.nombre} — ${p.precio}`).join('\n');
  const frase = FRASES_SERVICIO[Math.floor(Math.random() * FRASES_SERVICIO.length)];
  return [
    saludo(),
    '',
    ...frase.split('\n'),
    '',
    'Mira la variedad que tenemos en Amorcas:',
    '',
    'Precios menudeo:',
    lista,
    '',
    'Y muchos productos más · a domicilio o en tienda.',
    '',
    `🕘 Horario de atención: 9:00 am – 8:00 pm`,
    `📍 ${DIR}`,
    `💬 WhatsApp ${TEL}`,
  ].join('\n');
}

function saludo(): string {
  try {
    const parts = new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === 'hour')?.value) || new Date().getHours();
    if (h < 12) return 'Buenos días 🌻✨';
    if (h < 19) return 'Buenas tardes ☀️✨';
    return 'Buenas noches 🌙✨';
  } catch {
    return '¡Hola! ✨';
  }
}

type Stickers = Record<StickerKey, HTMLImageElement | null>;

function drawHeadlineShadowed(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  size: number,
  align: CanvasTextAlign,
  fill: string
): number {
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 ${size}px "Segoe UI", "Arial Black", Impact, sans-serif`;
  const lh = size + 12;
  lines.forEach((ln, i) => {
    const yy = y + i * lh;
    ctx.fillStyle = Brand.limeSoft;
    ctx.fillText(ln, x + 3, yy + 3);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(ln, x + 1, yy + 1);
    ctx.fillStyle = fill;
    ctx.fillText(ln, x, yy);
  });
  return lines.length * lh;
}

/** Dibuja icono PNG (WA / pin) centrado; recorta padding transparente. */
function drawIconImg(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number,
  cy: number,
  size: number,
  fallback: (c: CanvasRenderingContext2D, x: number, y: number, s: number) => void
): void {
  if (!img || (img.naturalWidth || img.width) <= 0) {
    fallback(ctx, cx, cy, size);
    return;
  }
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  // Recorte al contenido opaco (evita PNG con marco enorme / negro)
  const off = document.createElement('canvas');
  off.width = iw;
  off.height = ih;
  const octx = off.getContext('2d', { willReadFrequently: true });
  if (!octx) {
    fallback(ctx, cx, cy, size);
    return;
  }
  octx.clearRect(0, 0, iw, ih);
  octx.drawImage(img, 0, 0);
  const pix = octx.getImageData(0, 0, iw, ih);
  const d = pix.data;
  let minX = iw;
  let minY = ih;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < ih; y++) {
    for (let x = 0; x < iw; x++) {
      const a = d[(y * iw + x) * 4 + 3];
      if (a < 24) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  if (bw < 8 || bh < 8) {
    fallback(ctx, cx, cy, size);
    return;
  }
  const sc = Math.min(size / bw, size / bh);
  const dw = Math.max(1, Math.round(bw * sc));
  const dh = Math.max(1, Math.round(bh * sc));
  ctx.drawImage(img, minX, minY, bw, bh, cx - dw / 2, cy - dh / 2, dw, dh);
}

/** WhatsApp estilo Ropa (burbuja naranja rellena + teléfono claro). */
function drawWhatsAppIconFallback(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  const r = size * 0.46;
  const orange = '#F5A623';
  const deep = '#E08900';
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Burbuja rellena + cola
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.02, r, 0, Math.PI * 2);
  ctx.moveTo(cx - r * 0.55, cy + r * 0.55);
  ctx.quadraticCurveTo(cx - r * 0.95, cy + r * 1.05, cx - r * 0.75, cy + r * 0.95);
  ctx.quadraticCurveTo(cx - r * 0.35, cy + r * 0.75, cx - r * 0.25, cy + r * 0.62);
  ctx.closePath();
  ctx.fillStyle = orange;
  ctx.fill();
  ctx.strokeStyle = deep;
  ctx.lineWidth = Math.max(2, size * 0.035);
  ctx.stroke();
  // Auricular blanco
  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#fff';
  ctx.lineWidth = Math.max(5, size * 0.11);
  ctx.beginPath();
  ctx.arc(cx - r * 0.08, cy - r * 0.02, r * 0.38, 0.45, Math.PI * 1.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.32, cy + r * 0.12, r * 0.16, r * 0.22, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.18, cy - r * 0.22, r * 0.16, r * 0.22, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Fallback: pin rojo + casita blanca (Ropa 1 / 2). */
function drawLocationPinFallback(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  const s = size;
  ctx.save();
  // Base oval
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.42, s * 0.28, s * 0.09, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#E53935';
  ctx.fill();
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = Math.max(2, s * 0.035);
  ctx.stroke();
  // Pin
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.12, s * 0.36, Math.PI * 0.82, Math.PI * 2.18);
  ctx.lineTo(cx, cy + s * 0.42);
  ctx.closePath();
  ctx.fillStyle = '#E53935';
  ctx.fill();
  ctx.strokeStyle = '#1a1a1a';
  ctx.stroke();
  // Acento cyan bajo el pin
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.22, cy + s * 0.18);
  ctx.quadraticCurveTo(cx, cy + s * 0.38, cx + s * 0.22, cy + s * 0.18);
  ctx.strokeStyle = '#4DD0E1';
  ctx.lineWidth = Math.max(3, s * 0.05);
  ctx.stroke();
  // Disco blanco + casita
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.14, s * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  const hx = cx;
  const hy = cy - s * 0.18;
  const hw = s * 0.14;
  ctx.fillStyle = '#E53935';
  ctx.beginPath();
  ctx.moveTo(hx, hy - hw);
  ctx.lineTo(hx + hw, hy - hw * 0.05);
  ctx.lineTo(hx + hw * 0.62, hy - hw * 0.05);
  ctx.lineTo(hx + hw * 0.62, hy + hw * 0.85);
  ctx.lineTo(hx - hw * 0.62, hy + hw * 0.85);
  ctx.lineTo(hx - hw * 0.62, hy - hw * 0.05);
  ctx.lineTo(hx - hw, hy - hw * 0.05);
  ctx.closePath();
  ctx.fill();
  // Chimenea
  ctx.fillRect(hx - hw * 0.55, hy - hw * 1.05, hw * 0.22, hw * 0.35);
  ctx.restore();
}

/**
 * Formato Ropa / Trastes: 1080×1350 (4:5, igual proporción que 2160×2700).
 * Logo arriba derecha, título, slogan, solo nombres, stickers, pie con WA + pin.
 */
async function renderFlyer(
  comp: Composicion,
  logo: HTMLImageElement | null,
  stickers: Stickers,
  icons: { wa: HTMLImageElement | null; pin: HTMLImageElement | null }
): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  const { tema, precios } = comp;
  const margin = 44;
  const layout: 'lista-centro' | 'lista-izq' | 'lista-der' =
    Math.random() < 0.34 ? 'lista-centro' : Math.random() < 0.5 ? 'lista-izq' : 'lista-der';

  ctx.fillStyle = tema.fondo;
  ctx.fillRect(0, 0, W, H);
  drawSparkles(ctx, W, H);

  const logoW = 270;
  drawLogoTopRight(ctx, logo, W, margin, logoW);

  // Título grande y legible (escala ~Ropa a 1080)
  const headLines = tema.headline.split('\n');
  const titleMaxW = W - margin * 2 - logoW * 0.4;
  ctx.save();
  ctx.font = `900 72px "Segoe UI", "Arial Black", Impact, sans-serif`;
  const tooWide = headLines.some((ln) => ctx.measureText(ln).width > titleMaxW);
  ctx.restore();
  const size = tooWide ? 58 : 72;
  let y = margin + size + 8;
  drawHeadlineShadowed(ctx, headLines, margin, y, size, 'left', tema.acentoTitulo);
  y += headLines.length * (size + 14) + 20;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const sloganSize = 32;
  ctx.font = `800 ${sloganSize}px "Segoe UI", "Arial Black", sans-serif`;
  ctx.fillStyle = tema.acentoSlogan;
  const sloganRows = wrapLines(ctx, `"${tema.slogan}"`, W - margin * 2 - 16);
  for (const row of sloganRows) {
    ctx.fillText(row, W / 2, y);
    y += sloganSize + 12;
  }
  y += 18;

  // Stickers (espacio para tipografía grande)
  const stickerImgs = comp.stickerKeys
    .map((k) => stickers[k])
    .filter((x): x is HTMLImageElement => !!x);

  const midY = H * 0.6;
  if (layout === 'lista-centro') {
    if (stickerImgs[0]) drawSticker(ctx, stickerImgs[0], W * 0.12, midY, 340, -8);
    if (stickerImgs[1] || stickerImgs[0]) {
      drawSticker(ctx, stickerImgs[1] || stickerImgs[0], W * 0.88, midY - 20, 320, 8);
    }
  } else if (layout === 'lista-der') {
    if (stickerImgs[0]) drawSticker(ctx, stickerImgs[0], W * 0.18, midY, 380, -6);
    if (stickerImgs[1] || stickerImgs[0]) {
      drawSticker(ctx, stickerImgs[1] || stickerImgs[0], W * 0.22, midY + 220, 180, 10);
    }
  } else {
    if (stickerImgs[0]) drawSticker(ctx, stickerImgs[0], W * 0.78, midY, 380, 4);
    if (stickerImgs[1]) drawSticker(ctx, stickerImgs[1], W * 0.9, midY + 180, 170, -8);
  }

  let listX: number;
  let listMaxW: number;
  if (layout === 'lista-centro') {
    listX = W * 0.2;
    listMaxW = W * 0.6;
  } else if (layout === 'lista-der') {
    listX = W * 0.36;
    listMaxW = W * 0.58;
  } else {
    listX = margin;
    listMaxW = W * 0.58;
  }

  // Sección + nombres: ajustar tamaño para que TODOS quepan enteros (sin cortar)
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = Brand.navy;
  const secSize = 40;
  ctx.font = `900 ${secSize}px "Segoe UI", "Arial Black", sans-serif`;
  ctx.fillText(tema.seccion, listX, y);
  y += secSize + 20;

  const footReserve = 200;
  const listBottom = H - footReserve;
  const names = precios.map((p) => `•  ${p.nombre.toUpperCase()}`);
  let nameSize = 38;
  let lineH = 48;
  let gap = 8;

  const measureBlock = (fontPx: number, lh: number, g: number) => {
    ctx.font = `800 ${fontPx}px "Segoe UI", "Arial Black", sans-serif`;
    let h = 0;
    const blocks: string[][] = [];
    for (const full of names) {
      const rows = wrapLines(ctx, full, listMaxW);
      blocks.push(rows);
      h += rows.length * lh + g;
    }
    return { h, blocks };
  };

  let layoutNames = measureBlock(nameSize, lineH, gap);
  while (y + layoutNames.h > listBottom && nameSize > 26) {
    nameSize -= 2;
    lineH = Math.round(nameSize * 1.25);
    gap = Math.max(4, gap - 1);
    layoutNames = measureBlock(nameSize, lineH, gap);
  }
  // Si aún no caben, quitar productos de abajo hasta que entren completos
  while (layoutNames.blocks.length > 1 && y + layoutNames.h > listBottom) {
    names.pop();
    layoutNames = measureBlock(nameSize, lineH, gap);
  }

  ctx.font = `800 ${nameSize}px "Segoe UI", "Arial Black", sans-serif`;
  for (const rows of layoutNames.blocks) {
    for (const row of rows) {
      ctx.fillStyle = Brand.navyDeep;
      ctx.fillText(row, listX, y);
      y += lineH;
    }
    y += gap;
  }

  // Pie: iconos WA + pin (PNG o fallback legible) + texto
  const footY = H - 132;
  const iconSize = 96;
  const footGap = 14;
  const leftIconX = margin + iconSize / 2;
  const rightIconX = W - margin - iconSize / 2;
  drawIconImg(ctx, icons.wa, leftIconX, footY - 4, iconSize, drawWhatsAppIconFallback);
  drawIconImg(ctx, icons.pin, rightIconX, footY - 4, iconSize, drawLocationPinFallback);

  ctx.fillStyle = Brand.tealDeep;
  ctx.textBaseline = 'middle';
  const footFont = (px: number) => {
    ctx.font = `800 ${px}px "Segoe UI", "Arial Black", sans-serif`;
  };
  // Pedido (izquierda del icono → texto a la derecha)
  footFont(24);
  ctx.textAlign = 'left';
  const leftTextX = margin + iconSize + footGap;
  ctx.fillText('Haz tu pedido:', leftTextX, footY - 26);
  footFont(30);
  ctx.fillText(TEL, leftTextX, footY + 10);

  // Ubicación (icono a la derecha → texto a la izquierda)
  footFont(24);
  ctx.textAlign = 'right';
  const rightTextX = W - margin - iconSize - footGap;
  ctx.fillText('Estamos cerca de ti:', rightTextX, footY - 26);
  footFont(26);
  ctx.fillText(DIR, rightTextX, footY + 10);

  ctx.textAlign = 'center';
  ctx.fillStyle = Brand.teal;
  ctx.font = `700 24px "Segoe UI", sans-serif`;
  ctx.fillText('Contamos con servicio a domicilio (dentro del fracc.)', W / 2, footY + 56);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se generó la promo'))), 'image/png', 0.94);
  });
}

/**
 * Genera un lote (default 5) formato Ropa/Trastes 4:5.
 * Solo productos del departamento indicado (LIMPIEZA o JARCERIA).
 * Nombres en imagen; precios menudeo en el texto de WhatsApp.
 */
export async function generarLotePublicidad(
  cantidad = 5,
  inventario: ProductoPromo[] = [],
  depto: DeptoPromo = 'LIMPIEZA'
): Promise<PromoGenerada[]> {
  const media = (name: string) =>
    loadImage(`/publicidad/${name}?v=22`).then((i) => i || loadImage(`/api/publicidad/media/${name}?v=22`));

  const [logo, detergente, trastes, jarceria, burbujas, iconWa, iconPin] = await Promise.all([
    media('amorcas-chingon.png').then(
      (i) => i || loadImage('/amorcas-logo.png').then((j) => j || media('amorcas-c.jpg'))
    ),
    media('deco-detergente.png'),
    media('deco-trastes-jabon.png'),
    media('deco-jarceria.png'),
    media('deco-burbujas.png'),
    media('icon-wa-pedido.png'),
    media('icon-pin-casa.png'),
  ]);

  const stickers: Stickers = { detergente, trastes, jarceria, burbujas };
  const icons = { wa: iconWa, pin: iconPin };
  const comps = pickComposiciones(cantidad, inventario, depto);
  const out: PromoGenerada[] = [];

  for (const comp of comps) {
    if (!comp.precios.length) continue;
    const blob = await renderFlyer(comp, logo, stickers, icons);
    const src = URL.createObjectURL(blob);
    const preciosTxt = comp.precios.map((p) => `${p.nombre} ${p.precio}`).join(' · ');
    out.push({
      id: comp.id,
      titulo: comp.tema.titulo,
      descripcion: preciosTxt,
      src,
      textoShare: textoShareDe(comp.tema.titulo, comp.precios),
      blob,
      vertical: true,
      departamento: depto,
    });
  }
  if (!out.length) {
    throw new Error(
      depto === 'JARCERIA'
        ? 'No hay productos de jarcería con precio para armar promos'
        : 'No hay productos de limpieza con precio para armar promos'
    );
  }
  return out;
}

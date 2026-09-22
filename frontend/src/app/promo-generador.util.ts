/** Flyers Amorcas al estilo mercadotecnia (logo grande, aire y layouts llamativos). */

export type PromoGenerada = {
  id: string;
  titulo: string;
  descripcion: string;
  src: string;
  textoShare: string;
  blob: Blob;
  vertical?: boolean;
};

type Precio = { nombre: string; precio: string; nota?: string };

type StickerKey = 'detergente' | 'trastes' | 'jarceria' | 'burbujas';

/** Layouts alineados a las primeras piezas de mercadotecnia. */
type Layout = 'domicilio' | 'mayoreo' | 'lista' | 'banner';

type Tema = {
  id: string;
  titulo: string;
  headline: string;
  sub?: string;
  precios: Precio[];
  acento: string;
  fondoA: string;
  fondoB: string;
  ink: string;
  layout: Layout;
  sticker: StickerKey;
  vertical?: boolean;
  jarceria?: boolean;
  claro?: boolean;
};

type Stickers = Record<StickerKey, HTMLImageElement | null>;

const CONTACTO = 'WhatsApp 247-120-6128 · Fracc. Los Álamos #121-C';
const TEL = '247-120-6128';
const DIR = 'Fracc. Los Álamos #121-C';

const TEMAS_BASE: Tema[] = [
  {
    id: 'dom',
    titulo: 'Pide a domicilio',
    headline: 'TE LO LLEVAMOS\nA DOMICILIO',
    precios: [
      { nombre: 'Fabuloso', precio: '$10/L' },
      { nombre: 'Cloro', precio: '$6/L' },
      { nombre: 'Axion', precio: '$30/L' },
    ],
    acento: '#c8f542',
    fondoA: '#062a52',
    fondoB: '#0a3d6e',
    ink: '#062a52',
    layout: 'domicilio',
    sticker: 'detergente',
  },
  {
    id: 'mayo',
    titulo: 'Mayoreo que conviene',
    headline: 'MAYOREO QUE\nCONVIENE',
    sub: 'Ahorra comprando a granel',
    precios: [
      { nombre: 'Fabuloso', precio: '$6/L' },
      { nombre: 'Cloro', precio: '$3/L' },
      { nombre: 'Suavitel', precio: '$13/L' },
    ],
    acento: '#14b8a6',
    fondoA: '#e8f7f5',
    fondoB: '#c5ebe6',
    ink: '#0a2f5c',
    layout: 'mayoreo',
    sticker: 'detergente',
    claro: true,
  },
  {
    id: 'lav',
    titulo: 'Día de lavado',
    headline: 'DÍA DE\nLAVADO',
    precios: [
      { nombre: 'Ariel', precio: '$22/L' },
      { nombre: 'Roma', precio: '$25/L' },
      { nombre: 'Suavitel', precio: '$15/L' },
      { nombre: 'Vanish', precio: '$20/L' },
    ],
    acento: '#1d4ed8',
    fondoA: '#f0f7ff',
    fondoB: '#dbeafe',
    ink: '#0a2f5c',
    layout: 'lista',
    sticker: 'detergente',
    claro: true,
  },
  {
    id: 'coc',
    titulo: 'Cocina brillante',
    headline: 'COCINA BRILLANTE',
    precios: [
      { nombre: 'Axion', precio: '$30/L' },
      { nombre: 'Desengrasante', precio: '$54/L' },
      { nombre: 'Fibra', precio: '$5' },
      { nombre: 'Cloro gel', precio: '$24/L' },
    ],
    acento: '#f97316',
    fondoA: '#0a2f5c',
    fondoB: '#1e3a5f',
    ink: '#062a52',
    layout: 'banner',
    sticker: 'trastes',
  },
  {
    id: 'jarc',
    titulo: 'Jarcería y hogar',
    headline: 'JARCERÍA\nCON PRECIO',
    precios: [
      { nombre: 'Escoba', precio: '$45' },
      { nombre: 'Trapeador', precio: '$55' },
      { nombre: 'Cubeta', precio: '$35' },
      { nombre: 'Fibra', precio: '$15' },
    ],
    acento: '#fbbf24',
    fondoA: '#062a52',
    fondoB: '#0f4c5c',
    ink: '#062a52',
    layout: 'domicilio',
    sticker: 'jarceria',
    jarceria: true,
  },
  {
    id: 'jarc2',
    titulo: 'Todo para tu hogar',
    headline: '¡EQUÍPATE\nHOY!',
    sub: 'Jarcería para tu casa',
    precios: [
      { nombre: 'Guantes', precio: '$25' },
      { nombre: 'Cepillo', precio: '$20' },
      { nombre: 'Recogedor', precio: '$30' },
      { nombre: 'Jerga', precio: '$18' },
    ],
    acento: '#0d9488',
    fondoA: '#f0fdfa',
    fondoB: '#ccfbf1',
    ink: '#0a2f5c',
    layout: 'mayoreo',
    sticker: 'jarceria',
    jarceria: true,
    claro: true,
  },
  {
    id: 'combo',
    titulo: 'Combo limpieza',
    headline: 'COMBO\nLIMPIEZA',
    precios: [
      { nombre: 'Cloro + Fabuloso', precio: '$15' },
      { nombre: 'Axion 1L', precio: '$30' },
      { nombre: 'Suavitel 1L', precio: '$15' },
    ],
    acento: '#f472b6',
    fondoA: '#fdf4ff',
    fondoB: '#f5d0fe',
    ink: '#4a044e',
    layout: 'lista',
    sticker: 'trastes',
    claro: true,
  },
  {
    id: 'wa',
    titulo: 'Estado WhatsApp',
    headline: 'PIDE YA\nPOR WA',
    precios: [
      { nombre: 'Fabuloso', precio: '$10/L' },
      { nombre: 'Cloro', precio: '$6/L' },
      { nombre: 'Escoba', precio: '$45' },
    ],
    acento: '#4ade80',
    fondoA: '#064e3b',
    fondoB: '#0a2f5c',
    ink: '#064e3b',
    layout: 'domicilio',
    sticker: 'detergente',
    vertical: true,
  },
  {
    id: 'fracc',
    titulo: 'En tu fraccionamiento',
    headline: 'CERCA DE TI',
    precios: [
      { nombre: 'Fabuloso', precio: '$10/L' },
      { nombre: 'Cloro', precio: '$6/L' },
      { nombre: 'Cubeta', precio: '$35' },
    ],
    acento: '#22c55e',
    fondoA: '#0a2f5c',
    fondoB: '#134e4a',
    ink: '#0a2f5c',
    layout: 'banner',
    sticker: 'jarceria',
  },
];

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickTemas(n: number): Tema[] {
  const jar = shuffle(TEMAS_BASE.filter((t) => t.jarceria));
  const rest = shuffle(TEMAS_BASE.filter((t) => !t.jarceria));
  const mix = [...jar, ...rest];
  const out: Tema[] = [];
  for (const t of mix) {
    if (out.length >= n) break;
    out.push({ ...t, id: `${t.id}-${Date.now().toString(36)}-${out.length}` });
  }
  while (out.length < n) {
    const t = TEMAS_BASE[out.length % TEMAS_BASE.length];
    out.push({ ...t, id: `${t.id}-${Date.now().toString(36)}-${out.length}` });
  }
  return out;
}

function drawSparkles(ctx: CanvasRenderingContext2D, W: number, H: number, color: string): void {
  ctx.fillStyle = color;
  const pts = [
    [W * 0.12, H * 0.18],
    [W * 0.88, H * 0.22],
    [W * 0.18, H * 0.55],
    [W * 0.82, H * 0.48],
    [W * 0.7, H * 0.15],
  ];
  for (const [x, y] of pts) {
    const s = 10 + Math.random() * 8;
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

/** Esquinas geométricas estilo domicilio / cocina. */
function drawGeoCorners(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  color: string,
  footH: number
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.35);
  ctx.lineTo(W * 0.28, H * 0.55);
  ctx.lineTo(0, H - footH);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(W, H * 0.28);
  ctx.lineTo(W * 0.68, H * 0.52);
  ctx.lineTo(W, H - footH);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(0, H * 0.42);
  ctx.lineTo(W * 0.18, H * 0.58);
  ctx.lineTo(0, H * 0.72);
  ctx.closePath();
  ctx.fill();
}

/**
 * Logo grande y limpio (el PNG ya es circular).
 * Devuelve la Y inferior del logo (para dejar aire hasta el headline).
 */
function drawLogoGrande(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  W: number,
  cy: number,
  diametro: number
): number {
  const r = diametro / 2;
  if (logo) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;
    // El asset ya trae círculo blanco: se dibuja a tamaño completo, sin anillo extra.
    ctx.drawImage(logo, W / 2 - r, cy - r, diametro, diametro);
    ctx.restore();
  } else {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.22)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(W / 2, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#0a2f5c';
    ctx.font = `900 ${Math.round(diametro * 0.16)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('AMORCAS', W / 2, cy + 8);
  }
  return cy + r;
}

function drawStickerOnce(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number,
  cy: number,
  size: number,
  rotDeg: number
): void {
  if (!img) return;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;

  const scale = Math.min(size / iw, size / ih);
  const dw = Math.round(iw * scale);
  const dh = Math.round(ih * scale);

  const off = document.createElement('canvas');
  off.width = dw;
  off.height = dh;
  const octx = off.getContext('2d', { willReadFrequently: true });
  if (!octx) return;
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
    if (chroma(d[o], d[o + 1], d[o + 2]) > 28 || d[o] < 130) protect[i] = 1;
  }
  const rad = Math.max(4, Math.round(Math.min(dw, dh) * 0.012));
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
    const r = d[o];
    const g = d[o + 1];
    const b = d[o + 2];
    const a = d[o + 3];
    if (a < 12 || (chroma(r, g, b) <= 30 && r >= 130)) {
      d[o] = 0;
      d[o + 1] = 0;
      d[o + 2] = 0;
      d[o + 3] = 0;
    }
  }
  octx.putImageData(pix, 0, 0);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.drawImage(off, -dw / 2, -dh / 2);
  ctx.restore();
}

/** Pills verdes a lo ancho: "Fabuloso $10/L" (estilo domicilio). */
function drawPillsDomicilio(
  ctx: CanvasRenderingContext2D,
  precios: Precio[],
  x: number,
  y: number,
  w: number,
  acento: string,
  ink: string
): number {
  let yy = y;
  for (const p of precios) {
    roundRect(ctx, x, yy, w, 72, 36);
    ctx.fillStyle = acento;
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.font = '900 32px "Segoe UI", Impact, sans-serif';
    ctx.fillText(`${p.nombre} ${p.precio}`, x + w / 2, yy + 46);
    yy += 92;
  }
  return yy;
}

/** Tags blancos solapados con sombra (estilo mayoreo). */
function drawTagsMayoreo(
  ctx: CanvasRenderingContext2D,
  precios: Precio[],
  W: number,
  y: number,
  ink: string
): number {
  const tw = W * 0.58;
  const th = 88;
  let yy = y;
  precios.forEach((p, i) => {
    const offset = (i % 2 === 0 ? -1 : 1) * 28;
    const tx = (W - tw) / 2 + offset;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    roundRect(ctx, tx, yy, tw, th, 18);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.font = '900 34px "Segoe UI", Impact, sans-serif';
    ctx.fillText(`${p.nombre} ${p.precio}`, tx + tw / 2, yy + 54);
    yy += 78;
  });
  return yy + 20;
}

/** Lista en tarjeta blanca con bordes (estilo día de lavado). */
function drawListaCard(
  ctx: CanvasRenderingContext2D,
  precios: Precio[],
  W: number,
  y: number,
  ink: string,
  acento: string
): number {
  const bw = W * 0.72;
  const bx = (W - bw) / 2;
  const rowH = 70;
  const pad = 18;
  const bh = pad * 2 + precios.length * rowH;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  roundRect(ctx, bx, y, bw, bh, 16);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = acento;
  ctx.lineWidth = 4;
  roundRect(ctx, bx, y, bw, bh, 16);
  ctx.stroke();

  precios.forEach((p, i) => {
    const ry = y + pad + i * rowH;
    if (i > 0) {
      ctx.strokeStyle = 'rgba(10,47,92,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx + 28, ry);
      ctx.lineTo(bx + bw - 28, ry);
      ctx.stroke();
    }
    roundRect(ctx, bx + 20, ry + 10, bw - 40, rowH - 16, 10);
    ctx.strokeStyle = acento;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.font = '800 28px "Segoe UI", sans-serif';
    ctx.fillText(`${p.nombre} ${p.precio}`, bx + bw / 2, ry + 46);
  });
  return y + bh;
}

/** Headline en cinta naranja + lista blanca (estilo cocina). */
function drawBannerPromo(
  ctx: CanvasRenderingContext2D,
  headline: string,
  precios: Precio[],
  W: number,
  y: number,
  acento: string
): number {
  const h = 78;
  ctx.fillStyle = acento;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.lineTo(W, y + h);
  ctx.lineTo(0, y + h);
  ctx.closePath();
  ctx.fill();
  // muescas de cinta
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(28, y + h / 2);
  ctx.lineTo(0, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W, y);
  ctx.lineTo(W - 28, y + h / 2);
  ctx.lineTo(W, y + h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = '900 42px "Segoe UI", Impact, sans-serif';
  ctx.fillText(headline.replace(/\n/g, ' '), W / 2, y + 52);

  let yy = y + h + 36;
  for (const p of precios) {
    ctx.fillStyle = '#fff';
    ctx.font = '800 34px "Segoe UI", sans-serif';
    ctx.fillText(`${p.nombre}  ${p.precio}`, W / 2, yy);
    yy += 52;
  }
  return yy;
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  footH: number,
  claro: boolean
): void {
  ctx.fillStyle = claro ? '#0a2f5c' : 'rgba(4, 20, 40, 0.92)';
  ctx.fillRect(0, H - footH, W, footH);

  const mid = H - footH / 2 + 6;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = '800 26px "Segoe UI", sans-serif';
  ctx.fillText(`WhatsApp  ${TEL}`, W / 2, mid - 14);
  ctx.font = '700 20px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(DIR, W / 2, mid + 22);
}

function drawHeadline(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  W: number,
  y: number,
  color: string,
  size: number
): number {
  ctx.textAlign = 'center';
  lines.forEach((ln, i) => {
    const yy = y + i * (size + 10);
    ctx.font = `900 ${size}px "Segoe UI", Impact, sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillText(ln, W / 2 + 3, yy + 3);
    ctx.fillStyle = color;
    ctx.fillText(ln, W / 2, yy);
  });
  return y + lines.length * (size + 10);
}

async function renderTema(
  tema: Tema,
  logo: HTMLImageElement | null,
  stickers: Stickers
): Promise<Blob> {
  const vertical = !!tema.vertical;
  const W = vertical ? 720 : 1080;
  const H = vertical ? 1280 : 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  const footH = vertical ? 120 : 110;
  const claro = !!tema.claro;

  // Fondo
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, tema.fondoA);
  g.addColorStop(1, tema.fondoB);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (claro) {
    drawSparkles(ctx, W, H - footH, 'rgba(13,148,136,0.35)');
  } else if (tema.layout === 'domicilio' || tema.layout === 'banner') {
    drawGeoCorners(ctx, W, H, tema.acento, footH);
  }

  // Logo grande + aire generoso hasta el texto
  const logoDiam = vertical ? 260 : 320;
  const logoCy = vertical ? 165 : 190;
  const logoBottom = drawLogoGrande(ctx, logo, W, logoCy, logoDiam);
  const headStart = logoBottom + (vertical ? 52 : 64);

  const headColor = claro ? tema.ink : tema.layout === 'banner' ? '#fff' : tema.acento;
  const headSize = vertical ? 44 : tema.layout === 'banner' ? 0 : 58;
  let y = headStart;

  if (tema.layout !== 'banner') {
    y = drawHeadline(ctx, tema.headline.split('\n'), W, y, headColor, headSize);
    if (tema.sub) {
      y += 8;
      ctx.fillStyle = claro ? 'rgba(10,47,92,0.7)' : 'rgba(255,255,255,0.85)';
      ctx.font = 'italic 700 26px Georgia, "Segoe UI", serif';
      ctx.textAlign = 'center';
      ctx.fillText(tema.sub, W / 2, y);
      y += 36;
    } else {
      y += 28;
    }
  }

  const contentX = W * 0.12;
  const contentW = W * 0.76;

  if (tema.layout === 'domicilio') {
    drawPillsDomicilio(ctx, tema.precios, contentX, y, contentW, tema.acento, tema.ink);
  } else if (tema.layout === 'mayoreo') {
    drawTagsMayoreo(ctx, tema.precios, W, y, tema.ink);
  } else if (tema.layout === 'lista') {
    drawListaCard(ctx, tema.precios, W, y, tema.ink, tema.acento);
  } else {
    // banner: headline en cinta; un poco más abajo del logo
    drawBannerPromo(ctx, tema.headline, tema.precios, W, y + 8, tema.acento);
  }

  // Un sticker discreto (no tapa logo ni headline)
  const product = stickers[tema.sticker];
  if (tema.layout === 'domicilio' || tema.layout === 'banner') {
    drawStickerOnce(ctx, product, W * 0.86, H - footH - 130, vertical ? 160 : 200, 10);
  } else if (tema.layout === 'mayoreo') {
    drawStickerOnce(ctx, product, W * 0.14, H - footH - 140, 170, -8);
  }

  drawFooter(ctx, W, H, footH, claro);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se generó la promo'))), 'image/png', 0.94);
  });
}

/** Genera lote estilo mercadotecnia (logo grande, aire, 4 layouts). */
export async function generarLotePublicidad(cantidad = 6): Promise<PromoGenerada[]> {
  const media = (name: string) =>
    loadImage(`/api/publicidad/media/${name}?v=10`).then((i) => i || loadImage(`/publicidad/${name}?v=10`));

  const [logo, detergente, trastes, jarceria, burbujas] = await Promise.all([
    media('amorcas-chingon.png').then(
      (i) => i || loadImage('/amorcas-logo.png').then((j) => j || media('amorcas-c.jpg'))
    ),
    media('deco-detergente.png'),
    media('deco-trastes-jabon.png'),
    media('deco-jarceria.png'),
    media('deco-burbujas.png'),
  ]);

  const stickers: Stickers = { detergente, trastes, jarceria, burbujas };
  const temas = pickTemas(cantidad);
  const out: PromoGenerada[] = [];

  for (const tema of temas) {
    const blob = await renderTema(tema, logo, stickers);
    const src = URL.createObjectURL(blob);
    const preciosTxt = tema.precios.map((p) => `${p.nombre} ${p.precio}`).join(' · ');
    out.push({
      id: `gen-${tema.id}`,
      titulo: tema.titulo,
      descripcion: `${preciosTxt} · ${CONTACTO}`,
      src,
      textoShare: `${tema.titulo} — Amorcas · ${preciosTxt} · ${CONTACTO}`,
      blob,
      vertical: tema.vertical,
    });
  }
  return out;
}

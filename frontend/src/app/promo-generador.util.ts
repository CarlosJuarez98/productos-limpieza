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

type GrupoTema = 'lavado' | 'cocina' | 'suavizante' | 'aroma' | 'manos' | 'jarceria' | 'mixto';

type StickerKey = 'detergente' | 'trastes' | 'jarceria' | 'burbujas';

type TemaFlyer = {
  titulo: string;
  categoria: Categoria;
  grupo: GrupoTema;
  headline: string;
  slogan: string;
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

/** Familias estrictas (sin mezclar jabón de manos con suavizante, etc.). */
const KEY_GRUPO: Record<GrupoTema, RegExp> = {
  manos: /jab[oó]n\s*manos|crema\s*manos/i,
  suavizante: /downy|suavitel|suaviz/i,
  aroma: /aromatiz|fabuloso|^pino$|pinol|creolina|almorol/i,
  lavado: /jab[oó]n\s*tipo|ariel|persil|zote|vanish|carisma|detercon|mas\s*color|\broma\b|deterg/i,
  cocina:
    /axion|brazo|braso|cloro|desengr|sosa|sarro|vidrios|hipoclor|teflon|abrillantador|pastilla\s*de\s*cloro/i,
  jarceria:
    /escoba|trapo|fibra|jalador|recogedor|trapeador|cepillo|esponja|cubeta|trape|mechudo|pa[nñ]o|guante/i,
  mixto: /./,
};

/** Orden de clasificación: lo más específico primero. */
const ORDEN_GRUPO: GrupoTema[] = ['manos', 'suavizante', 'aroma', 'lavado', 'cocina', 'jarceria'];

function clasificarProducto(nombre: string): GrupoTema {
  const n = nombre || '';
  for (const g of ORDEN_GRUPO) {
    if (KEY_GRUPO[g].test(n)) return g;
  }
  return 'mixto';
}

/** Un solo eslogan acorde a la familia real de los productos listados. */
function sloganParaProductos(precios: PrecioItem[], grupo: GrupoTema): string {
  const votos: Partial<Record<GrupoTema, number>> = {};
  for (const p of precios) {
    const g = clasificarProducto(p.nombre);
    votos[g] = (votos[g] || 0) + 1;
  }
  let familia = grupo;
  let best = 0;
  for (const [g, n] of Object.entries(votos) as [GrupoTema, number][]) {
    if (n > best && g !== 'mixto') {
      best = n;
      familia = g;
    }
  }

  switch (familia) {
    case 'aroma':
      return rand([
        '¡AROMA QUE LLENA TU CASA AL PRECIO DEL GRANEL!',
        '¡TU HOGAR HUELE INCREÍBLE SIN GASTAR DE MÁS!',
        '¡FRAGANCIA DE MARCA, LITRO A PRECIO AMORCAS!',
      ]);
    case 'suavizante':
      return rand([
        '¡ROPA SUAVE Y PERFUMADA AL PRECIO DEL GRANEL!',
        '¡SUAVIDAD QUE DURA Y PRECIO QUE CONVIENE!',
      ]);
    case 'manos':
      return rand([
        '¡MANOS LIMPIAS Y SUAVES, LITRO A BUEN PRECIO!',
        '¡JABÓN PARA MANOS A GRANEL: AHORRA CADA DÍA!',
      ]);
    case 'cocina':
      return rand([
        '¡DESENGRASA FUERTE Y AHORRA EN CADA LITRO!',
        '¡TRASTES Y COCINA BRILLANTES SIN GASTAR DE MÁS!',
      ]);
    case 'lavado':
      return rand([
        '¡LAVA MÁS ROPA Y GASTA MENOS EN CADA LITRO!',
        '¡JABÓN DE MARCA, PRECIO DE GRANEL!',
      ]);
    case 'jarceria':
      return rand([
        '¡TODO PARA DEJAR TU CASA IMPECABLE!',
        '¡DE LA ESCOBA AL TRAPEADOR, LO TENEMOS!',
      ]);
    default:
      return rand(['¡CALIDAD DE MARCA, PRECIO DE GRANEL!', '¡LLEVA SOLO LO QUE NECESITAS Y AHORRA!']);
  }
}

const TEMAS: TemaFlyer[] = [
  {
    titulo: 'Día de lavado',
    categoria: 'LIMPIEZA',
    grupo: 'lavado',
    headline: 'PRODUCTOS DE LIMPIEZA\nA GRANEL',
    slogan: '¡LAVA MÁS ROPA Y GASTA MENOS EN CADA LITRO!',
    fondo: Brand.paper,
    acentoTitulo: Brand.teal,
    acentoSlogan: Brand.navy,
  },
  {
    titulo: 'Ropa limpia',
    categoria: 'LIMPIEZA',
    grupo: 'lavado',
    headline: 'PRODUCTOS DE LIMPIEZA\nA GRANEL',
    slogan: '¡JABÓN DE MARCA, PRECIO DE GRANEL!',
    fondo: Brand.sky,
    acentoTitulo: Brand.limeDeep,
    acentoSlogan: Brand.navy,
  },
  {
    titulo: 'Cocina / trastes',
    categoria: 'LIMPIEZA',
    grupo: 'cocina',
    headline: 'PRODUCTOS DE LIMPIEZA\nA GRANEL',
    slogan: '¡DESENGRASA FUERTE Y AHORRA EN CADA LITRO!',
    fondo: Brand.mint,
    acentoTitulo: Brand.navy,
    acentoSlogan: Brand.tealDeep,
  },
  {
    titulo: 'Aromatizantes',
    categoria: 'LIMPIEZA',
    grupo: 'aroma',
    headline: 'PRODUCTOS DE LIMPIEZA\nA GRANEL',
    slogan: '¡AROMA QUE LLENA TU CASA AL PRECIO DEL GRANEL!',
    fondo: Brand.soft,
    acentoTitulo: Brand.teal,
    acentoSlogan: Brand.navy,
  },
  {
    titulo: 'Suavizantes',
    categoria: 'LIMPIEZA',
    grupo: 'suavizante',
    headline: 'PRODUCTOS DE LIMPIEZA\nA GRANEL',
    slogan: '¡ROPA SUAVE Y PERFUMADA AL PRECIO DEL GRANEL!',
    fondo: Brand.paper,
    acentoTitulo: Brand.limeDeep,
    acentoSlogan: Brand.tealDeep,
  },
  {
    titulo: 'Jabón de manos',
    categoria: 'LIMPIEZA',
    grupo: 'manos',
    headline: 'PRODUCTOS DE LIMPIEZA\nA GRANEL',
    slogan: '¡MANOS LIMPIAS Y SUAVES, LITRO A BUEN PRECIO!',
    fondo: Brand.sky,
    acentoTitulo: Brand.teal,
    acentoSlogan: Brand.navy,
  },
  {
    titulo: 'Jarcería y hogar',
    categoria: 'JARCERIA',
    grupo: 'jarceria',
    headline: 'JARCERÍA Y HOGAR\nAMORCAS',
    slogan: '¡TODO PARA DEJAR TU CASA IMPECABLE!',
    fondo: Brand.sky,
    acentoTitulo: Brand.navy,
    acentoSlogan: Brand.teal,
  },
  {
    titulo: 'Equípate hoy',
    categoria: 'JARCERIA',
    grupo: 'jarceria',
    headline: 'JARCERÍA Y HOGAR\nAMORCAS',
    slogan: '¡DE LA ESCOBA AL TRAPEADOR, LO TENEMOS!',
    fondo: Brand.mint,
    acentoTitulo: Brand.tealDeep,
    acentoSlogan: Brand.navy,
  },
  {
    titulo: 'Kit de limpieza',
    categoria: 'JARCERIA',
    grupo: 'jarceria',
    headline: 'JARCERÍA\nAMORCAS',
    slogan: '¡LO ESENCIAL PARA UNA CASA QUE BRILLA!',
    fondo: Brand.paper,
    acentoTitulo: Brand.limeDeep,
    acentoSlogan: Brand.navy,
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

/** Solo productos de la misma familia (nunca rellenar con otros). */
function pickDesdeInventario(
  inv: ProductoPromo[],
  categoria: Categoria,
  cuantos: number,
  grupo: GrupoTema
): PrecioItem[] {
  const activos = inv.filter((p) => Number(p.precioVentaHoy) > 0 && (p.nombre || '').trim());
  const depto: DeptoPromo = categoria === 'JARCERIA' ? 'JARCERIA' : 'LIMPIEZA';
  const delDepto = activos.filter((p) => deptoDe(p) === depto);
  if (!delDepto.length) return [];

  const delGrupo = delDepto.filter((p) => clasificarProducto(p.nombre) === grupo);
  if (delGrupo.length < 2) return [];

  return shuffle(delGrupo)
    .slice(0, Math.min(cuantos, delGrupo.length))
    .map((p) => ({
      nombre: p.nombre.trim(),
      precio: fmtPrecio(p),
    }));
}

function familiaDePrecios(precios: PrecioItem[], fallback: GrupoTema): GrupoTema {
  const votos: Partial<Record<GrupoTema, number>> = {};
  for (const p of precios) {
    const g = clasificarProducto(p.nombre);
    if (g === 'mixto') continue;
    votos[g] = (votos[g] || 0) + 1;
  }
  let best = fallback;
  let n = 0;
  for (const [g, c] of Object.entries(votos) as [GrupoTema, number][]) {
    if (c > n) {
      n = c;
      best = g;
    }
  }
  return best;
}

/** Stickers acordes a la familia real de la lista (no genéricos). */
function stickersDe(grupo: GrupoTema): StickerKey[] {
  switch (grupo) {
    case 'lavado':
      return ['detergente'];
    case 'suavizante':
      return ['detergente'];
    case 'manos':
      return ['burbujas'];
    case 'aroma':
      return ['burbujas'];
    case 'cocina':
      return ['trastes'];
    case 'jarceria':
      return ['jarceria'];
    default:
      return ['detergente'];
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

/**
 * Destellos solo en zona de stickers / bordes: nunca sobre título, slogan ni lista.
 * (Columna izq. ~0–55% y franja superior/pie quedan libres.)
 */
function drawSparkles(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const colors = [Brand.teal, Brand.lime, Brand.limeSoft, Brand.drop];
  // Solo derecha / esquinas lejos del texto
  const pts = [
    [W * 0.9, H * 0.16],
    [W * 0.96, H * 0.32],
    [W * 0.88, H * 0.48],
    [W * 0.94, H * 0.62],
    [W * 0.08, H * 0.88],
    [W * 0.72, H * 0.86],
  ];
  ctx.save();
  ctx.globalAlpha = 0.28;
  for (const [x, y] of pts) {
    const s = 7 + Math.random() * 7;
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
  ctx.restore();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const rows: string[] = [];
  let cur = '';
  const pushWord = (w: string) => {
    if (!cur) {
      if (ctx.measureText(w).width <= maxW) {
        cur = w;
        return;
      }
      // Palabra más ancha que la columna: cortar por caracteres
      let chunk = '';
      for (const ch of w) {
        const trial = chunk + ch;
        if (ctx.measureText(trial).width <= maxW) chunk = trial;
        else {
          if (chunk) rows.push(chunk);
          chunk = ch;
        }
      }
      cur = chunk;
      return;
    }
    const trial = `${cur} ${w}`;
    if (ctx.measureText(trial).width <= maxW) cur = trial;
    else {
      rows.push(cur);
      cur = '';
      pushWord(w);
    }
  };
  for (const w of words) pushWord(w);
  if (cur) rows.push(cur);
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
  const pushComp = (tema: TemaFlyer, precios: PrecioItem[], i: number, tag: string) => {
    const familia = familiaDePrecios(precios, tema.grupo);
    out.push({
      id: `gen-${Date.now().toString(36)}-${tag}${i}-${Math.random().toString(36).slice(2, 6)}`,
      tema: { ...tema, slogan: sloganParaProductos(precios, familia) },
      vertical: true,
      precios,
      stickerKeys: stickersDe(familia),
    });
  };
  for (let i = 0; i < n; i++) {
    const tema = temas[i % temas.length];
    const cuantos = 4 + Math.floor(Math.random() * 2); // 4–5
    const precios = pickDesdeInventario(inv, tema.categoria, cuantos, tema.grupo);
    if (!precios.length) continue;
    pushComp(tema, precios, i, '');
  }
  let guard = 0;
  while (out.length < n && guard++ < n * 3) {
    const tema = rand(temas);
    const precios = pickDesdeInventario(inv, tema.categoria, 5, tema.grupo);
    if (!precios.length) break;
    pushComp(tema, precios, guard, 'x');
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
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(ln, x + 1.5, yy + 1.5);
    ctx.fillStyle = fill;
    ctx.fillText(ln, x, yy);
  });
  return lines.length * lh;
}

/**
 * WhatsApp: recolorea icon-wa-pedido.png (forma correcta) de naranja→verde.
 * Fondo negro→transparente. Queda el logo reconocible (globo + auricular).
 */
function drawWhatsAppIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  img: HTMLImageElement | null
): void {
  if (img && (img.naturalWidth || img.width) > 0) {
    const painted = recolorWaOrangeToGreen(img, size);
    if (painted) {
      ctx.drawImage(painted, cx - painted.width / 2, cy - painted.height / 2);
      return;
    }
  }
  drawWhatsAppFlat(ctx, cx, cy, size);
}

/** Naranja del PNG → verde WA; negro → transparente; blanco se queda. */
function recolorWaOrangeToGreen(img: HTMLImageElement, size: number): HTMLCanvasElement | null {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return null;
  const src = document.createElement('canvas');
  src.width = iw;
  src.height = ih;
  const sctx = src.getContext('2d', { willReadFrequently: true });
  if (!sctx) return null;
  sctx.drawImage(img, 0, 0);
  const pix = sctx.getImageData(0, 0, iw, ih);
  const d = pix.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const a = d[i + 3];
    if (a < 20 || (r < 40 && g < 40 && b < 40)) {
      d[i + 3] = 0;
      continue;
    }
    // Naranja / ámbar del asset → verde oficial
    if (r > 140 && g > 40 && g < 210 && b < 140 && r > b) {
      d[i] = 37;
      d[i + 1] = 211;
      d[i + 2] = 102;
      d[i + 3] = 255;
    }
  }
  sctx.putImageData(pix, 0, 0);
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const o = out.getContext('2d');
  if (!o) return null;
  const sc = Math.min(size / iw, size / ih);
  const dw = Math.round(iw * sc);
  const dh = Math.round(ih * sc);
  o.drawImage(src, (size - dw) / 2, (size - dh) / 2, dw, dh);
  return out;
}

function drawWhatsAppFlat(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number
): void {
  const r = size * 0.46;
  ctx.save();
  ctx.fillStyle = '#25D366';
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.02, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.4, cy + r * 0.45);
  ctx.quadraticCurveTo(cx - r * 0.95, cy + r * 1.05, cx - r * 0.15, cy + r * 0.82);
  ctx.quadraticCurveTo(cx - r * 0.55, cy + r * 0.6, cx - r * 0.4, cy + r * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.translate(cx - size * 0.01, cy - size * 0.03);
  ctx.rotate(-0.7);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  const pad = (x: number, y: number, w: number, h: number) => {
    const rr = Math.min(w, h) * 0.48;
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    ctx.fill();
  };
  const pw = r * 0.28;
  const ph = r * 0.46;
  pad(-r * 0.58, r * 0.08, pw, ph);
  pad(r * 0.3, -r * 0.54, pw, ph);
  ctx.lineWidth = r * 0.24;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.44, 0.45, Math.PI - 0.45);
  ctx.stroke();
  ctx.restore();
}

/** Pin ubicación (rojo + casita); usa PNG de Ropa si está disponible. */
function drawIconImg(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number,
  cy: number,
  size: number,
  fallback: (c: CanvasRenderingContext2D, x: number, y: number, s: number) => void
): void {
  if (img && (img.naturalWidth || img.width) > 0) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const sc = Math.min(size / iw, size / ih);
    const dw = Math.max(1, Math.round(iw * sc));
    const dh = Math.max(1, Math.round(ih * sc));
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
    return;
  }
  fallback(ctx, cx, cy, size);
}

/** Fallback: pin rojo + casita blanca (Ropa 1 / 2). */
function drawLocationPinFallback(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  const s = size;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.42, s * 0.28, s * 0.09, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#E53935';
  ctx.fill();
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = Math.max(2, s * 0.035);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.12, s * 0.36, Math.PI * 0.82, Math.PI * 2.18);
  ctx.lineTo(cx, cy + s * 0.42);
  ctx.closePath();
  ctx.fillStyle = '#E53935';
  ctx.fill();
  ctx.strokeStyle = '#1a1a1a';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.22, cy + s * 0.18);
  ctx.quadraticCurveTo(cx, cy + s * 0.38, cx + s * 0.22, cy + s * 0.18);
  ctx.strokeStyle = '#4DD0E1';
  ctx.lineWidth = Math.max(3, s * 0.05);
  ctx.stroke();
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
  ctx.fillRect(hx - hw * 0.55, hy - hw * 1.05, hw * 0.22, hw * 0.35);
  ctx.restore();
}

/**
 * Formato Ropa / Trastes: 1080×1350 (4:5).
 * Título → espacio → slogan → espacio → productos (siempre dentro) → pie WA + pin.
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
  const margin = 48;

  ctx.fillStyle = tema.fondo;
  ctx.fillRect(0, 0, W, H);
  // Sin destellos: tapaban título / slogan / nombres

  const logoW = 250;
  drawLogoTopRight(ctx, logo, W, margin, logoW);

  // Título
  const headLines = tema.headline.split('\n');
  const titleMaxW = W - margin * 2 - logoW * 0.45;
  ctx.save();
  ctx.font = `900 68px "Segoe UI", "Arial Black", Impact, sans-serif`;
  const tooWide = headLines.some((ln) => ctx.measureText(ln).width > titleMaxW);
  ctx.restore();
  const size = tooWide ? 54 : 66;
  let y = margin + size + 4;
  drawHeadlineShadowed(ctx, headLines, margin, y, size, 'left', tema.acentoTitulo);
  y += headLines.length * (size + 12);

  // Aire claro título → slogan
  y += 110;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const sloganSize = 30;
  ctx.font = `800 ${sloganSize}px "Segoe UI", "Arial Black", sans-serif`;
  ctx.fillStyle = tema.acentoSlogan;
  const sloganRows = wrapLines(ctx, `"${tema.slogan}"`, W - margin * 2 - 24);
  for (const row of sloganRows) {
    ctx.fillText(row, W / 2, y);
    y += sloganSize + 10;
  }

  // Aire slogan → productos
  y += 78;

  // Stickers a la derecha; se dibujan ANTES del texto para que no lo tapen
  const stickerImgs = comp.stickerKeys
    .map((k) => stickers[k])
    .filter((x): x is HTMLImageElement => !!x);
  const midY = Math.min(H * 0.66, y + 260);
  ctx.save();
  // Recorte: stickers solo en la mitad derecha
  ctx.beginPath();
  ctx.rect(W * 0.52, H * 0.2, W * 0.48, H * 0.55);
  ctx.clip();
  if (stickerImgs[0]) drawSticker(ctx, stickerImgs[0], W * 0.9, midY, 200, 6);
  if (stickerImgs[1]) drawSticker(ctx, stickerImgs[1], W * 0.92, midY + 200, 120, -8);
  ctx.restore();

  // Lista a la izquierda: nunca invade el área del sticker ni sale del canvas
  const listX = margin + 12;
  const listMaxW = W * 0.5;
  const footReserve = 250;
  const listBottom = H - footReserve;
  const productNames = precios.map((p) => p.nombre.trim().toUpperCase());
  let nameSize = 36;
  let lineH = 44;
  let gap = 12;
  const bulletGap = 16;

  const measureBlock = (fontPx: number, lh: number, g: number, textW: number) => {
    ctx.font = `800 ${fontPx}px "Segoe UI", "Arial Black", sans-serif`;
    let h = 0;
    const blocks: string[][] = [];
    for (const full of productNames) {
      const rows = wrapLines(ctx, full, textW);
      blocks.push(rows);
      h += rows.length * lh + g;
    }
    return { h, blocks };
  };

  const bulletR = () => Math.max(6, Math.round(nameSize * 0.2));
  let textColX = listX + bulletR() * 2 + bulletGap;
  let textW = Math.max(120, listMaxW - (textColX - listX));
  let layoutNames = measureBlock(nameSize, lineH, gap, textW);
  while (y + layoutNames.h > listBottom && nameSize > 24) {
    nameSize -= 2;
    lineH = Math.round(nameSize * 1.22);
    gap = Math.max(8, gap - 1);
    textColX = listX + bulletR() * 2 + bulletGap;
    textW = Math.max(120, listMaxW - (textColX - listX));
    layoutNames = measureBlock(nameSize, lineH, gap, textW);
  }
  while (layoutNames.blocks.length > 2 && y + layoutNames.h > listBottom) {
    productNames.pop();
    layoutNames = measureBlock(nameSize, lineH, gap, textW);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${nameSize}px "Segoe UI", "Arial Black", sans-serif`;
  const br = bulletR();
  textColX = listX + br * 2 + bulletGap;
  for (const rows of layoutNames.blocks) {
    const firstY = y;
    ctx.beginPath();
    ctx.arc(listX + br, firstY - nameSize * 0.32, br, 0, Math.PI * 2);
    ctx.fillStyle = Brand.lime;
    ctx.fill();
    ctx.strokeStyle = Brand.limeDeep;
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let i = 0; i < rows.length; i++) {
      ctx.fillStyle = Brand.navy;
      ctx.fillText(rows[i], textColX, y);
      y += lineH;
    }
    y += gap;
  }

  // Pie: WhatsApp oficial + pin
  const footY = H - 145;
  const iconSize = 96;
  const footGap = 14;
  const leftIconX = margin + iconSize / 2;
  const rightIconX = W - margin - iconSize / 2;
  drawWhatsAppIcon(ctx, leftIconX, footY - 4, iconSize, icons.wa);
  drawIconImg(ctx, icons.pin, rightIconX, footY - 4, iconSize, drawLocationPinFallback);

  ctx.textBaseline = 'middle';
  const footFont = (px: number, color: string) => {
    ctx.font = `800 ${px}px "Segoe UI", "Arial Black", sans-serif`;
    ctx.fillStyle = color;
  };
  const leftTextX = margin + iconSize + footGap;
  footFont(26, Brand.tealDeep);
  ctx.textAlign = 'left';
  ctx.fillText('Haz tu pedido:', leftTextX, footY - 28);
  footFont(34, Brand.navy);
  ctx.fillText(TEL, leftTextX, footY + 12);

  const rightTextX = W - margin - iconSize - footGap;
  footFont(26, Brand.tealDeep);
  ctx.textAlign = 'right';
  ctx.fillText('Estamos cerca de ti:', rightTextX, footY - 28);
  footFont(28, Brand.navy);
  ctx.fillText(DIR, rightTextX, footY + 12);

  ctx.textAlign = 'center';
  footFont(26, Brand.teal);
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
    loadImage(`/publicidad/${name}?v=38`).then((i) => i || loadImage(`/api/publicidad/media/${name}?v=38`));

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

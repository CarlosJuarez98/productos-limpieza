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

/** Motivo visual ligado al producto (PNG o dibujo canvas). */
type StickerMotivo =
  | StickerKey
  | 'guantes'
  | 'fibra'
  | 'escoba'
  | 'trapeador'
  | 'jalador'
  | 'recogedor'
  | 'cubeta'
  | 'cepillo'
  | 'esponja'
  | 'suavizante'
  | 'cloro'
  | 'aroma'
  | 'manos';

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
  stickerMotivos: StickerMotivo[];
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
    headline: 'PRODUCTOS DE LIMPIEZA\nA GRANEL',
    slogan: '¡TODO PARA DEJAR TU CASA IMPECABLE!',
    fondo: Brand.sky,
    acentoTitulo: Brand.navy,
    acentoSlogan: Brand.teal,
  },
  {
    titulo: 'Equípate hoy',
    categoria: 'JARCERIA',
    grupo: 'jarceria',
    headline: 'PRODUCTOS DE LIMPIEZA\nA GRANEL',
    slogan: '¡DE LA ESCOBA AL TRAPEADOR, LO TENEMOS!',
    fondo: Brand.mint,
    acentoTitulo: Brand.tealDeep,
    acentoSlogan: Brand.navy,
  },
  {
    titulo: 'Kit de limpieza',
    categoria: 'JARCERIA',
    grupo: 'jarceria',
    headline: 'PRODUCTOS DE LIMPIEZA\nA GRANEL',
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

/** Motivo visual según el nombre del producto (guantes → guantes, fibra → fibra…). */
function motivoDeProducto(nombre: string): StickerMotivo {
  const n = nombre || '';
  if (/guante/i.test(n)) return 'guantes';
  if (/fibra/i.test(n)) return 'fibra';
  if (/escoba/i.test(n)) return 'escoba';
  if (/trape|mechudo/i.test(n)) return 'trapeador';
  if (/jalador/i.test(n)) return 'jalador';
  if (/recogedor/i.test(n)) return 'recogedor';
  if (/cubeta/i.test(n)) return 'cubeta';
  if (/cepillo/i.test(n)) return 'cepillo';
  if (/esponja|fibr[ao]\s*verde|scotch/i.test(n)) return 'esponja';
  if (/downy|suavitel|suaviz/i.test(n)) return 'suavizante';
  if (/jab[oó]n\s*manos|crema\s*manos/i.test(n)) return 'manos';
  if (/axion|brazo|braso|desengr|teflon|vidrios/i.test(n)) return 'trastes';
  if (/cloro|sosa|hipoclor|sarro|pastilla\s*de\s*cloro/i.test(n)) return 'cloro';
  if (/aromatiz|fabuloso|^pino$|pinol|creolina|almorol/i.test(n)) return 'aroma';
  if (/jab[oó]n|ariel|persil|zote|vanish|carisma|detercon|mas\s*color|\broma\b|deterg/i.test(n))
    return 'detergente';
  if (/trapo|pa[nñ]o/i.test(n)) return 'jarceria';
  return 'burbujas';
}

/** Pool limpieza: formas bien distintas (no 5 botellas iguales). */
const MOTIVOS_LIMPIEZA: StickerMotivo[] = [
  'detergente',
  'suavizante',
  'cloro',
  'aroma',
  'manos',
  'trastes',
  'esponja',
  'burbujas',
  'guantes',
  'cubeta',
];

/** Pool jarcería: utensilios distintos. */
const MOTIVOS_JARCERIA: StickerMotivo[] = [
  'escoba',
  'trapeador',
  'guantes',
  'fibra',
  'cubeta',
  'cepillo',
  'jalador',
  'recogedor',
  'esponja',
];

function fillersDeFamilia(grupo: GrupoTema): StickerMotivo[] {
  switch (grupo) {
    case 'lavado':
      return ['detergente', 'esponja', 'burbujas', 'suavizante', 'cloro', 'guantes', 'cubeta'];
    case 'suavizante':
      return ['suavizante', 'detergente', 'burbujas', 'esponja', 'manos', 'guantes'];
    case 'manos':
      return ['manos', 'esponja', 'burbujas', 'trastes', 'guantes', 'detergente'];
    case 'aroma':
      return ['aroma', 'cloro', 'burbujas', 'detergente', 'manos', 'esponja'];
    case 'cocina':
      return ['trastes', 'esponja', 'guantes', 'cloro', 'fibra', 'cubeta', 'burbujas'];
    case 'jarceria':
      return [...MOTIVOS_JARCERIA];
    default:
      return shuffle([...MOTIVOS_LIMPIEZA]);
  }
}

/**
 * Hasta 5 motivos distintos y con forma diferente.
 * En limpieza no se rellena con utensilios de jarcería genéricos al revés:
 * se usa el pool de botellas/esponja/burbujas bien diferenciadas.
 */
function stickersDesdeLista(precios: PrecioItem[], familia: GrupoTema): StickerMotivo[] {
  const unique: StickerMotivo[] = [];
  const add = (m: StickerMotivo) => {
    if (unique.includes(m)) return;
    unique.push(m);
  };
  for (const p of precios) {
    add(motivoDeProducto(p.nombre));
    if (unique.length >= 5) break;
  }
  for (const m of fillersDeFamilia(familia)) {
    if (unique.length >= 5) break;
    add(m);
  }
  const pool = familia === 'jarceria' ? MOTIVOS_JARCERIA : MOTIVOS_LIMPIEZA;
  for (const m of shuffle([...pool])) {
    if (unique.length >= 5) break;
    add(m);
  }
  return shuffle(unique.slice(0, 5));
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

/**
 * Un sticker = un motivo. No usa PNGs compuestos (jarcería/detergente/trastes
 * traen varios utensilios y se veían como stickers repetidos).
 */
function drawMotivoSticker(
  ctx: CanvasRenderingContext2D,
  motivo: StickerMotivo,
  cx: number,
  cy: number,
  size: number,
  rotDeg: number,
  pngs: Record<StickerKey, HTMLImageElement | null>
): void {
  if (motivo === 'burbujas' && pngs.burbujas) {
    drawSticker(ctx, pngs.burbujas, cx, cy, size, rotDeg);
    return;
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  drawCanvasMotivo(ctx, motivo, size);
  ctx.restore();
}

/** Iconos simples y coloridos por tipo de producto (centrados en 0,0). */
function drawCanvasMotivo(ctx: CanvasRenderingContext2D, motivo: StickerMotivo, size: number): void {
  const s = size;
  ctx.save();
  switch (motivo) {
    case 'guantes': {
      // Un solo guante (antes el par parecía sticker repetido)
      ctx.fillStyle = '#F5D76E';
      ctx.strokeStyle = '#C9A227';
      ctx.lineWidth = s * 0.04;
      ctx.beginPath();
      ctx.ellipse(0, s * 0.06, s * 0.18, s * 0.3, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const fx = -s * 0.12 + i * s * 0.08;
        ctx.beginPath();
        ctx.ellipse(fx, -s * 0.24, s * 0.038, s * 0.13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case 'fibra': {
      // Fibra verde típica
      const w = s * 0.55;
      const h = s * 0.38;
      ctx.fillStyle = '#2E8B57';
      ctx.strokeStyle = '#1B5E3A';
      ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 8, -h / 2);
      ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, 8);
      ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, 8);
      ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, 8);
      ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const yy = -h / 2 + 6 + i * (h / 6);
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 4, yy);
        ctx.lineTo(w / 2 - 4, yy);
        ctx.stroke();
      }
      ctx.fillStyle = '#FF6B4A';
      ctx.fillRect(-w / 2, h / 2 - h * 0.22, w, h * 0.22);
      break;
    }
    case 'escoba': {
      ctx.fillStyle = '#C4A574';
      ctx.fillRect(-s * 0.04, -s * 0.4, s * 0.08, s * 0.55);
      ctx.fillStyle = '#E85D04';
      ctx.beginPath();
      ctx.moveTo(-s * 0.28, s * 0.12);
      ctx.lineTo(s * 0.28, s * 0.12);
      ctx.lineTo(s * 0.22, s * 0.4);
      ctx.lineTo(-s * 0.22, s * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#9A3B02';
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case 'trapeador': {
      ctx.fillStyle = '#8B6914';
      ctx.fillRect(-s * 0.035, -s * 0.42, s * 0.07, s * 0.5);
      ctx.fillStyle = '#5B8DEF';
      for (let i = 0; i < 7; i++) {
        const a = -0.7 + i * 0.22;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.05);
        ctx.quadraticCurveTo(Math.sin(a) * s * 0.25, s * 0.25, Math.sin(a) * s * 0.35, s * 0.42);
        ctx.lineWidth = s * 0.045;
        ctx.strokeStyle = i % 2 ? '#4A7AD4' : '#7BA3F0';
        ctx.stroke();
      }
      break;
    }
    case 'jalador': {
      ctx.fillStyle = '#555';
      ctx.fillRect(-s * 0.03, -s * 0.35, s * 0.06, s * 0.45);
      ctx.fillStyle = '#2EC4B6';
      ctx.fillRect(-s * 0.32, s * 0.08, s * 0.64, s * 0.12);
      ctx.fillStyle = '#1A8A80';
      ctx.fillRect(-s * 0.32, s * 0.18, s * 0.64, s * 0.06);
      break;
    }
    case 'recogedor': {
      ctx.fillStyle = '#E63946';
      ctx.beginPath();
      ctx.moveTo(-s * 0.28, s * 0.05);
      ctx.lineTo(s * 0.28, s * 0.05);
      ctx.lineTo(s * 0.2, s * 0.35);
      ctx.lineTo(-s * 0.2, s * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#C4A574';
      ctx.fillRect(s * 0.08, -s * 0.35, s * 0.07, s * 0.42);
      break;
    }
    case 'cubeta': {
      ctx.fillStyle = '#457B9D';
      ctx.beginPath();
      ctx.moveTo(-s * 0.22, -s * 0.1);
      ctx.lineTo(s * 0.22, -s * 0.1);
      ctx.lineTo(s * 0.18, s * 0.32);
      ctx.lineTo(-s * 0.18, s * 0.32);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#1D3557';
      ctx.lineWidth = s * 0.04;
      ctx.beginPath();
      ctx.arc(0, -s * 0.1, s * 0.22, Math.PI, 0);
      ctx.stroke();
      break;
    }
    case 'cepillo': {
      ctx.fillStyle = '#F4A261';
      ctx.fillRect(-s * 0.08, -s * 0.35, s * 0.16, s * 0.4);
      ctx.fillStyle = '#E76F51';
      ctx.fillRect(-s * 0.22, s * 0.05, s * 0.44, s * 0.18);
      ctx.fillStyle = '#264653';
      for (let i = 0; i < 8; i++) {
        ctx.fillRect(-s * 0.2 + i * s * 0.055, s * 0.2, s * 0.03, s * 0.18);
      }
      break;
    }
    case 'esponja': {
      ctx.fillStyle = '#F4D35E';
      ctx.beginPath();
      ctx.moveTo(-s * 0.28 + 8, -s * 0.18);
      ctx.arcTo(s * 0.28, -s * 0.18, s * 0.28, s * 0.18, 8);
      ctx.arcTo(s * 0.28, s * 0.18, -s * 0.28, s * 0.18, 8);
      ctx.arcTo(-s * 0.28, s * 0.18, -s * 0.28, -s * 0.18, 8);
      ctx.arcTo(-s * 0.28, -s * 0.18, s * 0.28, -s * 0.18, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#E09F3E';
      ctx.fillRect(-s * 0.28, s * 0.02, s * 0.56, s * 0.16);
      break;
    }
    case 'suavizante': {
      // Botella redondeada + flor (no se confunde con detergente)
      ctx.fillStyle = '#9B5DE5';
      ctx.beginPath();
      ctx.ellipse(0, s * 0.08, s * 0.2, s * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F15BB5';
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.28, s * 0.1, s * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEE440';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * s * 0.12, -s * 0.02 + Math.sin(a) * s * 0.12, s * 0.04, s * 0.06, a, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'cloro': {
      // Galón cuadrado amarillo (silueta distinta)
      ctx.fillStyle = '#FFD60A';
      ctx.fillRect(-s * 0.2, -s * 0.12, s * 0.4, s * 0.42);
      ctx.fillStyle = '#003566';
      ctx.fillRect(-s * 0.14, -s * 0.32, s * 0.28, s * 0.22);
      ctx.fillStyle = '#001D3D';
      ctx.font = `900 ${Math.round(s * 0.16)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Cl', 0, s * 0.1);
      break;
    }
    case 'aroma': {
      // Atomizador / spray
      ctx.fillStyle = '#06D6A0';
      ctx.fillRect(-s * 0.12, -s * 0.05, s * 0.24, s * 0.4);
      ctx.fillStyle = '#118AB2';
      ctx.fillRect(-s * 0.08, -s * 0.28, s * 0.16, s * 0.24);
      ctx.fillStyle = '#073B4C';
      ctx.fillRect(s * 0.08, -s * 0.32, s * 0.18, s * 0.06);
      ctx.beginPath();
      ctx.moveTo(s * 0.26, -s * 0.29);
      ctx.lineTo(s * 0.38, -s * 0.35);
      ctx.lineTo(s * 0.38, -s * 0.23);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'manos': {
      // Dispensador con bomba (silueta rectangular)
      ctx.fillStyle = '#48CAE4';
      ctx.fillRect(-s * 0.16, -s * 0.02, s * 0.32, s * 0.38);
      ctx.fillStyle = '#0077B6';
      ctx.fillRect(-s * 0.06, -s * 0.26, s * 0.12, s * 0.24);
      ctx.fillStyle = '#023E8A';
      ctx.fillRect(-s * 0.1, -s * 0.34, s * 0.2, s * 0.08);
      ctx.beginPath();
      ctx.arc(s * 0.14, -s * 0.3, s * 0.055, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'detergente': {
      // Bidón con asa (perfil distinto a suavizante/cloro)
      ctx.fillStyle = '#3A86FF';
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, s * 0.35);
      ctx.lineTo(-s * 0.22, -s * 0.05);
      ctx.lineTo(-s * 0.08, -s * 0.3);
      ctx.lineTo(s * 0.12, -s * 0.3);
      ctx.lineTo(s * 0.22, -s * 0.05);
      ctx.lineTo(s * 0.2, s * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FF006E';
      ctx.fillRect(-s * 0.08, -s * 0.4, s * 0.18, s * 0.12);
      // asa
      ctx.strokeStyle = '#1B4F9C';
      ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      ctx.arc(-s * 0.22, s * 0.05, s * 0.1, -0.4, 1.2);
      ctx.stroke();
      break;
    }
    case 'trastes': {
      // Botella squeeze + plato
      ctx.fillStyle = '#2EC4B6';
      ctx.beginPath();
      ctx.ellipse(s * 0.08, s * 0.05, s * 0.14, s * 0.28, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FF9F1C';
      ctx.fillRect(s * 0.02, -s * 0.35, s * 0.12, s * 0.16);
      ctx.fillStyle = '#E8E8E8';
      ctx.beginPath();
      ctx.ellipse(-s * 0.18, s * 0.18, s * 0.16, s * 0.1, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#AAA';
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case 'jarceria': {
      ctx.fillStyle = '#E9C46A';
      ctx.beginPath();
      ctx.moveTo(-s * 0.3, -s * 0.05);
      ctx.lineTo(s * 0.25, -s * 0.15);
      ctx.lineTo(s * 0.3, s * 0.2);
      ctx.lineTo(-s * 0.25, s * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#B08900';
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case 'burbujas':
    default: {
      const cols = ['#90E0EF', '#48CAE4', '#00B4D8'];
      const pts: [number, number, number][] = [
        [0, 0, 0.16],
        [-0.14, -0.1, 0.09],
        [0.12, 0.08, 0.1],
      ];
      for (let i = 0; i < pts.length; i++) {
        const [bx, by, br] = pts[i];
        ctx.beginPath();
        ctx.fillStyle = cols[i % cols.length];
        ctx.arc(bx * s, by * s, s * br, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

/**
 * Slots solo en columna derecha, entre slogan y pie.
 * Nunca invaden lista de productos, título ni pie de contacto.
 */
function pickStickerSlots(
  W: number,
  H: number,
  count: number,
  safe: { xMin: number; xMax: number; yMin: number; yMax: number }
): { x: number; y: number; s: number; rot: number }[] {
  const maxS = Math.min(W * 0.13, (safe.xMax - safe.xMin) * 0.55, (safe.yMax - safe.yMin) * 0.28);
  const candidates = [
    { x: 0.82, y: 0.34, s: 0.11 },
    { x: 0.9, y: 0.42, s: 0.1 },
    { x: 0.78, y: 0.5, s: 0.1 },
    { x: 0.88, y: 0.56, s: 0.11 },
    { x: 0.8, y: 0.64, s: 0.1 },
    { x: 0.92, y: 0.68, s: 0.09 },
    { x: 0.85, y: 0.46, s: 0.1 },
    { x: 0.76, y: 0.58, s: 0.09 },
  ];
  const pad = maxS * 0.55;
  const valid = candidates.filter((c) => {
    const x = W * c.x;
    const y = H * c.y;
    return (
      x - pad >= safe.xMin &&
      x + pad <= safe.xMax &&
      y - pad >= safe.yMin &&
      y + pad <= safe.yMax
    );
  });
  const pool = valid.length >= count ? valid : candidates;
  const picked = shuffle(pool).slice(0, count);
  return picked.map((c) => {
    let x = W * c.x;
    let y = H * c.y;
    const s = Math.min(W * c.s, maxS);
    const half = s * 0.52;
    x = Math.min(safe.xMax - half, Math.max(safe.xMin + half, x));
    y = Math.min(safe.yMax - half, Math.max(safe.yMin + half, y));
    return { x, y, s, rot: (Math.random() - 0.5) * 22 };
  });
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
      stickerMotivos: stickersDesdeLista(precios, familia),
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
    '💳 Aceptamos pago con tarjeta o efectivo',
    `🕘 Horario de atención: 9:00 am – 8:00 pm`,
    `📍 ${DIR}`,
    `WA_ICON ${TEL}`,
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

/** Título fijo en todas las promos. */
const HEADLINE_FIJO = 'PRODUCTOS DE LIMPIEZA\nA GRANEL';

/** Colores del logo Amorcas (navy · teal · lima) para rotar letra a letra. */
const LOGO_LETTER_COLORS = [
  Brand.navy,
  Brand.teal,
  Brand.limeDeep,
  Brand.tealDeep,
  Brand.lime,
  Brand.navyDeep,
] as const;

/**
 * Título fijo con colorimetría del logo por palabra
 * (sombra lima + brillo blanco + un color por palabra).
 */
function drawHeadlineLogoColors(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  size: number
): number {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 ${size}px "Segoe UI", "Arial Black", Impact, sans-serif`;
  const lh = size + 12;
  const spaceW = ctx.measureText(' ').width;
  let wordIdx = 0;
  lines.forEach((ln, i) => {
    const yy = y + i * lh;
    let cx = x;
    const words = ln.split(/\s+/).filter(Boolean);
    words.forEach((word, wi) => {
      const fill = LOGO_LETTER_COLORS[wordIdx % LOGO_LETTER_COLORS.length];
      wordIdx++;
      ctx.fillStyle = Brand.limeSoft;
      ctx.fillText(word, cx + 3, yy + 3);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(word, cx + 1.5, yy + 1.5);
      ctx.fillStyle = fill;
      ctx.fillText(word, cx, yy);
      cx += ctx.measureText(word).width;
      if (wi < words.length - 1) cx += spaceW;
    });
  });
  return lines.length * lh;
}

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
 * WhatsApp fijo: PNG icon-wa-fijo.png. Si no carga, Path2D del glifo oficial (siempre igual).
 */
const WA_PATH_16 =
  'M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232';

function drawWhatsAppIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  img: HTMLImageElement | null
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
  // Respaldo idéntico al PNG (glifo Bootstrap WA), no se inventa ni varía
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 16, size / 16);
  ctx.fillStyle = '#25D366';
  ctx.fill(new Path2D(WA_PATH_16));
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

  drawFlyerBackground(ctx, W, H, tema);

  const logoW = 250;
  drawLogoTopRight(ctx, logo, W, margin, logoW);

  // Título fijo + letras con colorimetría del logo
  const headLines = HEADLINE_FIJO.split('\n');
  const titleMaxW = W - margin * 2 - logoW * 0.45;
  ctx.save();
  ctx.font = `900 68px "Segoe UI", "Arial Black", Impact, sans-serif`;
  const tooWide = headLines.some((ln) => ctx.measureText(ln).width > titleMaxW);
  ctx.restore();
  const size = tooWide ? 54 : 66;
  let y = margin + size + 4;
  drawHeadlineLogoColors(ctx, headLines, margin, y, size);
  y += headLines.length * (size + 12);

  // Aire claro título → slogan
  y += 110;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const sloganSize = 30;
  ctx.font = `800 ${sloganSize}px "Segoe UI", "Arial Black", sans-serif`;
  const sloganRows = wrapLines(ctx, `"${tema.slogan}"`, W - margin * 2 - 48);
  const sloganBlockH = sloganRows.length * (sloganSize + 10);
  drawSoftPanel(ctx, margin, y - sloganSize - 8, W - margin * 2, sloganBlockH + 28, 22);
  ctx.fillStyle = tema.acentoSlogan;
  for (const row of sloganRows) {
    ctx.fillText(row, W / 2, y);
    y += sloganSize + 10;
  }

  // Aire slogan → productos
  y += 78;
  const listTopY = y;

  // Lista a la izquierda (medir primero para zona segura de stickers)
  const listX = margin + 12;
  const listMaxW = W * 0.52;
  const footReserve = 270;
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

  // Stickers solo a la derecha del texto, debajo del slogan y arriba del pie
  const motivosUnicos = [...new Set(comp.stickerMotivos)].slice(0, 5);
  const safe = {
    xMin: margin + listMaxW + 28,
    xMax: W - margin - 8,
    yMin: listTopY - 20,
    yMax: H - footReserve - 12,
  };
  const slots = pickStickerSlots(W, H, motivosUnicos.length, safe);
  motivosUnicos.forEach((motivo, i) => {
    const L = slots[i];
    drawMotivoSticker(ctx, motivo, L.x, L.y, L.s, L.rot, stickers);
  });

  drawSoftPanel(ctx, margin - 4, listTopY - nameSize - 6, listMaxW + 36, layoutNames.h + 28, 20);

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

  // Pie: WhatsApp + pin + pagos / horario
  const footY = H - 158;
  const iconSize = 92;
  const footGap = 14;
  const leftIconX = margin + iconSize / 2;
  const rightIconX = W - margin - iconSize / 2;
  drawSoftPanel(ctx, margin - 8, footY - 62, W - margin * 2 + 16, 168, 24);
  drawWhatsAppIcon(ctx, leftIconX, footY - 8, iconSize, icons.wa);
  drawIconImg(ctx, icons.pin, rightIconX, footY - 8, iconSize, drawLocationPinFallback);

  ctx.textBaseline = 'middle';
  const footFont = (px: number, color: string) => {
    ctx.font = `800 ${px}px "Segoe UI", "Arial Black", sans-serif`;
    ctx.fillStyle = color;
  };
  const leftTextX = margin + iconSize + footGap;
  footFont(26, Brand.tealDeep);
  ctx.textAlign = 'left';
  ctx.fillText('Haz tu pedido:', leftTextX, footY - 32);
  footFont(34, Brand.navy);
  ctx.fillText(TEL, leftTextX, footY + 6);

  const rightTextX = W - margin - iconSize - footGap;
  footFont(26, Brand.tealDeep);
  ctx.textAlign = 'right';
  ctx.fillText('Estamos cerca de ti:', rightTextX, footY - 32);
  footFont(28, Brand.navy);
  ctx.fillText(DIR, rightTextX, footY + 6);

  ctx.textAlign = 'center';
  footFont(24, Brand.teal);
  ctx.fillText('Contamos con servicio a domicilio (dentro del fracc.)', W / 2, footY + 48);
  footFont(25, Brand.navy);
  ctx.fillText('💳 Aceptamos tarjeta o efectivo  ·  🕘 9:00 am – 8:00 pm', W / 2, footY + 82);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se generó la promo'))), 'image/png', 0.94);
  });
}

/** Fondo con degradado suave + formas solo a la derecha (no compiten con el texto). */
function drawFlyerBackground(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  tema: TemaFlyer
): void {
  ctx.fillStyle = tema.fondo;
  ctx.fillRect(0, 0, W, H);

  const grad = ctx.createLinearGradient(0, 0, W * 0.35, H);
  grad.addColorStop(0, 'rgba(255,255,255,0.72)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.22)');
  grad.addColorStop(1, hexAlpha(tema.acentoTitulo, 0.1));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.14;
  const blobs: [number, number, number, string][] = [
    [W * 0.82, H * 0.28, 160, tema.acentoTitulo],
    [W * 0.92, H * 0.55, 200, Brand.lime],
    [W * 0.78, H * 0.72, 140, Brand.teal],
  ];
  for (const [bx, by, br, color] of blobs) {
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const bot = ctx.createLinearGradient(0, H * 0.72, 0, H);
  bot.addColorStop(0, 'rgba(255,255,255,0)');
  bot.addColorStop(1, 'rgba(255,255,255,0.35)');
  ctx.fillStyle = bot;
  ctx.fillRect(0, H * 0.72, W, H * 0.28);
}

function hexAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

/** Panel claro para que el texto se lea sobre el fondo. */
function drawSoftPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.save();
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(24,48,96,0.06)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
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
    loadImage(`/publicidad/${name}?v=44`).then((i) => i || loadImage(`/api/publicidad/media/${name}?v=44`));

  const [logo, detergente, trastes, jarceria, burbujas, iconWa, iconPin] = await Promise.all([
    media('amorcas-chingon.png').then(
      (i) => i || loadImage('/amorcas-logo.png').then((j) => j || media('amorcas-c.jpg'))
    ),
    media('deco-detergente.png'),
    media('deco-trastes-jabon.png'),
    media('deco-jarceria.png'),
    media('deco-burbujas.png'),
    media('icon-wa-fijo.png').then((i) => i || media('icon-wa-verde.png')),
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

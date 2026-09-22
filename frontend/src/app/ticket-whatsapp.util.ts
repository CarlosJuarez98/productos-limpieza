/** Cotización visual Amorcas para compartir por WhatsApp. */

export type TicketLinea = {
  nombre: string;
  detalle: string;
  total: number;
};

export type TicketDatos = {
  cliente?: string | null;
  /** Teléfono del cliente (opcional; no el de Amorcas). */
  telefonoCliente?: string | null;
  /** Fecha ISO yyyy-MM-dd preferida; si no, se parsea `fecha`. */
  fechaIso?: string | null;
  fecha: string;
  lineas: TicketLinea[];
  total: number;
  nota?: string | null;
};

/** Paleta Amorcas (logo: navy + teal + verde limón). */
const C = {
  ink: '#0A2F5C',
  mute: '#5A7385',
  paper: '#FFFEFA',
  soft: '#E8F5F8',
  line: '#D0E4EA',
  navy: '#0A2F5C',
  teal: '#1A9BB5',
  lime: '#7CB82E',
  limeSoft: '#C8E86A',
  sky: '#E8F7FA',
  mint: '#F2F9E8',
  wa: '#25D366',
};

function money(n: number): string {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const finish = () => resolve(img.width > 0 && img.height > 0 ? img : null);
      if (typeof img.decode === 'function') {
        img.decode().then(finish).catch(finish);
      } else {
        finish();
      }
    };
    img.onerror = () => resolve(null);
    img.src =
      src.startsWith('/') ||
      src.startsWith('http') ||
      src.startsWith('blob:') ||
      src.startsWith('data:')
        ? src
        : `/${src}`;
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

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

function drawSpark(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  ctx.fillStyle = color;
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

const MESES_LARGOS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const;

type FechaBonita = {
  diaNum: string;
  mesLargo: string;
  anio: string;
  weekday: string;
  labelCorta: string;
};

function fechaBonita(datos: TicketDatos): FechaBonita {
  let y = 0;
  let m = 0;
  let d = 0;
  const iso = (datos.fechaIso || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) {
    const [yy, mm, dd] = iso.split('-');
    y = Number(yy);
    m = Number(mm);
    d = Number(dd);
  } else {
    const dmY = datos.fecha.match(/^(\d{1,2})-([a-z]{3})-(\d{4})$/i);
    if (dmY) {
      d = Number(dmY[1]);
      m = MESES_CORTOS.indexOf(dmY[2].toLowerCase() as (typeof MESES_CORTOS)[number]) + 1;
      y = Number(dmY[3]);
    }
  }
  if (!y || !m || !d) {
    return {
      diaNum: '—',
      mesLargo: '',
      anio: '',
      weekday: '',
      labelCorta: datos.fecha || '—',
    };
  }
  const dt = new Date(y, m - 1, d);
  const weekday = DIAS_SEMANA[dt.getDay()] || '';
  const mesLargo = MESES_LARGOS[m - 1] || '';
  return {
    diaNum: String(d),
    mesLargo,
    anio: String(y),
    weekday,
    labelCorta: `${d} de ${mesLargo} de ${y}`,
  };
}

function drawImageContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** Llena el rectángulo recortando el sobrante (sin dejar cajas vacías). */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const sx = x + (w - dw) / 2;
  const sy = y + (h - dh) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, sx, sy, dw, dh);
  ctx.restore();
}

function drawRoundedImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  drawImageCover(ctx, img, x, y, w, h);
  ctx.restore();
}

function drawSticker(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number,
  cy: number,
  size: number,
  alpha = 1
): void {
  if (!img) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  drawImageContain(ctx, img, cx - size / 2, cy - size / 2, size, size);
  ctx.restore();
}

/** Patrón suave de burbujas para el fondo general del ticket. */
function drawBubblesWallpaper(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha = 0.3
): void {
  const cell = Math.max(90, Math.min(w, h) * 0.16);
  const cols = Math.ceil(w / cell) + 1;
  const rows = Math.ceil(h / cell) + 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = x + col * cell + (row % 2 === 0 ? cell * 0.2 : cell * 0.55);
      const cy = y + row * cell + cell * 0.5;
      const size = cell * (0.85 + ((row + col) % 3) * 0.1);
      drawImageContain(ctx, img, cx - size / 2, cy - size / 2, size, size);
    }
  }
  ctx.restore();
}

async function loadSticker(name: string): Promise<HTMLImageElement | null> {
  const q = '?v=ticket8';
  return loadImage(`/publicidad/${name}${q}`).then(
    (i) => i || loadImage(`/api/publicidad/media/${name}${q}`)
  );
}

export async function generarTicketPng(datos: TicketDatos): Promise<Blob> {
  const [logo, stripProductos, stripJarceria, stickerBubbles] = await Promise.all([
    loadImage('/publicidad/amorcas-chingon.png').then(
      (i) => i || loadImage('/amorcas-logo.png').then((j) => j || loadImage('/publicidad/amorcas-c.jpg'))
    ),
    loadSticker('ticket-productos-strip.png'),
    loadSticker('ticket-jarceria-strip.png'),
    loadSticker('deco-burbujas.png'),
  ]);

  const W = 1080;
  const margin = 36;
  const cardX = margin;
  const cardW = W - margin * 2;
  const pad = 40;
  const n = Math.max(datos.lineas.length, 1);
  const fb = fechaBonita(datos);
  const clienteNom = (datos.cliente || '').trim();
  const tieneCliente = !!clienteNom;

  // Logo: proporción fija del asset (1152×896) — nunca estirar
  const LOGO_AR = 1152 / 896;
  const logoBoxW = 520;
  const logoBoxH = Math.round(logoBoxW / LOGO_AR);
  const logoTop = 28;
  const headerBandH = 64;
  const stripH = 260;
  const stripGap = 16;
  const afterBrandGap = 28;
  const fechaH = 132;
  const clienteH = 108;
  const metaH = fechaH + 18 + clienteH;
  const itemH = 112;
  const itemsGap = 14;
  const itemsH = n * itemH + Math.max(0, n - 1) * itemsGap;
  const totalH = 150;
  const notaH = datos.nota ? 64 : 0;
  const contactH = 88;
  const brandH = logoTop + logoBoxH + stripGap + stripH + afterBrandGap;
  const cardH =
    brandH + metaH + 28 + itemsH + 36 + totalH + (notaH ? notaH + 16 : 0) + contactH + 48;
  const H = cardH + margin * 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  const bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
  bg.addColorStop(0, C.sky);
  bg.addColorStop(0.5, C.paper);
  bg.addColorStop(1, C.mint);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Burbujas en el fondo general (márgenes claros de la imagen)
  if (stickerBubbles) {
    drawBubblesWallpaper(ctx, stickerBubbles, 0, 0, W, H, 0.28);
  }

  drawSpark(ctx, 70, 90, 14, 'rgba(26,155,181,0.35)');
  drawSpark(ctx, W - 80, 160, 18, 'rgba(124,184,46,0.35)');
  drawSpark(ctx, W - 100, H - 120, 12, 'rgba(10,47,92,0.2)');

  const cardY = margin;
  ctx.save();
  ctx.shadowColor = 'rgba(10, 47, 92, 0.14)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 14;
  roundRect(ctx, cardX, cardY, cardW, cardH, 36);
  ctx.fillStyle = C.paper;
  ctx.fill();
  ctx.restore();

  // También un toque suave de burbujas en el papel blanco de la tarjeta
  if (stickerBubbles) {
    ctx.save();
    roundRect(ctx, cardX, cardY, cardW, cardH, 36);
    ctx.clip();
    drawBubblesWallpaper(ctx, stickerBubbles, cardX, cardY, cardW, cardH, 0.14);
    ctx.restore();
  }

  // Franja superior
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, headerBandH + 48, 36);
  ctx.clip();
  const topG = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
  topG.addColorStop(0, C.navy);
  topG.addColorStop(0.5, C.teal);
  topG.addColorStop(1, C.lime);
  ctx.fillStyle = topG;
  ctx.fillRect(cardX, cardY, cardW, headerBandH + 48);
  ctx.restore();

  // Logo (proporción correcta, centrado)
  const logoX = (W - logoBoxW) / 2;
  const logoY = cardY + logoTop;
  ctx.save();
  ctx.shadowColor = 'rgba(18, 38, 58, 0.14)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  roundRect(ctx, logoX - 10, logoY - 10, logoBoxW + 20, logoBoxH + 20, 24);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();

  if (logo) {
    // Contain estricto dentro del rect proporcional
    drawImageContain(ctx, logo, logoX, logoY, logoBoxW, logoBoxH);
  } else {
    ctx.fillStyle = C.navy;
    ctx.font = '900 48px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AMORCAS', W / 2, logoY + logoBoxH / 2 + 16);
  }

  // Fotos limpias (sin marco de stickers)
  const stripY = logoY + logoBoxH + stripGap;
  const listX = cardX + pad;
  const listW = cardW - pad * 2;
  const halfGap = 14;
  const halfW = (listW - halfGap) / 2;

  const drawPhotoPanel = (x: number, photo: HTMLImageElement | null) => {
    roundRect(ctx, x, stripY, halfW, stripH, 22);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    if (photo) {
      drawRoundedImageCover(ctx, photo, x, stripY, halfW, stripH, 22);
    }
    ctx.strokeStyle = 'rgba(11, 42, 74, 0.14)';
    ctx.lineWidth = 2;
    roundRect(ctx, x, stripY, halfW, stripH, 22);
    ctx.stroke();
  };

  drawPhotoPanel(listX, stripProductos);
  drawPhotoPanel(listX + halfW + halfGap, stripJarceria);

  let y = cardY + brandH;
  // listX/listW already set

  // —— Fecha ——
  const fechaBoxH = fechaH;
  roundRect(ctx, listX, y, listW, fechaBoxH, 24);
  const fechaGrad = ctx.createLinearGradient(listX, y, listX + listW, y + fechaBoxH);
  fechaGrad.addColorStop(0, C.navy);
  fechaGrad.addColorStop(1, '#0E4A6E');
  ctx.fillStyle = fechaGrad;
  ctx.fill();

  const dayBoxW = 150;
  roundRect(ctx, listX + 18, y + 16, dayBoxW, fechaBoxH - 32, 18);
  ctx.fillStyle = C.limeSoft;
  ctx.fill();
  ctx.fillStyle = C.navy;
  ctx.textAlign = 'center';
  ctx.font = '900 64px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(fb.diaNum, listX + 18 + dayBoxW / 2, y + fechaBoxH / 2 + 22);

  ctx.textAlign = 'left';
  const textLeft = listX + 18 + dayBoxW + 28;
  ctx.fillStyle = C.limeSoft;
  ctx.font = '800 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillText((fb.weekday || 'pedido').toUpperCase(), textLeft, y + 48);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 40px "Segoe UI", system-ui, sans-serif';
  const mesAnio = fb.mesLargo
    ? `${fb.mesLargo.charAt(0).toUpperCase()}${fb.mesLargo.slice(1)} ${fb.anio}`
    : fb.labelCorta;
  ctx.fillText(truncate(ctx, mesAnio, listW - dayBoxW - 80), textLeft, y + 98);

  y += fechaBoxH + 18;

  // —— Cliente (sin círculo de iniciales) ——
  roundRect(ctx, listX, y, listW, clienteH, 24);
  ctx.fillStyle = C.soft;
  ctx.fill();
  ctx.strokeStyle = C.navy;
  ctx.lineWidth = 2.5;
  roundRect(ctx, listX, y, listW, clienteH, 24);
  ctx.stroke();

  const cTextX = listX + 28;
  ctx.textAlign = 'left';
  ctx.fillStyle = C.navy;
  ctx.font = '800 17px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('PEDIDO PARA', cTextX, y + 36);
  ctx.fillStyle = C.ink;
  ctx.font = '900 36px "Segoe UI", system-ui, sans-serif';
  const nombreShow = tieneCliente ? clienteNom : 'Cliente (sin nombre)';
  ctx.fillText(truncate(ctx, nombreShow, listW - 56), cTextX, y + 74);
  if (datos.telefonoCliente?.trim()) {
    ctx.fillStyle = C.navy;
    ctx.font = '700 18px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(truncate(ctx, datos.telefonoCliente.trim(), listW - 56), cTextX, y + 98);
  } else {
    ctx.fillStyle = C.navy;
    ctx.font = '700 17px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Entrega a domicilio · Amorcas', cTextX, y + 98);
  }

  y += clienteH + 28;

  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(listX + 20, y);
  ctx.lineTo(listX + listW - 20, y);
  ctx.stroke();
  y += 28;

  // Ítems
  datos.lineas.forEach((l, i) => {
    const rowY = y + i * (itemH + itemsGap);
    const accent = i % 2 === 0 ? C.teal : C.lime;
    const rowBg = i % 2 === 0 ? C.soft : C.mint;

    ctx.save();
    ctx.shadowColor = 'rgba(18, 38, 58, 0.06)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    roundRect(ctx, listX, rowY, listW, itemH, 22);
    ctx.fillStyle = rowBg;
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = accent;
    roundRect(ctx, listX, rowY, 12, itemH, 22);
    ctx.fill();
    ctx.fillRect(listX + 6, rowY, 10, itemH);

    ctx.beginPath();
    ctx.arc(listX + 50, rowY + itemH / 2, 24, 0, Math.PI * 2);
    ctx.fillStyle = C.navy;
    ctx.fill();
    ctx.fillStyle = C.limeSoft;
    ctx.font = '900 20px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), listX + 50, rowY + itemH / 2 + 7);

    const textX = listX + 90;
    const textMax = listW - 270;
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink;
    ctx.font = '900 28px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(truncate(ctx, l.nombre, textMax), textX, rowY + 44);
    ctx.fillStyle = C.navy;
    ctx.font = '800 20px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(truncate(ctx, l.detalle, textMax), textX, rowY + 78);

    ctx.textAlign = 'right';
    ctx.fillStyle = C.navy;
    ctx.font = '900 32px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`$${money(l.total)}`, listX + listW - 28, rowY + itemH / 2 + 11);
    ctx.textAlign = 'left';
  });

  y += itemsH + 36;

  roundRect(ctx, listX, y, listW, totalH, 26);
  ctx.fillStyle = C.navy;
  ctx.fill();
  ctx.fillStyle = C.limeSoft;
  roundRect(ctx, listX, y, 14, totalH, 26);
  ctx.fill();
  ctx.fillRect(listX + 7, y, 14, totalH);

  ctx.fillStyle = C.limeSoft;
  ctx.font = '800 18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('TOTAL A PAGAR', listX + 44, y + 46);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 56px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`$${money(datos.total)}`, listX + 44, y + 110);

  ctx.textAlign = 'right';
  ctx.fillStyle = C.limeSoft;
  ctx.font = '800 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`${n} producto${n === 1 ? '' : 's'}`, listX + listW - 36, y + 78);
  ctx.textAlign = 'left';

  y += totalH + 16;

  if (datos.nota) {
    roundRect(ctx, listX, y, listW, 52, 16);
    ctx.fillStyle = C.mint;
    ctx.fill();
    ctx.fillStyle = C.teal;
    ctx.font = '800 18px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(truncate(ctx, `Nota: ${datos.nota}`, listW - 36), listX + 20, y + 34);
    y += notaH;
  }

  roundRect(ctx, listX, y, listW, contactH - 8, 20);
  ctx.fillStyle = C.soft;
  ctx.fill();
  ctx.strokeStyle = C.navy;
  ctx.lineWidth = 2.5;
  roundRect(ctx, listX, y, listW, contactH - 8, 20);
  ctx.stroke();

  const pinCx = listX + 46;
  const pinCy = y + (contactH - 8) / 2 - 4;
  ctx.beginPath();
  ctx.arc(pinCx, pinCy - 6, 16, 0, Math.PI * 2);
  ctx.fillStyle = C.teal;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(pinCx - 12, pinCy);
  ctx.lineTo(pinCx + 12, pinCy);
  ctx.lineTo(pinCx, pinCy + 18);
  ctx.closePath();
  ctx.fillStyle = C.teal;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(pinCx, pinCy - 6, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.fillStyle = C.navy;
  ctx.font = '800 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('NOS ENCUENTRAS EN', listX + 88, y + 30);
  ctx.fillStyle = C.ink;
  ctx.font = '900 26px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Fracc. Los Álamos #121-C', listX + 88, y + 62);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No se generó la imagen'))),
      'image/png',
      0.96
    );
  });
}

/** Solo imagen (sin caption de total: WhatsApp lo mandaría aparte). */
export async function compartirTicketWhatsApp(datos: TicketDatos): Promise<'compartido' | 'descargado'> {
  const blob = await generarTicketPng(datos);
  const safePart = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'x';
  const safeFecha = safePart(datos.fechaIso || datos.fecha || 'fecha');
  const safeCliente = safePart((datos.cliente || '').trim() || 'cliente');
  const fileName = `pedido-domicilio-AMORCAS-${safeFecha}-${safeCliente}.png`;
  const file = new File([blob], fileName, { type: 'image/png' });
  return shareFile(file, 'Pedido Amorcas', '');
}

export type ResultadoSharePublicidad = {
  modo: 'compartido' | 'descargado';
  texto: string;
  /** true si ya se mandó el texto como 2ª imagen (automático). */
  automatico: boolean;
};

/**
 * Un solo toque: 1) foto del flyer, 2) imagen con el mensaje
 * (Buenos días / en servicio / precios). Así el orden queda correcto
 * y no hace falta un segundo botón — WhatsApp no permite texto suelto automático fiable.
 */
export async function compartirPublicidad(
  src: string,
  titulo: string,
  textoDespues?: string,
  blobPref?: Blob
): Promise<ResultadoSharePublicidad> {
  const texto = textoSharePublicidad(titulo, textoDespues);
  let blob = blobPref;
  if (!blob) {
    const url = src.startsWith('/') || src.startsWith('blob:') || src.startsWith('http') ? src : `/${src}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('No se pudo cargar la imagen');
    blob = await res.blob();
  }
  await copiarTextoSeguro(texto);

  const flyerFile = new File(
    [blob],
    `${titulo.replace(/\s+/g, '-').toLowerCase() || 'promo'}.png`,
    { type: blob.type || 'image/png' }
  );
  const textoBlob = await renderTextoComoImagen(texto);
  const textoFile = new File([textoBlob], 'amorcas-mensaje.png', { type: 'image/png' });

  const multi = await shareFiles([flyerFile, textoFile], titulo || 'Amorcas');
  if (multi === 'compartido') {
    return { modo: 'compartido', texto, automatico: true };
  }
  // Si el SO no acepta 2 archivos, manda solo la foto (texto queda en portapapeles + paso manual)
  const solo = await shareFile(flyerFile, titulo || 'Amorcas', '');
  return { modo: solo, texto, automatico: false };
}

/**
 * Paso manual de respaldo (si el celular no admite 2 imágenes a la vez).
 */
export async function enviarTextoWhatsApp(texto: string): Promise<'compartido' | 'abierto'> {
  const t = (texto || '').trim();
  if (!t) return 'abierto';
  await copiarTextoSeguro(t);

  try {
    const textoBlob = await renderTextoComoImagen(t);
    const textoFile = new File([textoBlob], 'amorcas-mensaje.png', { type: 'image/png' });
    const modo = await shareFile(textoFile, 'Amorcas', t);
    if (modo === 'compartido') return 'compartido';
  } catch {
    /* fallback abajo */
  }

  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };
  try {
    if (typeof nav.share === 'function') {
      const payload: ShareData = { title: 'Amorcas', text: t };
      if (!nav.canShare || nav.canShare(payload)) {
        await nav.share(payload);
        return 'compartido';
      }
    }
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return 'compartido';
    }
  }
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(t)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return 'abierto';
}

/** Tarjeta PNG con el mensaje (legible, paleta Amorcas). */
async function renderTextoComoImagen(texto: string): Promise<Blob> {
  const W = 1080;
  const padX = 56;
  const padY = 52;
  const maxW = W - padX * 2;
  const lineGap = 10;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  type Row = { text: string; size: number; bold: boolean; accent: boolean; mute: boolean };
  const rows: Row[] = [];
  const raw = texto.split('\n');
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    if (!line.trim()) {
      rows.push({ text: '', size: 18, bold: false, accent: false, mute: false });
      continue;
    }
    const esSaludo = i === 0 && /^Buen[oa]s |^¡Hola!/i.test(line);
    const esBullet = /^\s*[•*]/.test(line);
    const esMeta = /^[🕘📍💬📌]/.test(line) || /^Amorcas/i.test(line);
    const size = esSaludo ? 44 : esBullet ? 36 : esMeta ? 32 : 34;
    const bold = esSaludo || esBullet || /^Ya |^¡Ya |^En servicio|^¡Negocio|^Atendiendo|^Precios|^Mira /i.test(line);
    ctx.font = `${bold ? 800 : 600} ${size}px "Segoe UI", system-ui, sans-serif`;
    const wrapped = wrapCanvasLines(ctx, line, maxW);
    for (const w of wrapped) {
      rows.push({
        text: w,
        size,
        bold,
        accent: esSaludo,
        mute: esMeta && !esSaludo,
      });
    }
  }

  let contentH = 0;
  for (const r of rows) {
    contentH += r.text ? r.size + lineGap : 22;
  }
  const H = Math.max(720, padY * 2 + contentH + 40);
  canvas.width = W;
  canvas.height = H;

  // Fondo marca
  ctx.fillStyle = '#F7FBFC';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#28A0B8';
  ctx.fillRect(0, 0, 14, H);
  ctx.fillStyle = '#B0D040';
  ctx.fillRect(14, 0, 8, H);

  let y = padY + 8;
  for (const r of rows) {
    if (!r.text) {
      y += 22;
      continue;
    }
    ctx.font = `${r.bold ? 800 : 600} ${r.size}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    if (r.accent) ctx.fillStyle = '#28A0B8';
    else if (r.mute) ctx.fillStyle = '#5a7a88';
    else ctx.fillStyle = '#183060';
    ctx.fillText(r.text, padX + 12, y + r.size * 0.85);
    y += r.size + lineGap;
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se generó el mensaje'))), 'image/png', 0.92);
  });
}

/** Saludo + “ya estamos en servicio”; si hay texto de promo con precios, lo completa. */
function textoSharePublicidad(titulo: string, textoDespues?: string): string {
  const custom = (textoDespues || '').trim();
  const tit = (titulo || '').trim();
  if (!custom || custom === tit || custom.length < 48) {
    return textoPublicidadWhatsApp(titulo).trim();
  }
  const tieneSaludo = /^Buen[oa]s (días|tardes|noches)/i.test(custom) || /^¡Hola!/i.test(custom);
  const tieneServicio =
    /Ya estamos|¡Ya abrimos|En servicio|¡Negocio abierto|Atendiendo con gusto/i.test(custom);
  if (tieneSaludo && tieneServicio) {
    return custom;
  }
  if (tieneSaludo && !tieneServicio) {
    const lines = custom.split('\n');
    const saludoLine = lines[0];
    let i = 1;
    while (i < lines.length && !lines[i].trim()) i++;
    const frase = FRASES_SERVICIO[Math.floor(Math.random() * FRASES_SERVICIO.length)];
    return [saludoLine, '', ...frase.split('\n'), '', ...lines.slice(i)].join('\n');
  }
  return `${textoPublicidadWhatsApp(titulo).trim()}\n\n${custom}`;
}

async function copiarTextoSeguro(texto: string): Promise<boolean> {
  const t = (texto || '').trim();
  if (!t) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch {
    /* fallback abajo */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

type LineaPub = { text: string; bold?: boolean; mute?: boolean; accent?: boolean; size?: 'title' | 'body' };

function textoPublicidadLineas(_tituloPromo?: string): LineaPub[] {
  const frase = FRASES_SERVICIO[Math.floor(Math.random() * FRASES_SERVICIO.length)];
  const fraseParts = frase.split('\n');
  return [
    { text: saludoPublicidad(), bold: true, size: 'title', accent: true },
    { text: '' },
    ...fraseParts.map((t, i) => ({ text: t, bold: i === 0, size: 'body' as const })),
    { text: '' },
    { text: `🕘 Horario de atención: ${HORARIO_ATENCION}`, size: 'body' },
    { text: `📍 ${DIR_AMORCAS}`, size: 'body' },
    { text: `💬 WhatsApp ${TEL_AMORCAS}`, size: 'body' },
    { text: '' },
    { text: 'Amorcas · Soluciones de Limpieza', mute: true, size: 'body' },
  ];
}

function wrapCanvasLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
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

const HORARIO_ATENCION = '9:00 am – 8:00 pm';
const DIR_AMORCAS = 'Fracc. Los Álamos #121-C';
const TEL_AMORCAS = '247-120-6128';

const FRASES_SERVICIO = [
  'Ya estamos atendiendo.🫡\nVisítenos o haga su pedido 🏠.',
  '¡Ya abrimos! ✅🟢\nEstamos listos para servirles 🧼✨',
  'En servicio 🟢\nPase a visitarnos o pida a domicilio 🛵🏠',
  '¡Negocio abierto! 🚪✨\nLo esperamos o le llevamos su pedido 🏠.',
  'Atendiendo con gusto 🙌\nVisítenos o escríbanos por WhatsApp 💬',
];

function horaMexico(): number {
  try {
    const parts = new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === 'hour')?.value);
    return Number.isFinite(h) ? h : new Date().getHours();
  } catch {
    return new Date().getHours();
  }
}

function saludoPublicidad(): string {
  const h = horaMexico();
  if (h < 12) return 'Buenos días 🌻✨';
  if (h < 19) return 'Buenas tardes ☀️✨';
  return 'Buenas noches 🌙✨';
}

/** Texto de publicidad (copia / referencia). */
export function textoPublicidadWhatsApp(tituloPromo?: string): string {
  return textoPublicidadLineas(tituloPromo)
    .map((l) => l.text)
    .join('\n');
}

async function shareFiles(files: File[], title: string): Promise<'compartido' | 'descargado' | 'no-soportado'> {
  if (!files.length) return 'no-soportado';
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };
  if (typeof nav.share !== 'function') return 'no-soportado';
  try {
    const payload: ShareData = { files, title };
    if (nav.canShare && !nav.canShare(payload)) return 'no-soportado';
    await nav.share(payload);
    return 'compartido';
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return 'compartido';
    }
    return 'no-soportado';
  }
}

async function shareFile(
  file: File,
  title: string,
  text: string
): Promise<'compartido' | 'descargado'> {
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };

  if (typeof nav.share === 'function') {
    try {
      const conTexto: ShareData = { files: [file], title };
      if (text?.trim()) conTexto.text = text;
      if (!nav.canShare || nav.canShare(conTexto)) {
        await nav.share(conTexto);
        return 'compartido';
      }
      if (!nav.canShare || nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title });
        return 'compartido';
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return 'compartido';
      }
    }
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return 'descargado';
}

export type TicketVentaLinea = {
  nombre: string;
  cantidad: number;
  unidad?: string;
  total: number;
  sinCobro?: boolean;
};

export type TicketVentaDatos = {
  fecha: string;
  folio?: string;
  lineas: TicketVentaLinea[];
  total: number;
  pagoTarjeta?: boolean;
};

function dashLine(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function monoFit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

/** Recibo térmico estilo supermercado (nota de venta). */
export async function generarTicketVentaTermico(datos: TicketVentaDatos): Promise<Blob> {
  const logo = await loadImage('/publicidad/amorcas-chingon.png').then(
    (i) => i || loadImage('/amorcas-logo.png').then((j) => j || loadImage('/publicidad/amorcas-c.jpg'))
  );

  // Más ancho + leve estirado horizontal para que AMORCAS no se vea apretado
  const W = 680;
  const pad = 28;
  const n = Math.max(datos.lineas.length, 1);
  const rowH = 44;
  const LOGO_AR = 1152 / 896;
  const logoW = logo ? W - pad * 2 : 0;
  // Caja un poco más baja que el AR natural → drawImage separa letras en X
  const logoH = logo ? Math.round((logoW / LOGO_AR) * 0.82) : 0;
  const headerExtra = logo ? logoH + 18 : 0;
  const H = 260 + headerExtra + n * rowH + 140;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  ctx.fillStyle = '#f7f7f4';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.fillRect(10, 10, W - 20, H - 20);
  ctx.strokeStyle = '#ddd';
  ctx.strokeRect(10.5, 10.5, W - 21, H - 21);

  const cx = W / 2;
  let y = 28;

  if (logo) {
    const lx = (W - logoW) / 2;
    ctx.drawImage(logo, lx, y, logoW, logoH);
    y += logoH + 14;
  } else {
    y = 52;
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.font = '900 36px "Segoe UI", "Arial Black", sans-serif';
    try {
      (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0.12em';
    } catch {
      /* ignore */
    }
    ctx.fillText('AMORCAS', cx, y);
    try {
      (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';
    } catch {
      /* ignore */
    }
    y += 30;
  }

  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.font = '600 14px "Courier New", Courier, monospace';
  ctx.fillText(DIR_AMORCAS, cx, y);
  y += 20;
  ctx.fillText(`Horario: ${HORARIO_ATENCION}`, cx, y);
  y += 24;

  dashLine(ctx, pad, y, W - pad * 2);
  y += 28;

  const folio = datos.folio || `V-${Date.now().toString().slice(-8)}`;
  ctx.textAlign = 'left';
  ctx.font = '700 14px "Courier New", Courier, monospace';
  ctx.fillText(`FECHA: ${datos.fecha}`, pad, y);
  ctx.textAlign = 'right';
  ctx.fillText(`FOLIO: #${folio}`, W - pad, y);
  y += 22;
  ctx.textAlign = 'left';
  ctx.font = '600 13px "Courier New", Courier, monospace';
  ctx.fillText('NOTA DE VENTA / COMPROBANTE', pad, y);
  if (datos.pagoTarjeta) {
    ctx.textAlign = 'right';
    ctx.fillText('PAGO: TARJETA', W - pad, y);
  }
  y += 18;
  dashLine(ctx, pad, y, W - pad * 2);
  y += 26;

  ctx.textAlign = 'left';
  ctx.font = '700 12px "Courier New", Courier, monospace';
  ctx.fillText('CANTIDAD', pad, y);
  ctx.fillText('DESCRIPCION', pad + 110, y);
  ctx.textAlign = 'right';
  ctx.fillText('IMPORTE', W - pad, y);
  y += 10;
  dashLine(ctx, pad, y, W - pad * 2);
  y += 28;

  for (const l of datos.lineas) {
    const cant = Number(l.cantidad) || 0;
    const cantTxt = Number.isInteger(cant) ? String(cant) : String(Math.round(cant * 1000) / 1000);
    const uni = (l.unidad || '').trim();
    const left = uni ? `${cantTxt} ${uni}` : cantTxt;
    ctx.textAlign = 'left';
    ctx.font = '700 14px "Courier New", Courier, monospace';
    ctx.fillText(monoFit(ctx, left, 100), pad, y);
    ctx.fillText(monoFit(ctx, l.nombre, 250), pad + 110, y);
    ctx.textAlign = 'right';
    ctx.font = '800 15px "Courier New", Courier, monospace';
    ctx.fillText(l.sinCobro ? '0.00' : money(l.total), W - pad, y);
    y += rowH - 8;
  }

  dashLine(ctx, pad, y, W - pad * 2);
  y += 34;

  ctx.textAlign = 'left';
  ctx.font = '900 20px "Courier New", Courier, monospace';
  ctx.fillText('TOTAL', pad, y);
  ctx.textAlign = 'right';
  ctx.font = '900 26px "Courier New", Courier, monospace';
  ctx.fillText(`$${money(datos.total)}`, W - pad, y);
  y += 28;

  dashLine(ctx, pad, y, W - pad * 2);
  y += 30;

  ctx.textAlign = 'center';
  ctx.font = '800 15px "Courier New", Courier, monospace';
  ctx.fillText('¡GRACIAS POR SU COMPRA!', cx, y);
  y += 22;
  ctx.font = '600 12px "Courier New", Courier, monospace';
  ctx.fillText('Conserve este ticket como su nota de venta.', cx, y);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No se generó el ticket'))),
      'image/png',
      0.96
    );
  });
}

/** Mismo ticket térmico, empaquetado como PDF de una página. */
export async function generarTicketVentaPdf(datos: TicketVentaDatos): Promise<Blob> {
  const pngBlob = await generarTicketVentaTermico(datos);
  const pngUrl = URL.createObjectURL(pngBlob);
  try {
    const img = await loadImage(pngUrl);
    if (!img) throw new Error('No se pudo leer el ticket');
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const jpegBlob = await new Promise<Blob>((resolve, reject) => {
      const c = document.createElement('canvas');
      c.width = iw;
      c.height = ih;
      const cctx = c.getContext('2d');
      if (!cctx) {
        reject(new Error('Canvas no disponible'));
        return;
      }
      cctx.fillStyle = '#ffffff';
      cctx.fillRect(0, 0, iw, ih);
      cctx.drawImage(img, 0, 0);
      c.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('No se generó JPEG'))),
        'image/jpeg',
        0.93
      );
    });
    const jpeg = new Uint8Array(await jpegBlob.arrayBuffer());
    return jpegToSinglePagePdf(jpeg, iw, ih);
  } finally {
    URL.revokeObjectURL(pngUrl);
  }
}

/** PDF mínimo de 1 página con una imagen JPEG a página completa. */
function jpegToSinglePagePdf(jpeg: Uint8Array, imgW: number, imgH: number): Blob {
  const enc = new TextEncoder();
  const pageW = imgW;
  const pageH = imgH;

  const parts: Uint8Array[] = [];
  let pos = 0;
  const write = (data: string | Uint8Array) => {
    const b = typeof data === 'string' ? enc.encode(data) : data;
    parts.push(b);
    pos += b.length;
  };

  write('%PDF-1.4\n');

  const objOffsets: number[] = [0];

  const writeObj = (num: number, content: string) => {
    objOffsets[num] = pos;
    write(`${num} 0 obj\n`);
    write(content);
    write('\nendobj\n');
  };

  writeObj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  writeObj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  writeObj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>`
  );

  const contentStream = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = enc.encode(contentStream);
  writeObj(4, `<< /Length ${contentBytes.length} >>\nstream\n${contentStream}endstream`);

  objOffsets[5] = pos;
  write('5 0 obj\n');
  write(
    `<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
  );
  write(jpeg);
  write('\nendstream\nendobj\n');

  const xrefPos = pos;
  write('xref\n');
  write(`0 ${objOffsets.length}\n`);
  write('0000000000 65535 f \n');
  for (let i = 1; i < objOffsets.length; i++) {
    write(`${String(objOffsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  write(`trailer\n<< /Size ${objOffsets.length} /Root 1 0 R >>\n`);
  write(`startxref\n${xrefPos}\n%%EOF\n`);

  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return new Blob([out], { type: 'application/pdf' });
}

/** Comparte el ticket de venta como PDF (mismo formato visual del recibo). */
export async function compartirTicketVenta(
  datos: TicketVentaDatos
): Promise<'compartido' | 'descargado'> {
  const blob = await generarTicketVentaPdf(datos);
  const file = new File([blob], 'ticket-digital-AMORCAS.pdf', { type: 'application/pdf' });
  return shareFile(file, 'ticket-digital-AMORCAS', '');
}

if (typeof window !== 'undefined') {
  (window as unknown as { __amorcasGenerarTicket?: typeof generarTicketPng }).__amorcasGenerarTicket =
    generarTicketPng;
}

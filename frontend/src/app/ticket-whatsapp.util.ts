/** Cotización visual Amorcas para compartir por WhatsApp. */

export type TicketLinea = {
  nombre: string;
  detalle: string;
  total: number;
};

export type TicketDatos = {
  cliente?: string | null;
  fecha: string;
  lineas: TicketLinea[];
  total: number;
  nota?: string | null;
};

/** Paleta fresca (sin teal/verde bosque apagado). */
const C = {
  ink: '#12263A',
  mute: '#5B6B7C',
  paper: '#FFFEFA',
  soft: '#F3F8FF',
  line: '#E2EAF2',
  navy: '#0B2A4A',
  cyan: '#00B4D8',
  coral: '#FF6B4A',
  lime: '#C8F542',
  sky: '#E8F6FF',
  cream: '#FFF6EB',
  wa: '#25D366',
};

function money(n: number): string {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
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

export async function generarTicketPng(datos: TicketDatos): Promise<Blob> {
  const logo = await loadImage('/publicidad/amorcas-chingon.png').then(
    (i) => i || loadImage('/amorcas-logo.png').then((j) => j || loadImage('/publicidad/amorcas-c.jpg'))
  );

  const W = 1080;
  const margin = 36;
  const cardX = margin;
  const cardW = W - margin * 2;
  const pad = 40;
  const n = Math.max(datos.lineas.length, 1);

  // Espaciado generoso (nada encimado)
  const logoDiam = 240;
  const logoTop = 48;
  const afterLogoGap = 44;
  const metaH = datos.cliente ? 120 : 72;
  const itemH = 108;
  const itemsGap = 14;
  const itemsH = n * itemH + Math.max(0, n - 1) * itemsGap;
  const totalH = 150;
  const notaH = datos.nota ? 64 : 0;
  const contactH = 100;
  const brandH = logoTop + logoDiam + afterLogoGap;
  const cardH =
    brandH + metaH + 28 + itemsH + 36 + totalH + (notaH ? notaH + 16 : 0) + contactH + 48;
  const H = cardH + margin * 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  // Fondo aireado
  const bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
  bg.addColorStop(0, C.sky);
  bg.addColorStop(0.45, C.cream);
  bg.addColorStop(1, '#EEFBF6');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  drawSpark(ctx, 70, 90, 14, 'rgba(0,180,216,0.35)');
  drawSpark(ctx, W - 80, 160, 18, 'rgba(255,107,74,0.3)');
  drawSpark(ctx, W - 100, H - 120, 12, 'rgba(200,245,66,0.45)');

  // Card principal
  const cardY = margin;
  ctx.save();
  ctx.shadowColor = 'rgba(18, 38, 58, 0.16)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 14;
  roundRect(ctx, cardX, cardY, cardW, cardH, 36);
  ctx.fillStyle = C.paper;
  ctx.fill();
  ctx.restore();

  // Franja superior viva (cyan → coral), baja, sin tapar el logo
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, 120, 36);
  ctx.clip();
  const topG = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
  topG.addColorStop(0, C.navy);
  topG.addColorStop(0.55, C.cyan);
  topG.addColorStop(1, C.coral);
  ctx.fillStyle = topG;
  ctx.fillRect(cardX, cardY, cardW, 120);
  ctx.restore();

  // Logo grande centrado, con sombra (aire abajo)
  const logoCx = W / 2;
  const logoCy = cardY + logoTop + logoDiam / 2;
  if (logo) {
    ctx.save();
    ctx.shadowColor = 'rgba(18, 38, 58, 0.28)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(logo, logoCx - logoDiam / 2, logoCy - logoDiam / 2, logoDiam, logoDiam);
    ctx.restore();
  } else {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(logoCx, logoCy, logoDiam / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.navy;
    ctx.font = '900 36px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AMORCAS', logoCx, logoCy + 12);
  }

  let y = cardY + brandH;

  // Meta: fecha + cliente, con espacio
  ctx.textAlign = 'center';
  ctx.fillStyle = C.mute;
  ctx.font = '700 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(datos.fecha, W / 2, y);

  if (datos.cliente) {
    y += 44;
    // Pill del cliente
    const label = truncate(ctx, datos.cliente, cardW - pad * 2 - 80);
    ctx.font = '900 36px "Segoe UI", system-ui, sans-serif';
    const tw = Math.min(cardW - pad * 2, ctx.measureText(label).width + 64);
    const px = (W - tw) / 2;
    roundRect(ctx, px, y - 34, tw, 56, 28);
    ctx.fillStyle = C.soft;
    ctx.fill();
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 2.5;
    roundRect(ctx, px, y - 34, tw, 56, 28);
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.fillText(label, W / 2, y + 4);
    y += 58;
  } else {
    y += 36;
  }

  // Separador suave
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cardX + pad + 20, y);
  ctx.lineTo(cardX + cardW - pad - 20, y);
  ctx.stroke();
  y += 28;

  const listX = cardX + pad;
  const listW = cardW - pad * 2;

  // Ítems como cards sueltas (no filas pegadas)
  datos.lineas.forEach((l, i) => {
    const rowY = y + i * (itemH + itemsGap);

    ctx.save();
    ctx.shadowColor = 'rgba(18, 38, 58, 0.06)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    roundRect(ctx, listX, rowY, listW, itemH, 22);
    ctx.fillStyle = i % 2 === 0 ? C.soft : '#FFF9F4';
    ctx.fill();
    ctx.restore();

    // Acento lateral coral/cyan alternado
    ctx.fillStyle = i % 2 === 0 ? C.cyan : C.coral;
    roundRect(ctx, listX, rowY, 10, itemH, 22);
    ctx.fill();
    ctx.fillStyle = i % 2 === 0 ? C.cyan : C.coral;
    ctx.fillRect(listX + 5, rowY, 8, itemH);

    // Número
    ctx.beginPath();
    ctx.arc(listX + 48, rowY + itemH / 2, 22, 0, Math.PI * 2);
    ctx.fillStyle = C.navy;
    ctx.fill();
    ctx.fillStyle = C.lime;
    ctx.font = '900 18px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), listX + 48, rowY + itemH / 2 + 6);

    const textX = listX + 86;
    const textMax = listW - 260;
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink;
    ctx.font = '800 26px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(truncate(ctx, l.nombre, textMax), textX, rowY + 42);
    ctx.fillStyle = C.mute;
    ctx.font = '600 18px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(truncate(ctx, l.detalle, textMax), textX, rowY + 72);

    ctx.textAlign = 'right';
    ctx.fillStyle = C.navy;
    ctx.font = '900 30px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`$${money(l.total)}`, listX + listW - 28, rowY + itemH / 2 + 10);
    ctx.textAlign = 'left';
  });

  y += itemsH + 36;

  // Total llamativo: navy + franja lima
  roundRect(ctx, listX, y, listW, totalH, 26);
  ctx.fillStyle = C.navy;
  ctx.fill();
  ctx.fillStyle = C.lime;
  roundRect(ctx, listX, y, 14, totalH, 26);
  ctx.fill();
  ctx.fillRect(listX + 7, y, 14, totalH);

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '800 18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('TOTAL A PAGAR', listX + 44, y + 46);
  ctx.fillStyle = '#fff';
  ctx.font = '900 56px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`$${money(datos.total)}`, listX + 44, y + 110);

  ctx.textAlign = 'right';
  ctx.fillStyle = C.lime;
  ctx.font = '800 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`${n} producto${n === 1 ? '' : 's'}`, listX + listW - 36, y + 78);
  ctx.textAlign = 'left';

  y += totalH + 16;

  if (datos.nota) {
    roundRect(ctx, listX, y, listW, 52, 16);
    ctx.fillStyle = C.cream;
    ctx.fill();
    ctx.fillStyle = C.coral;
    ctx.font = '700 18px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(truncate(ctx, `Nota: ${datos.nota}`, listW - 36), listX + 20, y + 34);
    y += notaH;
  }

  // Contacto
  roundRect(ctx, listX, y, listW, contactH - 12, 20);
  ctx.fillStyle = '#F0FFF6';
  ctx.fill();
  ctx.strokeStyle = C.wa;
  ctx.lineWidth = 3;
  roundRect(ctx, listX, y, listW, contactH - 12, 20);
  ctx.stroke();

  roundRect(ctx, listX + 22, y + 20, 48, 48, 24);
  ctx.fillStyle = C.wa;
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '900 24px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('W', listX + 46, y + 52);

  ctx.textAlign = 'left';
  ctx.fillStyle = C.navy;
  ctx.font = '900 28px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('247-120-6128', listX + 88, y + 42);
  ctx.fillStyle = C.mute;
  ctx.font = '600 17px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Fracc. Los Álamos #121-C', listX + 88, y + 72);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No se generó la imagen'))),
      'image/png',
      0.96
    );
  });
}

/** Solo imagen + menú Compartir (elige el chat de WhatsApp tú). Sin pedirte el número. */
export async function compartirTicketWhatsApp(datos: TicketDatos): Promise<'compartido' | 'descargado'> {
  const blob = await generarTicketPng(datos);
  const safeFecha = datos.fecha.replace(/[^\d\-]/g, '_') || 'pedido';
  const file = new File([blob], `pedido-amorcas-${safeFecha}.png`, { type: 'image/png' });

  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };

  if (typeof nav.share === 'function') {
    try {
      if (!nav.canShare || nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: 'Pedido Amorcas',
          text: `Total $${money(datos.total)} — Amorcas`,
        });
        return 'compartido';
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return 'compartido';
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return 'descargado';
}

/** Comparte publicidad: texto dibujado en la imagen (WhatsApp no junta caption + foto). */
export async function compartirPublicidad(
  src: string,
  titulo: string,
  _textoOmitido?: string,
  blobPref?: Blob
): Promise<'compartido' | 'descargado'> {
  let blob = blobPref;
  if (!blob) {
    const url = src.startsWith('/') || src.startsWith('blob:') || src.startsWith('http') ? src : `/${src}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('No se pudo cargar la imagen');
    blob = await res.blob();
  }
  const conTexto = await generarPublicidadConTexto(blob, titulo);
  const file = new File(
    [conTexto],
    `${titulo.replace(/\s+/g, '-').toLowerCase() || 'promo'}.png`,
    { type: 'image/png' }
  );
  // Sin `text`: si se manda aparte, WhatsApp lo envía como otro mensaje.
  return shareFile(file, titulo || 'Amorcas', '');
}

/** Promo + saludo/horario/contacto en un solo PNG. */
async function generarPublicidadConTexto(imgBlob: Blob, titulo: string): Promise<Blob> {
  const objectUrl = URL.createObjectURL(imgBlob);
  try {
    const img = await loadImage(objectUrl);
    if (!img) throw new Error('No se pudo leer la imagen');

    const lineas = textoPublicidadLineas(titulo);
    const W = Math.max(img.naturalWidth || img.width, 720);
    const scale = W / (img.naturalWidth || img.width);
    const imgH = Math.round((img.naturalHeight || img.height) * scale);
    const padX = Math.round(W * 0.055);
    const padY = Math.round(W * 0.045);
    const titleSize = Math.max(28, Math.round(W * 0.042));
    const bodySize = Math.max(24, Math.round(W * 0.034));
    const lineGap = Math.round(bodySize * 1.35);

    const canvas = document.createElement('canvas');
    canvas.width = W;
    const measureCtx = canvas.getContext('2d');
    if (!measureCtx) throw new Error('Canvas no disponible');

    let textH = padY;
    for (const L of lineas) {
      if (!L.text) {
        textH += Math.round(bodySize * 0.45);
        continue;
      }
      measureCtx.font = `${L.bold ? '700' : '500'} ${L.size === 'title' ? titleSize : bodySize}px "Segoe UI", system-ui, sans-serif`;
      const wrapped = wrapCanvasLines(measureCtx, L.text, W - padX * 2);
      textH += wrapped.length * lineGap + (L.size === 'title' ? Math.round(bodySize * 0.2) : 0);
    }
    textH += padY;

    canvas.height = imgH + textH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas no disponible');

    ctx.fillStyle = '#0B2A4A';
    ctx.fillRect(0, 0, W, canvas.height);
    ctx.drawImage(img, 0, 0, W, imgH);

    const bandY = imgH;
    const grad = ctx.createLinearGradient(0, bandY, 0, canvas.height);
    grad.addColorStop(0, '#0B2A4A');
    grad.addColorStop(1, '#061828');
    ctx.fillStyle = grad;
    ctx.fillRect(0, bandY, W, textH);

    ctx.fillStyle = '#FF6B4A';
    ctx.fillRect(0, bandY, W, Math.max(4, Math.round(W * 0.006)));

    let y = bandY + padY + titleSize * 0.85;
    for (const L of lineas) {
      if (!L.text) {
        y += Math.round(bodySize * 0.45);
        continue;
      }
      const size = L.size === 'title' ? titleSize : bodySize;
      ctx.font = `${L.bold ? '700' : '500'} ${size}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillStyle = L.mute ? '#A8C0D4' : L.accent ? '#C8F542' : '#FFFEFA';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const wrapped = wrapCanvasLines(ctx, L.text, W - padX * 2);
      for (const row of wrapped) {
        ctx.fillText(row, padX, y);
        y += lineGap;
      }
      if (L.size === 'title') y += Math.round(bodySize * 0.2);
    }

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar PNG'))), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

type LineaPub = { text: string; bold?: boolean; mute?: boolean; accent?: boolean; size?: 'title' | 'body' };

function textoPublicidadLineas(tituloPromo?: string): LineaPub[] {
  const frase = FRASES_SERVICIO[Math.floor(Math.random() * FRASES_SERVICIO.length)];
  const fraseParts = frase.split('\n');
  const out: LineaPub[] = [
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
  if (tituloPromo?.trim()) {
    out.push({ text: `📌 ${tituloPromo.trim()}`, mute: true, size: 'body' });
  }
  return out;
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
      const payload: ShareData = { files: [file], title };
      if (text?.trim()) payload.text = text;
      const ok =
        !nav.canShare ||
        nav.canShare(payload) ||
        nav.canShare({ files: [file] });
      if (ok) {
        await nav.share(payload);
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

/** Recibo térmico estilo supermercado (nota de venta / ticket válido visualmente). */
export async function generarTicketVentaTermico(datos: TicketVentaDatos): Promise<Blob> {
  const W = 540;
  const pad = 28;
  const n = Math.max(datos.lineas.length, 1);
  const rowH = 44;
  const H = 320 + n * rowH + 220;
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
  let y = 48;
  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.font = '900 28px "Courier New", Courier, monospace';
  ctx.fillText('AMORCAS', cx, y);
  y += 26;
  ctx.font = '700 15px "Courier New", Courier, monospace';
  ctx.fillText('Soluciones de Limpieza', cx, y);
  y += 22;
  ctx.font = '600 13px "Courier New", Courier, monospace';
  ctx.fillText(DIR_AMORCAS, cx, y);
  y += 18;
  ctx.fillText(`Tel. ${TEL_AMORCAS}`, cx, y);
  y += 18;
  ctx.fillText(`Horario: ${HORARIO_ATENCION}`, cx, y);
  y += 22;

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
  ctx.fillText('CANT', pad, y);
  ctx.fillText('DESCRIPCION', pad + 70, y);
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
    ctx.fillText(monoFit(ctx, left, 62), pad, y);
    ctx.fillText(monoFit(ctx, l.nombre, 280), pad + 70, y);
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
  y += 18;
  ctx.fillText('Documento válido para su registro / comprobante.', cx, y);
  y += 28;

  const barY = y;
  const barH = 48;
  const barX0 = pad + 40;
  const barW = W - pad * 2 - 80;
  let bx = barX0;
  let seed = folio.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  while (bx < barX0 + barW) {
    const bw = 1 + Math.floor(rnd() * 3);
    if (rnd() > 0.35) {
      ctx.fillStyle = '#111';
      ctx.fillRect(bx, barY, bw, barH);
    }
    bx += bw + 1;
  }
  y = barY + barH + 18;
  ctx.fillStyle = '#111';
  ctx.font = '600 12px "Courier New", Courier, monospace';
  ctx.fillText(folio, cx, y);

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

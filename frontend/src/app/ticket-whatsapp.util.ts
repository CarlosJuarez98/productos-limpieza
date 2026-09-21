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

const C = {
  navy: '#0c2d4a',
  teal: '#1a7a8c',
  ink: '#142433',
  mute: '#5a6f7e',
  line: '#d8e4ec',
  paper: '#ffffff',
  soft: '#f3f8fb',
  green: '#1c654a',
  greenSoft: '#e8f3ee',
};

function money(n: number): string {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
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

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

/** Encabezado a todo el ancho (recorta/cubre sin deformar). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

export async function generarTicketPng(datos: TicketDatos): Promise<Blob> {
  const header =
    (await loadImage('publicidad/ticket-header-amorcas.png').catch(() => null)) ||
    (await loadImage('publicidad/letras-fondo-azul.jpg').catch(() => null));
  const logo =
    (await loadImage('amorcas-logo.png').catch(() => null)) ||
    (await loadImage('publicidad/amorcas-c.jpg').catch(() => null));

  const W = 1080;
  const margin = 36;
  const cardX = margin;
  const cardW = W - margin * 2;
  const pad = 36;
  const itemH = 88;
  const n = Math.max(datos.lineas.length, 1);

  const headerH = header ? 420 : 220;
  const metaH = datos.cliente ? 120 : 78;
  const itemsH = n * itemH + 16;
  const totalH = 132;
  const notaH = datos.nota ? 64 : 0;
  const footH = 72;
  const cardH = headerH + metaH + itemsH + totalH + notaH + footH + 24;
  const H = cardH + margin * 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  // Fondo suave (sin adornos)
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#e8eef3');
  bg.addColorStop(1, '#d5e0e8');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const cardY = margin;
  ctx.save();
  ctx.shadowColor = 'rgba(12, 45, 74, 0.18)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 14;
  roundRect(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.fillStyle = C.paper;
  ctx.fill();
  ctx.restore();

  // Clip superior redondeado para el header
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, headerH + 20, 28);
  ctx.clip();

  if (header) {
    drawCover(ctx, header, cardX, cardY, cardW, headerH);
  } else {
    const g = ctx.createLinearGradient(0, cardY, 0, cardY + headerH);
    g.addColorStop(0, C.navy);
    g.addColorStop(1, C.teal);
    ctx.fillStyle = g;
    ctx.fillRect(cardX, cardY, cardW, headerH);
    if (logo) {
      const max = 200;
      const iw = logo.naturalWidth || logo.width;
      const ih = logo.naturalHeight || logo.height;
      const s = Math.min(max / iw, max / ih);
      const lw = iw * s;
      const lh = ih * s;
      ctx.fillStyle = C.paper;
      roundRect(ctx, W / 2 - lw / 2 - 18, cardY + 36, lw + 36, lh + 36, 20);
      ctx.fill();
      ctx.drawImage(logo, W / 2 - lw / 2, cardY + 54, lw, lh);
    }
  }

  // Fundido del header al papel
  const fade = ctx.createLinearGradient(0, cardY + headerH - 48, 0, cardY + headerH);
  fade.addColorStop(0, 'rgba(255,255,255,0)');
  fade.addColorStop(1, C.paper);
  ctx.fillStyle = fade;
  ctx.fillRect(cardX, cardY + headerH - 48, cardW, 48);
  ctx.restore();

  let y = cardY + headerH + 8;
  const listX = cardX + pad;
  const listW = cardW - pad * 2;

  // Meta
  ctx.textAlign = 'center';
  ctx.fillStyle = C.mute;
  ctx.font = '600 20px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(datos.fecha, W / 2, y + 8);

  if (datos.cliente) {
    ctx.fillStyle = C.ink;
    ctx.font = '800 34px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(truncate(ctx, datos.cliente, listW), W / 2, y + 52);
    y += 88;
  } else {
    y += 46;
  }

  // Línea
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(listX, y);
  ctx.lineTo(listX + listW, y);
  ctx.stroke();
  y += 22;

  // Ítems limpios
  datos.lineas.forEach((l, i) => {
    const rowY = y + i * itemH;
    roundRect(ctx, listX, rowY, listW, itemH - 10, 16);
    ctx.fillStyle = i % 2 === 0 ? C.soft : C.paper;
    ctx.fill();

    ctx.fillStyle = C.green;
    roundRect(ctx, listX, rowY, 8, itemH - 10, 16);
    ctx.fill();
    ctx.fillRect(listX + 4, rowY, 8, itemH - 10);

    const textX = listX + 28;
    const textMax = listW - 200;
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink;
    ctx.font = '700 22px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(truncate(ctx, l.nombre, textMax), textX, rowY + 34);
    ctx.fillStyle = C.mute;
    ctx.font = '600 16px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(truncate(ctx, l.detalle, textMax), textX, rowY + 58);

    ctx.textAlign = 'right';
    ctx.fillStyle = C.navy;
    ctx.font = '800 24px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`$${money(l.total)}`, listX + listW - 20, rowY + 48);
    ctx.textAlign = 'left';
  });

  y += itemsH + 8;

  // Total
  roundRect(ctx, listX, y, listW, totalH - 16, 20);
  ctx.fillStyle = C.green;
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '700 18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('TOTAL A PAGAR', listX + 28, y + 38);
  ctx.fillStyle = C.paper;
  ctx.font = '800 48px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`$${money(datos.total)}`, listX + 28, y + 90);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '700 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`${n} producto${n === 1 ? '' : 's'}`, listX + listW - 28, y + 66);
  ctx.textAlign = 'left';

  y += totalH;

  if (datos.nota) {
    roundRect(ctx, listX, y, listW, 52, 14);
    ctx.fillStyle = C.greenSoft;
    ctx.fill();
    ctx.fillStyle = C.green;
    ctx.font = '600 17px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(truncate(ctx, `Nota: ${datos.nota}`, listW - 32), listX + 18, y + 32);
    y += 64;
  }

  // Footer simple
  ctx.textAlign = 'center';
  ctx.fillStyle = C.mute;
  ctx.font = '600 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Amorcas · Soluciones de Limpieza', W / 2, cardY + cardH - 28);
  ctx.textAlign = 'left';

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
          text: `Total $${money(datos.total)}`,
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

/** Comparte una imagen de publicidad (archivo en /publicidad/...). */
export async function compartirPublicidad(
  src: string,
  titulo: string,
  texto = 'Amorcas · Soluciones de Limpieza'
): Promise<'compartido' | 'descargado'> {
  const res = await fetch(src);
  if (!res.ok) throw new Error('No se pudo cargar la imagen');
  const blob = await res.blob();
  const ext = src.toLowerCase().includes('.png') ? 'png' : 'jpg';
  const file = new File([blob], `${titulo.replace(/\s+/g, '-').toLowerCase()}.${ext}`, {
    type: blob.type || (ext === 'png' ? 'image/png' : 'image/jpeg'),
  });

  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };

  if (typeof nav.share === 'function') {
    try {
      if (!nav.canShare || nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: titulo, text: texto });
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

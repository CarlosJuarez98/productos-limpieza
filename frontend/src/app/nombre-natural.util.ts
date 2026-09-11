/** Orden natural de nombres: “Atomizador 1/4” < “1/2” < “1L”, sin importar mayúsculas. */
export function compararNombreNatural(a: string | null | undefined, b: string | null | undefined): number {
  const x = normalizar(a);
  const y = normalizar(b);
  const tx = tokens(x);
  const ty = tokens(y);
  const n = Math.max(tx.length, ty.length);
  for (let i = 0; i < n; i++) {
    const pa = tx[i];
    const pb = ty[i];
    if (pa == null) return -1;
    if (pb == null) return 1;
    if (typeof pa === 'number' && typeof pb === 'number') {
      if (pa !== pb) return pa < pb ? -1 : 1;
      continue;
    }
    const sa = String(pa);
    const sb = String(pb);
    const c = sa.localeCompare(sb, 'es', { sensitivity: 'base', numeric: true });
    if (c !== 0) return c;
  }
  return 0;
}

function normalizar(s: string | null | undefined): string {
  return (s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '');
}

/** Partes texto / número / fracción (1/2 → 0.5). */
function tokens(s: string): (string | number)[] {
  const out: (string | number)[] = [];
  const re = /(\d+)\s*\/\s*(\d+)|(\d+(?:[.,]\d+)?)|([^\d]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m[1] != null && m[2] != null) {
      const den = Number(m[2]);
      out.push(den === 0 ? Number(m[1]) : Number(m[1]) / den);
    } else if (m[3] != null) {
      out.push(Number(m[3].replace(',', '.')));
    } else if (m[4] != null) {
      const t = m[4].replace(/\s+/g, ' ').trim();
      if (t) out.push(t);
    }
  }
  return out;
}

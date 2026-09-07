import { Pipe, PipeTransform } from '@angular/core';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

/** Convierte yyyy-MM-dd a dd-mmm-yyyy (ej. 06-sep-2026) */
export function formatFechaDmY(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  const mes = MESES[Number(m) - 1];
  if (!mes) return iso;
  return `${d}-${mes}-${y}`;
}

@Pipe({ name: 'fechaDmY', standalone: true })
export class FechaDmYPipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    return formatFechaDmY(iso);
  }
}

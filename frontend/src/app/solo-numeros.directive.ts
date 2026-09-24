import { Directive, HostListener, Input } from '@angular/core';

/**
 * Restringe el input a números (enteros o decimales).
 * Uso: <input appSoloNumeros /> o <input appSoloNumeros="enteros" />
 * También: appSoloNumeros="decimal" (default).
 */
@Directive({
  selector: 'input[appSoloNumeros]',
  standalone: true,
})
export class SoloNumerosDirective {
  /** `enteros` = solo dígitos; vacío/`decimal` = dígitos + un punto o coma. */
  @Input() appSoloNumeros: '' | 'enteros' | 'decimal' = 'decimal';

  private get enteros(): boolean {
    return this.appSoloNumeros === 'enteros';
  }

  @HostListener('beforeinput', ['$event'])
  onBeforeInput(ev: InputEvent): void {
    if (ev.isComposing) return;
    const data = ev.data;
    if (data == null || data === '') return;
    if (ev.inputType?.startsWith('delete')) return;
    if (!this.esInsercionValida(ev.target as HTMLInputElement, data)) {
      ev.preventDefault();
    }
  }

  @HostListener('paste', ['$event'])
  onPaste(ev: ClipboardEvent): void {
    const text = ev.clipboardData?.getData('text') ?? '';
    if (!text) return;
    const limpio = this.limpiar(text);
    if (limpio === text.replace(/,/g, '.')) return;
    ev.preventDefault();
    const input = ev.target as HTMLInputElement;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const next = input.value.slice(0, start) + limpio + input.value.slice(end);
    const final = this.limpiar(next);
    input.value = final;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  @HostListener('keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    // Bloquea teclas sueltas que no son control ni dígitos (teclados físicos).
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const k = ev.key;
    if (k.length !== 1) return;
    if (this.enteros) {
      if (!/^\d$/.test(k)) ev.preventDefault();
      return;
    }
    if (/^\d$/.test(k)) return;
    if ((k === '.' || k === ',') && !(ev.target as HTMLInputElement).value.includes('.')) return;
    ev.preventDefault();
  }

  private esInsercionValida(input: HTMLInputElement, data: string): boolean {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const next = input.value.slice(0, start) + data + input.value.slice(end);
    return this.limpiar(next) === next.replace(/,/g, '.');
  }

  private limpiar(raw: string): string {
    let s = raw.replace(/,/g, '.').replace(/[^\d.]/g, '');
    if (this.enteros) return s.replace(/\./g, '');
    const i = s.indexOf('.');
    if (i < 0) return s;
    return s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
  }
}

import { Directive, ElementRef, HostListener, Input } from '@angular/core';

/**
 * Restringe el input a números (enteros o decimales).
 *
 * Uso explícito: <input appSoloNumeros /> o appSoloNumeros="enteros"
 * Automático: cualquier input con inputmode="decimal" o "numeric"
 * (numeric → enteros; decimal → permite punto/coma).
 */
@Directive({
  selector: 'input[appSoloNumeros], input[inputmode=decimal], input[inputmode=numeric]',
  standalone: true,
})
export class SoloNumerosDirective {
  /** `enteros` | `decimal` | vacío (infiere de inputmode). */
  @Input() appSoloNumeros: '' | 'enteros' | 'decimal' = '';

  constructor(private el: ElementRef<HTMLInputElement>) {}

  private get enteros(): boolean {
    if (this.appSoloNumeros === 'enteros') return true;
    if (this.appSoloNumeros === 'decimal') return false;
    return this.el.nativeElement.getAttribute('inputmode') === 'numeric';
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

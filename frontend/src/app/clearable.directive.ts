import { Directive, ElementRef, HostListener, OnDestroy, Renderer2 } from '@angular/core';

/**
 * Muestra una × para vaciar el input rápido (compatible con ngModel).
 * Visible en móvil y escritorio cuando hay texto.
 * Uso: <input appClearable ... />
 */
@Directive({
  selector:
    'input[appClearable]:not([type=date]):not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]):not([type=password])',
  standalone: true,
})
export class ClearableDirective implements OnDestroy {
  private btn: HTMLButtonElement | null = null;
  private wrap: HTMLElement | null = null;
  private mo: MutationObserver | null = null;

  constructor(
    private el: ElementRef<HTMLInputElement>,
    private r: Renderer2
  ) {
    // Sincrónico: si el wrap se crea en focus (microtask), mover el input
    // enfocado en Android cierra el teclado al instante.
    this.ensureUi();
    this.syncBtn();
  }

  ngOnDestroy(): void {
    this.mo?.disconnect();
    this.teardown();
  }

  @HostListener('input')
  @HostListener('change')
  @HostListener('focus')
  @HostListener('blur')
  onValue(): void {
    if (!this.wrap) this.ensureUi();
    this.syncBtn();
  }

  private ensureUi(): void {
    if (this.wrap) return;
    const input = this.el.nativeElement;
    if (input.disabled || input.readOnly) return;
    const parent = input.parentElement;
    if (!parent) return;

    if (parent.classList.contains('clearable-wrap')) {
      this.wrap = parent;
      this.btn = parent.querySelector('.clearable-x');
      return;
    }

    const hadFocus = typeof document !== 'undefined' && document.activeElement === input;

    const wrap = this.r.createElement('div') as HTMLElement;
    this.r.addClass(wrap, 'clearable-wrap');
    parent.insertBefore(wrap, input);
    wrap.appendChild(input);
    this.wrap = wrap;

    const btn = this.r.createElement('button') as HTMLButtonElement;
    btn.type = 'button';
    btn.className = 'clearable-x';
    btn.setAttribute('aria-label', 'Borrar texto');
    btn.title = 'Borrar';
    btn.tabIndex = -1;
    btn.textContent = '×';
    this.r.listen(btn, 'mousedown', (ev: Event) => {
      ev.preventDefault();
      this.clear();
    });
    this.r.listen(btn, 'touchend', (ev: Event) => {
      ev.preventDefault();
      this.clear();
    });
    wrap.appendChild(btn);
    this.btn = btn;

    this.mo = new MutationObserver(() => this.syncBtn());
    this.mo.observe(input, { attributes: true, attributeFilter: ['value'] });

    if (hadFocus) {
      // Reponer foco si el wrap se armó tarde (no debería, pero Android es sensible).
      queueMicrotask(() => input.focus({ preventScroll: true }));
    }
  }

  private syncBtn(): void {
    if (!this.btn) return;
    const v = this.el.nativeElement.value;
    const has = v != null && String(v).length > 0;
    this.btn.hidden = !has;
    this.btn.setAttribute('aria-hidden', has ? 'false' : 'true');
  }

  private clear(): void {
    const input = this.el.nativeElement;
    input.value = '';
    // Compatible con ngModel / ReactiveForms
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    this.syncBtn();
    input.focus({ preventScroll: true });
  }

  private teardown(): void {
    if (!this.wrap) return;
    const input = this.el.nativeElement;
    const parent = this.wrap.parentElement;
    if (parent) {
      parent.insertBefore(input, this.wrap);
      parent.removeChild(this.wrap);
    }
    this.wrap = null;
    this.btn = null;
  }
}

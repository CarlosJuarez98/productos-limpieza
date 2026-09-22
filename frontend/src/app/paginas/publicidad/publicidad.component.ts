import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AutoHideDirective } from '../../auto-hide.directive';
import { ApiService } from '../../api.service';
import { ConfirmDialogService } from '../../confirm-dialog.service';
import { PublicidadGaleriaItem } from '../../modelos';
import { compartirPublicidad } from '../../ticket-whatsapp.util';
import { generarLotePublicidad, PromoGenerada } from '../../promo-generador.util';

type Promo = {
  id: string;
  titulo: string;
  descripcion: string;
  src: string;
  textoShare: string;
  nueva?: boolean;
  eliminable?: boolean;
  vertical?: boolean;
  blob?: Blob;
  seleccionada?: boolean;
  guardando?: boolean;
};

const CONTACTO =
  'WhatsApp 247-120-6128 · Fracc. Los Álamos #121-C';

/** Promos fijas iniciales (arte guardado). */
const PROMOS_INICIALES: Promo[] = [
  {
    id: 'v2-dom',
    titulo: 'Pide a domicilio',
    descripcion: `Fabuloso $10 · Cloro $6 · Axion $30 · ${CONTACTO}`,
    src: '/api/publicidad/media/promo-v2-domicilio.jpg?v=4',
    textoShare: `¡Pide a domicilio! Fabuloso $10/L · Cloro $6/L · Axion $30/L — Amorcas · ${CONTACTO}`,
    nueva: true,
  },
  {
    id: 'v2-mayo',
    titulo: 'Mayoreo que conviene',
    descripcion: `Fabuloso $6/L · Cloro $3/L · Suavitel $13/L · ${CONTACTO}`,
    src: '/api/publicidad/media/promo-v2-mayoreo.jpg?v=4',
    textoShare: `Mayoreo Amorcas: Fabuloso $6/L · Cloro $3/L · Suavitel $13/L · ${CONTACTO}`,
    nueva: true,
  },
  {
    id: 'v2-lav',
    titulo: 'Día de lavado',
    descripcion: `Ariel $22 · Roma $25 · Suavitel $15 · Vanish $20 · ${CONTACTO}`,
    src: '/api/publicidad/media/promo-v2-lavado.jpg?v=4',
    textoShare: `Día de lavado Amorcas: Ariel $22 · Roma $25 · Suavitel $15 · Vanish $20 · ${CONTACTO}`,
    nueva: true,
  },
  {
    id: 'v2-coc',
    titulo: 'Cocina brillante',
    descripcion: `Axion $30 · Desengrasante $54 · Dentro del fracc. · ${CONTACTO}`,
    src: '/api/publicidad/media/promo-v2-cocina.jpg?v=4',
    textoShare: `Cocina brillante Amorcas · ${CONTACTO}`,
    nueva: true,
  },
  {
    id: 'v2-jarc',
    titulo: 'Jarcería y hogar',
    descripcion: `Escobas · Cubetas · Fibras · ${CONTACTO}`,
    src: '/api/publicidad/media/deco-jarceria.png?v=4',
    textoShare: `Jarcería y hogar — Amorcas · ${CONTACTO}`,
    nueva: true,
  },
  {
    id: 'v2-status',
    titulo: 'Estado WhatsApp',
    descripcion: `Vertical · Te lo llevamos · ${CONTACTO}`,
    src: '/api/publicidad/media/promo-v2-status.jpg?v=4',
    textoShare: `Te lo llevamos a domicilio — Amorcas · ${CONTACTO}`,
    nueva: true,
    vertical: true,
  },
];

@Component({
  selector: 'app-publicidad',
  standalone: true,
  imports: [CommonModule, FormsModule, AutoHideDirective],
  templateUrl: './publicidad.component.html',
  styleUrl: './publicidad.component.scss',
})
export class PublicidadComponent implements OnInit, OnDestroy {
  error = '';
  ok = '';
  compartiendoId: string | null = null;
  preview: Promo | null = null;
  generando = false;
  guardandoSeleccion = false;

  promosNuevas: Promo[] = [...PROMOS_INICIALES];
  private blobUrls: string[] = [];

  get seleccionCount(): number {
    return this.promosNuevas.filter((p) => p.seleccionada && p.blob).length;
  }

  promosGaleria: Promo[] = [];
  cargandoGaleria = false;
  subiendo = false;
  borrandoId: string | null = null;
  nuevoTitulo = '';
  nuevoDesc = '';

  constructor(
    private api: ApiService,
    private confirmDlg: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
    }
    this.cargarGaleria();
  }

  ngOnDestroy(): void {
    this.limpiarBlobs();
  }

  private limpiarBlobs(): void {
    this.blobUrls.forEach((u) => URL.revokeObjectURL(u));
    this.blobUrls = [];
  }

  cargarGaleria(): void {
    this.cargandoGaleria = true;
    this.api.publicidadGaleria().subscribe({
      next: (items) => {
        this.promosGaleria = items.map((i) => this.fromApi(i));
        this.cargandoGaleria = false;
      },
      error: (e: unknown) => {
        this.cargandoGaleria = false;
        this.error = e instanceof Error ? e.message : 'No se pudo cargar la galería';
      },
    });
  }

  private fromApi(i: PublicidadGaleriaItem): Promo {
    return {
      id: i.id,
      titulo: i.titulo,
      descripcion: i.descripcion || '',
      src: i.src,
      textoShare: i.textoShare || i.titulo,
      eliminable: i.eliminable,
    };
  }

  async generarMas(): Promise<void> {
    this.generando = true;
    this.error = '';
    this.ok = '';
    this.preview = null;
    try {
      const lote = await generarLotePublicidad(6);
      this.limpiarBlobs();
      this.blobUrls = lote.map((p) => p.src);
      this.promosNuevas = lote.map((p) => this.fromGen(p));
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'No se pudieron generar las promos';
    } finally {
      this.generando = false;
    }
  }

  private fromGen(p: PromoGenerada): Promo {
    return {
      id: p.id,
      titulo: p.titulo,
      descripcion: p.descripcion,
      src: p.src,
      textoShare: p.textoShare,
      nueva: true,
      vertical: p.vertical,
      blob: p.blob,
      eliminable: false,
      seleccionada: false,
    };
  }

  toggleSeleccion(p: Promo, ev?: Event): void {
    ev?.stopPropagation();
    if (!p.blob) return;
    p.seleccionada = !p.seleccionada;
  }

  async agregarSeleccionadas(): Promise<void> {
    const elegidas = this.promosNuevas.filter((p) => p.seleccionada && p.blob);
    if (!elegidas.length) return;
    this.guardandoSeleccion = true;
    this.error = '';
    this.ok = '';
    let okN = 0;
    for (const p of elegidas) {
      p.guardando = true;
      try {
        const file = new File([p.blob!], `${p.id}.png`, { type: 'image/png' });
        const item = await new Promise<PublicidadGaleriaItem>((resolve, reject) => {
          this.api.subirPublicidadGaleria(file, p.titulo, p.descripcion).subscribe({
            next: resolve,
            error: reject,
          });
        });
        this.promosGaleria = [this.fromApi(item), ...this.promosGaleria];
        p.seleccionada = false;
        okN++;
      } catch (e: unknown) {
        this.error = this.msgError(e, `No se pudo guardar «${p.titulo}»`);
      } finally {
        p.guardando = false;
      }
    }
    this.guardandoSeleccion = false;
    if (okN > 0) {
      this.ok = okN === 1 ? '1 promo agregada a la galería' : `${okN} promos agregadas a la galería`;
    }
  }

  abrirPreview(p: Promo): void {
    this.preview = p;
  }

  cerrarPreview(): void {
    this.preview = null;
  }

  onElegirArchivo(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.subir(file);
  }

  subir(file: File): void {
    this.error = '';
    this.ok = '';
    this.subiendo = true;
    this.api.subirPublicidadGaleria(file, this.nuevoTitulo, this.nuevoDesc).subscribe({
      next: (item) => {
        this.promosGaleria = [this.fromApi(item), ...this.promosGaleria];
        this.nuevoTitulo = '';
        this.nuevoDesc = '';
        this.subiendo = false;
      },
      error: (e: unknown) => {
        this.subiendo = false;
        this.error = this.msgError(e, 'No se pudo subir la imagen');
      },
    });
  }

  async borrar(p: Promo, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    if (!p.eliminable) return;
    const ok = await this.confirmDlg.ask(`¿Quitar «${p.titulo}» de la galería?`, {
      titulo: 'Quitar de la galería',
      confirmarTexto: 'Quitar',
      cancelarTexto: 'Cancelar',
    });
    if (!ok) return;
    this.error = '';
    this.ok = '';
    this.borrandoId = p.id;
    this.api.eliminarPublicidadGaleria(p.id).subscribe({
      next: () => {
        this.promosGaleria = this.promosGaleria.filter((x) => x.id !== p.id);
        if (this.preview?.id === p.id) this.preview = null;
        this.borrandoId = null;
      },
      error: (e: unknown) => {
        this.borrandoId = null;
        this.error = this.msgError(e, 'No se pudo borrar');
      },
    });
  }

  async compartir(p: Promo, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    this.error = '';
    this.ok = '';
    this.compartiendoId = p.id;
    try {
      const modo = await compartirPublicidad(p.src, p.titulo, undefined, p.blob);
      this.ok =
        modo === 'compartido'
          ? `Listo: elige el chat (${p.titulo})`
          : `Imagen descargada (${p.titulo}): compártela en WhatsApp`;
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'No se pudo compartir';
    } finally {
      this.compartiendoId = null;
    }
  }

  private msgError(e: unknown, fallback: string): string {
    if (e && typeof e === 'object' && 'error' in e) {
      const body = (e as { error?: { message?: string; error?: string } }).error;
      if (body?.message) return body.message;
      if (body?.error) return body.error;
    }
    return e instanceof Error ? e.message : fallback;
  }
}

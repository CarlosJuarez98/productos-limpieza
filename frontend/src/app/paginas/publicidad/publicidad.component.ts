import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AutoHideDirective } from '../../auto-hide.directive';
import { compartirPublicidad } from '../../ticket-whatsapp.util';

type Promo = {
  id: string;
  titulo: string;
  descripcion: string;
  src: string;
  textoShare: string;
  nueva?: boolean;
};

const CONTACTO =
  'WhatsApp 247-120-6128 · Fracc. Los Álamos #121-C';

/** Paquetes de promos nuevas (mismas piezas de info, estilos distintos). */
const PACKS: Promo[][] = [
  [
    {
      id: 'v2-dom',
      titulo: 'Pide a domicilio',
      descripcion: `Fabuloso $10 · Cloro $6 · Axion $30 · ${CONTACTO}`,
      src: 'publicidad/promo-v2-domicilio.png',
      textoShare: `¡Pide a domicilio! Fabuloso $10/L · Cloro $6/L · Axion $30/L — Amorcas · ${CONTACTO}`,
      nueva: true,
    },
    {
      id: 'v2-mayo',
      titulo: 'Mayoreo que conviene',
      descripcion: `Fabuloso $6/L · Cloro $3/L · Suavitel $13/L · ${CONTACTO}`,
      src: 'publicidad/promo-v2-mayoreo.png',
      textoShare: `Mayoreo Amorcas: Fabuloso $6/L · Cloro $3/L · Suavitel $13/L · ${CONTACTO}`,
      nueva: true,
    },
    {
      id: 'v2-lav',
      titulo: 'Día de lavado',
      descripcion: `Ariel $22 · Roma $25 · Suavitel $15 · Vanish $20 · ${CONTACTO}`,
      src: 'publicidad/promo-v2-lavado.png',
      textoShare: `Día de lavado Amorcas: Ariel $22 · Roma $25 · Suavitel $15 · Vanish $20 · ${CONTACTO}`,
      nueva: true,
    },
    {
      id: 'v2-coc',
      titulo: 'Cocina brillante',
      descripcion: `Axion $30 · Desengrasante $54 · Dentro del fracc. · ${CONTACTO}`,
      src: 'publicidad/promo-v2-cocina.png',
      textoShare: `Cocina brillante Amorcas · ${CONTACTO}`,
      nueva: true,
    },
    {
      id: 'v2-status',
      titulo: 'Estado WhatsApp',
      descripcion: `Vertical · Te lo llevamos · ${CONTACTO}`,
      src: 'publicidad/promo-v2-status.png',
      textoShare: `Te lo llevamos a domicilio — Amorcas · ${CONTACTO}`,
      nueva: true,
    },
    {
      id: 'v2-fracc',
      titulo: 'En tu fraccionamiento',
      descripcion: `Los Álamos #121-C · ${CONTACTO}`,
      src: 'publicidad/promo-v2-fracc.png',
      textoShare: `Amorcas en Fracc. Los Álamos #121-C · WhatsApp 247-120-6128`,
      nueva: true,
    },
  ],
  [
    {
      id: 'alt-granel',
      titulo: 'A granel sin pagar de más',
      descripcion: `Fabuloso $10 · Cloro $6 · Axion $30 · ${CONTACTO}`,
      src: 'publicidad/promo-alt-granel.png',
      textoShare: `A granel Amorcas · ${CONTACTO}`,
      nueva: true,
    },
    {
      id: 'alt-wa',
      titulo: 'Pide por WhatsApp',
      descripcion: `247-120-6128 · Fracc. Los Álamos #121-C`,
      src: 'publicidad/promo-alt-whatsapp.png',
      textoShare: `Pide por WhatsApp a Amorcas: 247-120-6128 · Fracc. Los Álamos #121-C`,
      nueva: true,
    },
    {
      id: 'alt-hogar',
      titulo: 'Hogar limpio hoy',
      descripcion: `Suavitel $15 · Ariel $22 · ${CONTACTO}`,
      src: 'publicidad/promo-alt-hogar.png',
      textoShare: `Hogar limpio hoy — Amorcas · ${CONTACTO}`,
      nueva: true,
    },
    {
      id: 'alt-vecinos',
      titulo: 'Vecinos del fraccionamiento',
      descripcion: `Los Álamos #121-C · Fabuloso $10 · Cloro $6 · ${CONTACTO}`,
      src: 'publicidad/promo-alt-vecinos.png',
      textoShare: `Vecinos del Fracc. Los Álamos — Amorcas · WhatsApp 247-120-6128`,
      nueva: true,
    },
    {
      id: 'v2-dom-b',
      titulo: 'Domicilio (otra toma)',
      descripcion: `Misma info, otro diseño · ${CONTACTO}`,
      src: 'publicidad/promo-v2-domicilio.png',
      textoShare: `¡Pide a domicilio! Amorcas · ${CONTACTO}`,
      nueva: true,
    },
    {
      id: 'v2-mayo-b',
      titulo: 'Mayoreo (otra toma)',
      descripcion: `Misma info, otro diseño · ${CONTACTO}`,
      src: 'publicidad/promo-v2-mayoreo.png',
      textoShare: `Mayoreo Amorcas · ${CONTACTO}`,
      nueva: true,
    },
  ],
];

@Component({
  selector: 'app-publicidad',
  standalone: true,
  imports: [CommonModule, AutoHideDirective],
  templateUrl: './publicidad.component.html',
  styleUrl: './publicidad.component.scss',
})
export class PublicidadComponent {
  error = '';
  ok = '';
  compartiendoId: string | null = null;
  preview: Promo | null = null;
  packIndex = 0;
  generando = false;

  /** Arte original de la marca. */
  readonly promosGaleria: Promo[] = [
    {
      id: 'chingon',
      titulo: 'Amorcas chingón',
      descripcion: 'Logo / marca',
      src: 'publicidad/amorcas-chingon.png',
      textoShare: 'Amorcas — la química perfecta para tu hogar',
    },
    {
      id: 'granel',
      titulo: 'Beneficios a granel',
      descripcion: 'Promo a granel',
      src: 'publicidad/beneficios-granel.jpg',
      textoShare: '¿Ya conoces nuestros productos a granel? Ahorra con Amorcas',
    },
    {
      id: 'ropa1',
      titulo: 'Ropa 1',
      descripcion: 'Limpieza de ropa',
      src: 'publicidad/ropa-1.jpg',
      textoShare: 'Tu ropa limpia y con aroma… Amorcas te ayuda',
    },
    {
      id: 'ropa2',
      titulo: 'Ropa 2',
      descripcion: 'Limpieza de ropa',
      src: 'publicidad/ropa-2.jpg',
      textoShare: 'Limpieza que se nota. Amorcas',
    },
    {
      id: 'trastes',
      titulo: 'Trastes',
      descripcion: 'Cocina y trastes',
      src: 'publicidad/trastes-1.jpg',
      textoShare: 'Trastes brillantes sin esfuerzo — Amorcas',
    },
    {
      id: 'coches',
      titulo: 'Lavado de coches',
      descripcion: 'Autos',
      src: 'publicidad/lavado-coches.jpg',
      textoShare: 'También para tu coche — Amorcas',
    },
    {
      id: 'servicios',
      titulo: 'Servicios y recargas',
      descripcion: 'Recargas y pagos',
      src: 'publicidad/servicios-recargas.jpg',
      textoShare: 'En Amorcas también hay servicios y recargas',
    },
    {
      id: 'tarjeta-f',
      titulo: 'Tarjeta frente',
      descripcion: CONTACTO,
      src: 'publicidad/tarjeta-frente.jpg',
      textoShare: `Amorcas · ${CONTACTO}`,
    },
    {
      id: 'tarjeta-a',
      titulo: 'Tarjeta atrás',
      descripcion: 'Presentación / sello',
      src: 'publicidad/tarjeta-atras.jpg',
      textoShare: 'Amorcas · Soluciones de Limpieza',
    },
    {
      id: 'letras',
      titulo: 'Logo letras azul',
      descripcion: 'Marca',
      src: 'publicidad/letras-fondo-azul.jpg',
      textoShare: 'Amorcas — la química perfecta para tu hogar',
    },
    {
      id: 'amorcas-c',
      titulo: 'Amorcas C',
      descripcion: 'Arte promocional',
      src: 'publicidad/amorcas-c.jpg',
      textoShare: 'Amorcas',
    },
  ];

  get promosNuevas(): Promo[] {
    return PACKS[this.packIndex] ?? PACKS[0];
  }

  get packLabel(): string {
    return `Set ${this.packIndex + 1} de ${PACKS.length}`;
  }

  /** Cambia al siguiente set de diseños (misma info de contacto / fraccionamiento). */
  generarMas(): void {
    this.generando = true;
    this.ok = '';
    this.preview = null;
    setTimeout(() => {
      this.packIndex = (this.packIndex + 1) % PACKS.length;
      this.ok = `Listo: ${this.packLabel} (WhatsApp y Fracc. Los Álamos se mantienen)`;
      this.generando = false;
    }, 280);
  }

  abrirPreview(p: Promo): void {
    this.preview = p;
  }

  cerrarPreview(): void {
    this.preview = null;
  }

  async compartir(p: Promo, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    this.error = '';
    this.ok = '';
    this.compartiendoId = p.id;
    try {
      const modo = await compartirPublicidad(p.src, p.titulo, p.textoShare);
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
}

import { Injectable, NgZone } from '@angular/core';
import { HttpBackend, HttpClient, HttpResponse } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { PullRefreshService } from './pull-refresh.service';

export type OfflineQueueItem = {
  id: string;
  user: string;
  method: string;
  url: string;
  body: unknown;
  label: string;
  createdAt: number;
  lastError?: string;
};

type CacheEntry = {
  user: string;
  key: string;
  status: number;
  body: unknown;
  updatedAt: number;
};

const DB_NAME = 'pl-offline-v1';
const DB_VERSION = 1;
const STORE_CACHE = 'cache';
const STORE_QUEUE = 'queue';

/** Header informativo (el sync usa HttpBackend y no pasa por el interceptor). */
export const OFFLINE_SYNC_HEADER = 'X-Offline-Sync';

@Injectable({ providedIn: 'root' })
export class OfflineService {
  readonly online$ = new BehaviorSubject<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly pendingCount$ = new BehaviorSubject<number>(0);
  readonly syncing$ = new BehaviorSubject<boolean>(false);
  readonly lastMessage$ = new BehaviorSubject<string>('');

  private dbPromise: Promise<IDBDatabase> | null = null;
  private flushing = false;
  /** Http sin interceptors: evita ciclos y re-encolar al sincronizar. */
  private readonly rawHttp: HttpClient;

  constructor(
    backend: HttpBackend,
    private auth: AuthService,
    private pullRefresh: PullRefreshService,
    private zone: NgZone
  ) {
    this.rawHttp = new HttpClient(backend);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.zone.run(() => this.onOnline()));
      window.addEventListener('offline', () => this.zone.run(() => this.online$.next(false)));
      void this.refreshPendingCount();
    }
  }

  get online(): boolean {
    return this.online$.value;
  }

  get pendingCount(): number {
    return this.pendingCount$.value;
  }

  currentUser(): string {
    const raw = this.auth.username || this.auth.usuario || 'anon';
    return String(raw).trim().toLowerCase() || 'anon';
  }

  cacheKey(method: string, url: string): string {
    return `${method.toUpperCase()} ${this.normalizeUrl(url)}`;
  }

  async getCached<T = unknown>(method: string, url: string): Promise<T | null> {
    const db = await this.db();
    const key = this.cacheKey(method, url);
    const user = this.currentUser();
    const row = await this.idbGet<CacheEntry>(db, STORE_CACHE, `${user}::${key}`);
    if (!row || row.user !== user) return null;
    return row.body as T;
  }

  async putCache(method: string, url: string, status: number, body: unknown): Promise<void> {
    if (status < 200 || status >= 300) return;
    const db = await this.db();
    const user = this.currentUser();
    const key = this.cacheKey(method, url);
    const entry: CacheEntry = {
      user,
      key,
      status,
      body,
      updatedAt: Date.now(),
    };
    await this.idbPut(db, STORE_CACHE, `${user}::${key}`, entry);
  }

  async enqueue(method: string, url: string, body: unknown): Promise<OfflineQueueItem> {
    const item: OfflineQueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      user: this.currentUser(),
      method: method.toUpperCase(),
      url: this.normalizeUrl(url),
      body: body ?? null,
      label: this.labelFor(method, url),
      createdAt: Date.now(),
    };
    const db = await this.db();
    await this.idbPut(db, STORE_QUEUE, item.id, item);
    await this.applyOptimisticCache(item);
    await this.refreshPendingCount();
    this.lastMessage$.next(`Guardado: ${item.label}`);
    return item;
  }

  async listQueue(): Promise<OfflineQueueItem[]> {
    const db = await this.db();
    const user = this.currentUser();
    const all = await this.idbGetAll<OfflineQueueItem>(db, STORE_QUEUE);
    return all
      .filter((i) => i.user === user)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async flush(): Promise<{ ok: number; fail: number }> {
    if (this.flushing) return { ok: 0, fail: 0 };
    if (!this.online) return { ok: 0, fail: 0 };
    this.flushing = true;
    this.syncing$.next(true);
    let ok = 0;
    let fail = 0;
    try {
      const items = await this.listQueue();
      for (const item of items) {
        try {
          await firstValueFrom(
            this.rawHttp.request(item.method, item.url, {
              body: item.method === 'GET' || item.method === 'DELETE' ? undefined : item.body,
              withCredentials: true,
              observe: 'response',
              responseType: 'json',
            })
          );
          const db = await this.db();
          await this.idbDelete(db, STORE_QUEUE, item.id);
          ok++;
        } catch (e: unknown) {
          fail++;
          const msg = this.errorMessage(e);
          const db = await this.db();
          await this.idbPut(db, STORE_QUEUE, item.id, { ...item, lastError: msg });
          // 401: detener; el usuario debe volver a entrar.
          if (this.isUnauthorized(e)) {
            this.lastMessage$.next('Sesión expirada. Entra de nuevo para subir pendientes.');
            break;
          }
          // 4xx de validación: dejar el ítem y seguir con los demás.
          if (this.isClientError(e)) {
            this.lastMessage$.next(`No se pudo subir ${item.label}: ${msg}`);
            continue;
          }
          // red/5xx: parar y reintentar luego
          this.lastMessage$.next(`Sin red al subir ${item.label}. Se reintenta luego.`);
          break;
        }
      }
      await this.refreshPendingCount();
      if (ok > 0) {
        this.lastMessage$.next(
          fail
            ? `Sincronizados ${ok}. Pendientes con error: ${fail}.`
            : `Sincronizados ${ok} cambio(s).`
        );
        this.pullRefresh.trigger();
      }
    } finally {
      this.flushing = false;
      this.syncing$.next(false);
    }
    return { ok, fail };
  }

  syntheticSuccess(method: string, body: unknown): HttpResponse<unknown> {
    const m = method.toUpperCase();
    if (m === 'DELETE') {
      return new HttpResponse({ status: 200, body: null });
    }
    if (m === 'POST' && Array.isArray(body) === false && body && typeof body === 'object' && 'lineas' in (body as object)) {
      // lotes: devolver arreglo vacío tipado como éxito
      return new HttpResponse({ status: 200, body: [] });
    }
    if (body == null) {
      return new HttpResponse({ status: 200, body: { offline: true, id: -Date.now() } });
    }
    return new HttpResponse({
      status: 200,
      body: typeof body === 'object' ? { ...(body as object), offline: true, id: -Date.now() } : body,
    });
  }

  private onOnline(): void {
    this.online$.next(true);
    void this.flush();
  }

  private async refreshPendingCount(): Promise<void> {
    const items = await this.listQueue();
    this.pendingCount$.next(items.length);
  }

  private normalizeUrl(url: string): string {
    try {
      if (url.startsWith('http')) {
        const u = new URL(url);
        return u.pathname + u.search;
      }
    } catch {
      /* ignore */
    }
    return url.startsWith('/') ? url : `/${url}`;
  }

  private labelFor(method: string, url: string): string {
    const u = this.normalizeUrl(url);
    const m = method.toUpperCase();
    if (u.includes('/ventas')) return m === 'DELETE' ? 'Eliminar venta' : 'Venta(s)';
    if (u.includes('/casa')) return 'Uso en casa';
    if (u.includes('/entradas')) return m === 'DELETE' ? 'Eliminar entrada' : 'Entrada(s)';
    if (u.includes('/producciones')) return 'Preparación';
    if (u.includes('/traspasos/abonos')) return 'Abono traspaso';
    if (u.includes('/traspasos')) return m === 'DELETE' ? 'Eliminar traspaso' : 'Traspaso';
    if (u.includes('/personas')) return 'Persona';
    if (u.includes('/apartados/rubros')) return 'Rubro apartado';
    if (u.includes('/apartados')) return m === 'DELETE' ? 'Eliminar apartado' : 'Apartado(s)';
    if (u.includes('/caja/movimientos')) return 'Movimiento de caja';
    if (u.includes('/caja/cortes')) return 'Corte de caja';
    if (u.includes('/caja')) return 'Caja';
    if (u.includes('/ajustes-inventario')) return 'Ajuste inventario';
    if (u.includes('/inventario')) return m === 'DELETE' ? 'Eliminar producto' : 'Producto';
    if (u.includes('/recetas')) return 'Receta';
    if (u.includes('/precios')) return 'Precio';
    if (u.includes('/pedidos')) return 'Pedido / surtir';
    if (u.includes('/inversion')) return 'Inversión';
    if (u.includes('/margenes')) return 'Márgenes';
    return `${m} ${u}`;
  }

  /** Refleja el cambio en el cache GET para que el historial se vea sin red. */
  private async applyOptimisticCache(item: OfflineQueueItem): Promise<void> {
    try {
      await this.ensureInvNombres();
      const path = item.url.split('?')[0];
      if (item.method === 'POST' && path.endsWith('/ventas/lote')) {
        const filas = this.expandVentaLote(item.body);
        await this.appendToListCache('/api/ventas', filas);
        const casa = filas.filter((v) => String(v['tipoVenta'] || '').toUpperCase() === 'CASA');
        if (casa.length) await this.appendToListCache('/api/casa', casa);
        await this.adjustInventarioFromVentas(item.body);
        return;
      }
      if (item.method === 'POST' && path.endsWith('/ventas')) {
        const fila = this.filaVentaOffline(
          typeof item.body === 'object' && item.body ? (item.body as Record<string, unknown>) : {},
          (item.body as { fecha?: string })?.fecha,
          0
        );
        await this.appendToListCache('/api/ventas', [fila]);
        if (String(fila['tipoVenta'] || '').toUpperCase() === 'CASA') {
          await this.appendToListCache('/api/casa', [fila]);
        }
        await this.adjustInventarioFromVentas({ lineas: [item.body] });
        return;
      }
      if (item.method === 'POST' && path.endsWith('/entradas/lote')) {
        await this.appendToListCache('/api/entradas', this.expandEntradaLote(item.body));
        return;
      }
      if (item.method === 'POST' && path.endsWith('/entradas')) {
        await this.appendToListCache('/api/entradas', this.expandEntradaLote({
          fecha: (item.body as { fecha?: string })?.fecha,
          lineas: [item.body as Record<string, unknown>],
        }));
        return;
      }
      if (item.method === 'POST' && path.endsWith('/apartados/lote')) {
        await this.patchApartadosCache(item.body);
        return;
      }
      if (item.method === 'POST' && path.endsWith('/apartados')) {
        await this.patchApartadosCache({ fecha: (item.body as { fecha?: string })?.fecha, lineas: [item.body] });
        return;
      }
      if (item.method === 'POST' && path.endsWith('/producciones')) {
        await this.appendToListCache('/api/producciones', [this.asOfflineRow(item.body)]);
        return;
      }
      if (item.method === 'POST' && path.endsWith('/ajustes-inventario')) {
        const b = item.body as Record<string, unknown>;
        await this.appendToListCache('/api/ajustes-inventario', [
          {
            ...this.asOfflineRow(b),
            productoNombre: b['productoNombre'] || this.nombreProductoSync(b['productoId']),
          },
        ]);
        return;
      }
      if (item.method === 'POST' && path.endsWith('/caja/movimientos')) {
        // solo mensaje; caja resumen es agregado complejo
        return;
      }
      if (item.method === 'POST' && path.endsWith('/traspasos')) {
        await this.patchTraspasosCache(item.body);
        return;
      }
      if (item.method === 'POST' && path.endsWith('/traspasos/abonos')) {
        await this.patchTraspasoAbonoCache(item.body);
        return;
      }
      if (item.method === 'POST' && path.endsWith('/pedidos')) {
        await this.appendToListCache('/api/pedidos', [this.asOfflineRow(item.body)]);
        return;
      }
      if (item.method === 'POST' && path.endsWith('/inversion')) {
        return;
      }
      if (item.method === 'POST' && path.endsWith('/recetas')) {
        await this.appendToListCache('/api/recetas', [this.asOfflineRow(item.body)]);
      }
    } catch {
      /* no bloquear el alta offline */
    }
  }

  private expandVentaLote(body: unknown): Array<Record<string, unknown>> {
    const b = body as { fecha?: string; lineas?: Array<Record<string, unknown>> };
    const fecha = b?.fecha;
    return (b?.lineas || []).map((l, i) => this.filaVentaOffline(l, fecha, i));
  }

  private filaVentaOffline(
    l: Record<string, unknown>,
    fecha: string | undefined,
    i: number
  ): Record<string, unknown> {
    const tipo = String(l['tipoVenta'] || l['modo'] || 'LITROS').toUpperCase();
    return {
      ...l,
      id: -(Date.now() + i),
      fecha,
      tipoVenta: tipo,
      tipoVentaLabel: this.etiquetaTipoVenta(tipo),
      cantidad: Number(l['cantidad']) || 0,
      total: Number(l['total']) || 0,
      pagoTarjeta: !!l['pagoTarjeta'],
      productoId: l['productoId'] ?? null,
      productoNombre: l['productoNombre'] || this.nombreProductoSync(l['productoId']),
      offline: true,
    };
  }

  private expandEntradaLote(body: unknown): Array<Record<string, unknown>> {
    const b = body as { fecha?: string; lineas?: Array<Record<string, unknown>> };
    return (b?.lineas || []).map((l, i) => ({
      ...l,
      id: -(Date.now() + i),
      fecha: b?.fecha,
      productoId: l['productoId'],
      productoNombre: l['productoNombre'] || this.nombreProductoSync(l['productoId']),
      cantidad: Number(l['cantidad']) || 0,
      precioProveedor: l['precioProveedor'] ?? null,
      total: l['total'] ?? null,
      offline: true,
    }));
  }

  private invNombres = new Map<number, { nombre: string; precioCompra: number }>();

  private async ensureInvNombres(): Promise<void> {
    const inv = await this.getCached<Array<Record<string, unknown>>>('GET', '/api/inventario');
    this.invNombres = new Map();
    if (!Array.isArray(inv)) return;
    for (const p of inv) {
      const id = Number(p['id']);
      if (!Number.isFinite(id)) continue;
      this.invNombres.set(id, {
        nombre: String(p['nombre'] || '').trim() || 'Producto',
        precioCompra: Number(p['precioCompra']) || 0,
      });
    }
  }

  private nombreProductoSync(productoId: unknown): string {
    const id = Number(productoId);
    return this.invNombres.get(id)?.nombre || 'Producto';
  }

  private precioCompraSync(productoId: unknown): number {
    const id = Number(productoId);
    return this.invNombres.get(id)?.precioCompra || 0;
  }

  private etiquetaTipoVenta(tipo: string): string {
    switch (tipo) {
      case 'LITROS':
        return 'Litros';
      case 'PIEZA':
        return 'Pieza';
      case 'MUESTRA':
        return 'Muestra';
      case 'CASA':
        return 'Casa';
      case 'PESOS':
        return 'Pesos';
      case 'MAYOREO':
        return 'Mayoreo';
      case 'RECARGA':
        return 'Recarga';
      case 'PAGO_DE_SERVICIOS':
        return 'Pago de servicios';
      default:
        return tipo || 'Venta';
    }
  }

  private async patchTraspasosCache(body: unknown): Promise<void> {
    const b = body as {
      fecha?: string;
      persona?: string;
      nota?: string | null;
      lineas?: Array<{ productoId?: number; cantidad?: number }>;
    };
    const lineas = (b.lineas || []).map((l, i) => {
      const cantidad = Number(l.cantidad) || 0;
      const precioCompra = this.precioCompraSync(l.productoId);
      const total = Math.round(cantidad * precioCompra * 100) / 100;
      return {
        id: -(Date.now() + i),
        productoId: l.productoId,
        productoNombre: this.nombreProductoSync(l.productoId),
        cantidad,
        precioCompra,
        total,
      };
    });
    const total = Math.round(lineas.reduce((s, l) => s + l.total, 0) * 100) / 100;
    const row = {
      id: -Date.now(),
      fecha: b.fecha,
      personaId: null as number | null,
      persona: b.persona || '—',
      nota: b.nota || null,
      total,
      lineas,
      offline: true,
    };
    const cached = await this.getCached<Record<string, unknown>>('GET', '/api/traspasos');
    const prev = cached && typeof cached === 'object' ? cached : {};
    const traspasos = Array.isArray(prev['traspasos']) ? (prev['traspasos'] as unknown[]) : [];
    const saldos = Array.isArray(prev['saldosPorPersona'])
      ? [...(prev['saldosPorPersona'] as Array<Record<string, unknown>>)]
      : [];
    const personaNom = String(b.persona || '').trim();
    if (personaNom) {
      const idx = saldos.findIndex(
        (s) => String(s['persona'] || '').toLowerCase() === personaNom.toLowerCase()
      );
      if (idx >= 0) {
        const s = { ...saldos[idx] };
        const traspasado = Number(s['totalTraspasado'] || 0) + total;
        const abonado = Number(s['totalAbonado'] || 0);
        const saldo = Math.round((traspasado - abonado) * 100) / 100;
        s['totalTraspasado'] = traspasado;
        s['saldo'] = saldo;
        s['estado'] = saldo > 0.001 ? 'DEBE' : saldo < -0.001 ? 'A_FAVOR' : 'AL_CORRIENTE';
        saldos[idx] = s;
      } else {
        saldos.push({
          personaId: -(saldos.length + 1),
          persona: personaNom,
          totalTraspasado: total,
          totalAbonado: 0,
          saldo: total,
          estado: 'DEBE',
        });
      }
    }
    const totalTraspasado = Number(prev['totalTraspasado'] || 0) + total;
    const totalAbonado = Number(prev['totalAbonado'] || 0);
    await this.putCache('GET', '/api/traspasos', 200, {
      ...prev,
      totalTraspasado,
      totalAbonado,
      saldoPendiente: Math.round((totalTraspasado - totalAbonado) * 100) / 100,
      saldosPorPersona: saldos,
      traspasos: [row, ...traspasos],
      abonos: Array.isArray(prev['abonos']) ? prev['abonos'] : [],
      personas: Array.isArray(prev['personas']) ? prev['personas'] : [],
    });
  }

  private async patchTraspasoAbonoCache(body: unknown): Promise<void> {
    const b = body as { fecha?: string; monto?: number; personaId?: number; nota?: string | null };
    const cached = await this.getCached<Record<string, unknown>>('GET', '/api/traspasos');
    if (!cached || typeof cached !== 'object') return;
    const saldos = Array.isArray(cached['saldosPorPersona'])
      ? (cached['saldosPorPersona'] as Array<Record<string, unknown>>)
      : [];
    const persona =
      saldos.find((s) => Number(s['personaId']) === Number(b.personaId))?.['persona'] || '—';
    const row = {
      id: -Date.now(),
      fecha: b.fecha,
      monto: Number(b.monto) || 0,
      personaId: b.personaId ?? null,
      persona,
      nota: b.nota || null,
      offline: true,
    };
    const abonos = Array.isArray(cached['abonos']) ? (cached['abonos'] as unknown[]) : [];
    const monto = Number(b.monto) || 0;
    const nextSaldos = saldos.map((s) => {
      if (Number(s['personaId']) !== Number(b.personaId)) return s;
      const abonado = Number(s['totalAbonado'] || 0) + monto;
      const traspasado = Number(s['totalTraspasado'] || 0);
      const saldo = Math.round((traspasado - abonado) * 100) / 100;
      return {
        ...s,
        totalAbonado: abonado,
        saldo,
        estado: saldo > 0.001 ? 'DEBE' : saldo < -0.001 ? 'A_FAVOR' : 'AL_CORRIENTE',
      };
    });
    const totalAbonado = Number(cached['totalAbonado'] || 0) + monto;
    const totalTraspasado = Number(cached['totalTraspasado'] || 0);
    await this.putCache('GET', '/api/traspasos', 200, {
      ...cached,
      totalAbonado,
      saldoPendiente: Math.round((totalTraspasado - totalAbonado) * 100) / 100,
      saldosPorPersona: nextSaldos,
      abonos: [row, ...abonos],
    });
  }

  private asOfflineRow(body: unknown): Record<string, unknown> {
    return {
      ...(typeof body === 'object' && body ? (body as object) : {}),
      id: -Date.now(),
      offline: true,
    };
  }

  private async appendToListCache(url: string, rows: unknown[]): Promise<void> {
    if (!rows.length) return;
    const cached = (await this.getCached<unknown[]>('GET', url)) || [];
    const list = Array.isArray(cached) ? cached : [];
    await this.putCache('GET', url, 200, [...rows, ...list]);
  }

  private async patchApartadosCache(body: unknown): Promise<void> {
    const cached = await this.getCached<Record<string, unknown>>('GET', '/api/apartados');
    if (!cached || typeof cached !== 'object') return;
    const b = body as { fecha?: string; lineas?: Array<Record<string, unknown>> };
    const nuevos = (b.lineas || []).map((l, i) => ({
      ...l,
      id: -(Date.now() + i),
      fecha: b.fecha,
      offline: true,
    }));
    const movimientos = Array.isArray(cached['movimientos']) ? (cached['movimientos'] as unknown[]) : [];
    await this.putCache('GET', '/api/apartados', 200, {
      ...cached,
      movimientos: [...nuevos, ...movimientos],
    });
  }

  private async adjustInventarioFromVentas(body: unknown): Promise<void> {
    const inv = await this.getCached<Array<Record<string, unknown>>>('GET', '/api/inventario');
    if (!Array.isArray(inv) || !inv.length) return;
    const lineas = (body as { lineas?: Array<{ productoId?: number; cantidad?: number }> })?.lineas || [];
    if (!lineas.length) return;
    const next = inv.map((p) => {
      const id = Number(p['id']);
      const used = lineas
        .filter((l) => Number(l.productoId) === id)
        .reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
      if (!used) return p;
      const stock = Number(p['stockActual'] ?? p['stock']) || 0;
      return { ...p, stockActual: Math.round((stock - used) * 1000) / 1000 };
    });
    await this.putCache('GET', '/api/inventario', 200, next);
  }

  private errorMessage(e: unknown): string {
    const err = e as { error?: { error?: string; message?: string }; message?: string; status?: number };
    return err?.error?.error || err?.error?.message || err?.message || `Error ${err?.status || ''}`.trim();
  }

  private isUnauthorized(e: unknown): boolean {
    return (e as { status?: number })?.status === 401;
  }

  private isClientError(e: unknown): boolean {
    const s = (e as { status?: number })?.status || 0;
    return s >= 400 && s < 500 && s !== 401;
  }

  private db(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_CACHE)) {
          db.createObjectStore(STORE_CACHE);
        }
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  private idbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  private idbPut(db: IDBDatabase, store: string, key: string, value: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      // queue store uses keyPath id; cache uses out-of-line key
      const req = store === STORE_QUEUE ? os.put(value) : os.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private idbDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private idbGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve((req.result || []) as T[]);
      req.onerror = () => reject(req.error);
    });
  }
}

import { TestBed } from '@angular/core/testing';
import { HttpRequest } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { environment } from '@env';
import { MemoryStorage, cargarPermisos, guardarSesion, misPermisos, providersPantalla } from '@app/core/auth/auth.testing';
import { Pantalla, botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { ClaveModulo, Permisos } from '@app/core/auth/permisos.models';
import { Cotizacion, Requerimiento } from '../requerimientos.models';
import { lineaRequerimiento, requerimiento } from '../requerimientos.testing';
import { RequerimientoFormComponent } from './requerimiento-form';

/** Superficie protegida del componente que ejercita la prueba. */
interface Internals {
  form: {
    disabled: boolean;
    patchValue(value: Record<string, unknown>): void;
    controls: { lineas: { at(i: number): { patchValue(v: Record<string, unknown>): void } } };
  };
  formError(): string;
  save(enviar?: boolean): void;
}

/** Ruta `requerimientos/nuevo` (sin `id`) o `requerimientos/:id`. */
function ruta(id: string | null) {
  return { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } };
}

async function setup(id: string | null = null, acciones: Partial<Permisos> = { crear: true, editar: true }) {
  const storage = new MemoryStorage();
  guardarSesion(storage, 'Usuario');
  TestBed.configureTestingModule({ providers: [...providersPantalla(storage), ruta(id)] });
  const http = TestBed.inject(HttpTestingController);
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(RequerimientoFormComponent);
  await cargarPermisos(misPermisos('Usuario', { requerimientos: acciones }));
  // Catálogos iniciales (centros de costos y trabajadores).
  http.match((r) => r.url.endsWith('/select') || r.url.endsWith('/area')).forEach((r) => r.flush([]));
  return { http, navigate, cmp: fixture.componentInstance as unknown as Internals };
}

const valido = { fecha: '2026-10-10', id_centro_costo: 4, id_solicitante: 7, justificacion: ' Reposición de materiales ' };

describe('RequerimientoFormComponent', () => {
  afterEach(() => {
    const http = TestBed.inject(HttpTestingController);
    // Al elegir un centro de costos el formulario consulta sus fases.
    http.match((r) => r.url.includes('/fases-asignadas/')).forEach((r) => r.flush([]));
    http.verify();
  });

  it('exige centro de costos, solicitante y justificación', async () => {
    const { cmp } = await setup();
    cmp.save();
    expect(cmp.formError()).toBe('Seleccione el centro de costos.');

    cmp.form.patchValue({ id_centro_costo: 4 });
    cmp.save();
    expect(cmp.formError()).toBe('Seleccione al solicitante.');

    cmp.form.patchValue({ id_solicitante: 7 });
    cmp.save();
    expect(cmp.formError()).toBe('Indique la justificación del requerimiento.');
  });

  it('valida cada ítem antes de enviar', async () => {
    const { cmp } = await setup();
    cmp.form.patchValue(valido);
    cmp.save();
    expect(cmp.formError()).toBe('Línea 1: seleccione un producto o servicio.');

    cmp.form.controls.lineas.at(0).patchValue({ id_producto: 10, cantidad: '0' });
    cmp.save();
    expect(cmp.formError()).toContain('la cantidad debe ser mayor a 0');

    cmp.form.controls.lineas.at(0).patchValue({ cantidad: '2', precio_referencial: 'abc' });
    cmp.save();
    expect(cmp.formError()).toBe('Línea 1: el precio referencial no es válido.');
  });

  it('crea el borrador con los valores limpios y abre su detalle', async () => {
    const { http, navigate, cmp } = await setup();
    cmp.form.patchValue(valido);
    cmp.form.controls.lineas.at(0).patchValue({ id_producto: 10, cantidad: ' 3 ', precio_referencial: '', observaciones: ' urgente ' });
    cmp.save();

    const req = http.expectOne(`${environment.apiUrl}/requerimientos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      fecha: '2026-10-10',
      fecha_requerida: undefined,
      id_centro_costo: 4,
      id_fase: undefined,
      id_solicitante: 7,
      tipo: 'COMPRA',
      justificacion: 'Reposición de materiales',
      lineas: [{ id_producto: 10, cantidad: '3', precio_referencial: undefined, observaciones: 'urgente' }],
    });
    req.flush({ id: 55, numero: 'FUR-000055', estado: 'BORRADOR' });
    expect(navigate).toHaveBeenCalledWith(['/requerimientos', 55]);
  });

  it('"Guardar y enviar" crea el borrador y luego lo envía a aprobación', async () => {
    const { http, navigate, cmp } = await setup();
    cmp.form.patchValue(valido);
    cmp.form.controls.lineas.at(0).patchValue({ id_producto: 10, cantidad: '3' });
    cmp.save(true);

    http.expectOne(`${environment.apiUrl}/requerimientos`).flush({ id: 55, numero: 'FUR-000055', estado: 'BORRADOR' });
    const enviar = http.expectOne(`${environment.apiUrl}/requerimientos/55/enviar`);
    expect(enviar.request.method).toBe('POST');
    enviar.flush({ id: 55, estado: 'ENVIADO' });
    expect(navigate).toHaveBeenCalledWith(['/requerimientos']);
  });

  it('muestra el mensaje del servidor si el guardado falla', async () => {
    const { http, cmp } = await setup();
    cmp.form.patchValue(valido);
    cmp.form.controls.lineas.at(0).patchValue({ id_producto: 10, cantidad: '3' });
    cmp.save();
    http.expectOne(`${environment.apiUrl}/requerimientos`).flush({ message: 'Producto 10 no encontrado' }, { status: 400, statusText: 'Bad Request' });
    expect(cmp.formError()).toBe('Producto 10 no encontrado');
  });

  it('carga un requerimiento existente y lo guarda con PATCH', async () => {
    const { http, cmp } = await setup('9');
    http.expectOne(`${environment.apiUrl}/requerimientos/9`).flush({
      id: 9,
      numero: 'FUR-000009',
      fecha: '2026-10-10',
      fecha_requerida: null,
      id_centro_costo: 4,
      id_fase: null,
      id_solicitante: 7,
      area: null,
      tipo: 'COMPRA',
      id_beneficiario: null,
      id_area: null,
      justificacion: 'Original',
      estado: 'OBSERVADO',
      eventos: [],
      ordenes_compra: [],
      lineas: [{ id: 1, id_producto: 10, codigo: 'P-10', descripcion: 'Cemento', tipo_producto: 'PRODUCTO', unidad: 'BLS', cantidad: '5', cantidad_aprobada: null, precio_referencial: null, observaciones: null, cantidad_ordenada: '0', saldo_por_ordenar: '0' }],
    });
    http.match((r) => r.url.includes('/fases-asignadas/')).forEach((r) => r.flush([]));

    cmp.form.patchValue({ justificacion: 'Corregido' });
    cmp.save();
    const req = http.expectOne(`${environment.apiUrl}/requerimientos/9`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.justificacion).toBe('Corregido');
    expect(req.request.body.lineas).toEqual([{ id_producto: 10, cantidad: '5', precio_referencial: undefined, observaciones: undefined }]);
    req.flush({ id: 9, estado: 'OBSERVADO', eventos: [], ordenes_compra: [], lineas: [] });
  });

  it('sin crear, el alta no guarda (defensa en el método)', async () => {
    const { http, cmp } = await setup(null, {});
    cmp.form.patchValue(valido);
    cmp.form.controls.lineas.at(0).patchValue({ id_producto: 10, cantidad: '3' });
    cmp.save();
    cmp.save(true);
    http.expectNone(`${environment.apiUrl}/requerimientos`);
    expect(cmp.formError()).toBe('');
  });

  it('sin editar, la edición no guarda aunque el estado sea editable (defensa en el método)', async () => {
    const { http, cmp } = await setup('9', { crear: true });
    http.expectOne(`${environment.apiUrl}/requerimientos/9`).flush(BORRADOR);
    http.match((r) => r.url.includes('/fases-asignadas/')).forEach((r) => r.flush([]));
    cmp.save();
    http.expectNone((r) => r.method === 'PATCH');
  });
});

// ------------------------------------------------------------ botones según permisos

function cotizacion(cambios: Partial<Cotizacion> = {}): Cotizacion {
  return {
    id: 31,
    numero: 'COT-000031',
    id_requerimiento: 7,
    id_proveedor: 50,
    proveedor: 'Ferretería Sur',
    fecha: '2026-10-05',
    referencia: null,
    moneda_id: 'PEN',
    moneda_simbolo: 'S/',
    incluye_igv: false,
    afecto_igv: true,
    forma_pago: 'Contado',
    dias_credito: 0,
    adelanto_porcentaje: null,
    medio_pago: null,
    plazo_entrega_dias: null,
    validez_dias: null,
    garantia: null,
    condiciones: null,
    archivo_url: null,
    total_sin_igv: '100',
    igv: '18',
    total: '118',
    es_ganadora: false,
    lineas: [],
    ...cambios,
  };
}

const COMPRA = { tipo: 'COMPRA', lineas: [lineaRequerimiento()], eventos: [], ordenes_compra: [] } satisfies Partial<Requerimiento>;
const BORRADOR = requerimiento({ ...COMPRA, id: 9, numero: 'FUR-000009', estado: 'BORRADOR' });
const ENVIADO = requerimiento({ ...COMPRA, id: 7, numero: 'FUR-000007', estado: 'ENVIADO' });
const COTIZADO = requerimiento({ ...COMPRA, id: 7, numero: 'FUR-000007', estado: 'COTIZADO' });
const APROBADO = requerimiento({ ...COMPRA, id: 6, numero: 'FUR-000006', estado: 'APROBADO', avance: 'SIN_ATENDER' });

const BOTONES = {
  guardar: 'Guardar borrador',
  enviar: 'Guardar y enviar',
  agregar: 'Agregar ítem',
  anular: 'Anular requerimiento',
  generarOc: 'Generar orden de compra',
  registrar: 'Registrar cotización',
  cerrar: 'Cerrar cuadro comparativo',
  reabrir: 'Reabrir cotizaciones',
};

type Modulos = Partial<Record<ClaveModulo, Partial<Permisos>>>;

function responderCon(r: Requerimiento | null, cotizaciones: Cotizacion[]) {
  return (req: HttpRequest<unknown>) => {
    if (r && req.url.endsWith(`/requerimientos/${r.id}`)) return r;
    if (req.url.endsWith('/cotizaciones')) return cotizaciones;
    return [];
  };
}

async function montar(acciones: Partial<Permisos>, r: Requerimiento | null = null, extra: Modulos = {}, cotizaciones: Cotizacion[] = []) {
  const p = await montarPantalla(
    RequerimientoFormComponent,
    misPermisos('Usuario', { requerimientos: acciones, ...extra }),
    responderCon(r, cotizaciones),
    [ruta(r ? String(r.id) : null)],
  );
  if (r) expect(p.el.textContent).toContain(r.numero);
  return p;
}

/** Responde las peticiones encadenadas tras una acción (recarga del FUR y de sus cotizaciones). */
async function vaciar(p: Pantalla<RequerimientoFormComponent>, r: Requerimiento, cotizaciones: Cotizacion[] = []) {
  const responder = responderCon(r, cotizaciones);
  for (let vuelta = 0; vuelta < 5; vuelta++) {
    await p.render();
    const pendientes = p.http.match(() => true);
    if (pendientes.length === 0) break;
    for (const req of pendientes) req.flush(responder(req.request));
  }
}

const hayTitulo = (el: HTMLElement, titulo: string) => el.querySelector(`button[title="${titulo}"]`) !== null;

describe('RequerimientoFormComponent: controles según permisos (requerimientos)', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.restoreAllMocks();
  });

  it('alta sin crear: aviso, formulario deshabilitado y sin botones de guardar ni de líneas', async () => {
    const { el } = await montar({});
    expect(el.querySelector('[data-testid="req-sin-permiso-crear"]')).not.toBeNull();
    expect(botonesVisibles(el, BOTONES)).toMatchObject({ guardar: false, enviar: false, agregar: false });
    expect(hayTitulo(el, 'Quitar línea')).toBe(false);
    expect(el.querySelector<HTMLTextAreaElement>('#req-justificacion')?.disabled).toBe(true);
  });

  it('alta con crear: formulario habilitado con Guardar borrador, Guardar y enviar y Agregar ítem', async () => {
    const { el } = await montar({ crear: true });
    expect(el.querySelector('[data-testid="req-sin-permiso-crear"]')).toBeNull();
    expect(botonesVisibles(el, BOTONES)).toMatchObject({ guardar: true, enviar: true, agregar: true });
    expect(hayTitulo(el, 'Quitar línea')).toBe(true);
    expect(el.querySelector<HTMLTextAreaElement>('#req-justificacion')?.disabled).toBe(false);
  });

  it('edición sin editar: BORRADOR en solo lectura (sin formulario ni botones de guardar); Anular sigue (basta ver)', async () => {
    const { el } = await montar({ crear: true }, BORRADOR);
    expect(el.querySelector('form.req-form')).toBeNull();
    expect(el.querySelector('dl.req-detail')).not.toBeNull();
    expect(botonesVisibles(el, BOTONES)).toMatchObject({ guardar: false, enviar: false, agregar: false, anular: true });
  });

  it('edición con editar: BORRADOR editable como antes', async () => {
    const { el } = await montar({ editar: true }, BORRADOR);
    expect(el.querySelector('form.req-form')).not.toBeNull();
    expect(el.querySelector('dl.req-detail')).toBeNull();
    expect(botonesVisibles(el, BOTONES)).toMatchObject({ guardar: true, enviar: true, agregar: true, anular: true });
    expect(el.querySelector<HTMLTextAreaElement>('#req-justificacion')?.disabled).toBe(false);
  });

  it('Anular con solo ver: envía la anulación', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const p = await montar({}, APROBADO);
    const boton = Array.from(p.el.querySelectorAll('button')).find((b) => b.textContent?.includes('Anular requerimiento'));
    boton?.click();
    const req = p.http.expectOne(`${environment.apiUrl}/requerimientos/6/anular`);
    expect(req.request.method).toBe('POST');
    const anulado = requerimiento({ ...APROBADO, estado: 'ANULADO' });
    req.flush(anulado);
    await vaciar(p, anulado);
    expect(botonesVisibles(p.el, BOTONES)['anular']).toBe(false);
  });

  it('Generar OC exige crear en documentos.origen (no basta verlo)', async () => {
    const soloVer = await montar({ crear: true, editar: true }, APROBADO, { 'documentos.origen': {} });
    expect(botonesVisibles(soloVer.el, BOTONES)['generarOc']).toBe(false);
    TestBed.resetTestingModule();

    const conCrear = await montar({}, APROBADO, { 'documentos.origen': { crear: true } });
    expect(botonesVisibles(conCrear.el, BOTONES)['generarOc']).toBe(true);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    Array.from(conCrear.el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Generar orden de compra'))
      ?.click();
    expect(navigate).toHaveBeenCalledWith(['/documentos/origen'], { queryParams: { requerimiento: 6 } });
  });

  it('cotizaciones con solo ver: sin Registrar, Editar ni Eliminar; Cerrar cuadro sigue (basta ver) y lo cierra', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const p = await montar({}, ENVIADO, {}, [cotizacion()]);
    expect(p.el.textContent).toContain('COT-000031');
    expect(botonesVisibles(p.el, BOTONES)).toMatchObject({ registrar: false, cerrar: true, reabrir: false });
    expect(hayTitulo(p.el, 'Editar')).toBe(false);
    expect(hayTitulo(p.el, 'Eliminar')).toBe(false);
    // El enlace de impresión del cuadro es libre.
    expect(p.el.querySelector('a[href*="cuadro-comparativo"]')).not.toBeNull();

    Array.from(p.el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Cerrar cuadro comparativo'))
      ?.click();
    p.http.expectOne(`${environment.apiUrl}/requerimientos/7/cerrar-cotizacion`).flush(COTIZADO);
    await vaciar(p, COTIZADO, [cotizacion()]);
  });

  it('cotizaciones: crear → Registrar; editar → Editar; eliminar → Eliminar', async () => {
    const conCrear = await montar({ crear: true }, ENVIADO, {}, [cotizacion()]);
    expect(botonesVisibles(conCrear.el, BOTONES)['registrar']).toBe(true);
    expect([hayTitulo(conCrear.el, 'Editar'), hayTitulo(conCrear.el, 'Eliminar')]).toEqual([false, false]);
    TestBed.resetTestingModule();

    const conEditar = await montar({ editar: true }, ENVIADO, {}, [cotizacion()]);
    expect(botonesVisibles(conEditar.el, BOTONES)['registrar']).toBe(false);
    expect([hayTitulo(conEditar.el, 'Editar'), hayTitulo(conEditar.el, 'Eliminar')]).toEqual([true, false]);
    TestBed.resetTestingModule();

    const conEliminar = await montar({ eliminar: true }, ENVIADO, {}, [cotizacion()]);
    expect(botonesVisibles(conEliminar.el, BOTONES)['registrar']).toBe(false);
    expect([hayTitulo(conEliminar.el, 'Editar'), hayTitulo(conEliminar.el, 'Eliminar')]).toEqual([false, true]);
  });

  it('cotizaciones con todos los permisos: igual que antes (Registrar, Editar, Eliminar y Cerrar)', async () => {
    const { el } = await montar({ crear: true, editar: true, eliminar: true }, ENVIADO, {}, [cotizacion()]);
    expect(botonesVisibles(el, BOTONES)).toMatchObject({ registrar: true, cerrar: true, reabrir: false });
    expect([hayTitulo(el, 'Editar'), hayTitulo(el, 'Eliminar')]).toEqual([true, true]);
  });

  it('Eliminar cotización con permiso: pide confirmación y la elimina', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const p = await montar({ eliminar: true }, ENVIADO, {}, [cotizacion()]);
    p.el.querySelector<HTMLButtonElement>('button[title="Eliminar"]')?.click();
    const req = p.http.expectOne(`${environment.apiUrl}/requerimientos/7/cotizaciones/31`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ deleted: true, id: 31 });
    await vaciar(p, ENVIADO);
  });

  it('Reabrir cotizaciones con solo ver (COTIZADO)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const p = await montar({}, COTIZADO, {}, [cotizacion()]);
    expect(botonesVisibles(p.el, BOTONES)).toMatchObject({ registrar: false, cerrar: false, reabrir: true });
    Array.from(p.el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Reabrir cotizaciones'))
      ?.click();
    p.http.expectOne(`${environment.apiUrl}/requerimientos/7/reabrir-cotizacion`).flush(ENVIADO);
    await vaciar(p, ENVIADO, [cotizacion()]);
  });

  it('el modal de cotización solo se abre con el permiso que corresponde', async () => {
    const p = await montar({ crear: true }, ENVIADO, {}, [cotizacion()]);
    Array.from(p.el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Registrar cotización'))
      ?.click();
    await p.render();
    expect(p.el.textContent).toContain('Guardar cotización');
  });
});

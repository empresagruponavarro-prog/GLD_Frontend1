import { TestBed } from '@angular/core/testing';
import { HttpRequest } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { environment } from '@env';
import { MemoryStorage, cargarPermisos, guardarSesion, misPermisos, providersPantalla } from '@app/core/auth/auth.testing';
import { botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { ClaveModulo, Permisos } from '@app/core/auth/permisos.models';
import { RutaDocumento } from '../almacen.service';
import { Documento, Paginated } from '../almacen.models';
import { DocumentosAlmacenComponent } from './documentos';

/** Módulo de cada ruta (`data.modulo` en `app.routes.ts`). */
const MODULO: Record<RutaDocumento, ClaveModulo> = {
  ingresos: 'almacen.ingresos',
  salidas: 'almacen.salidas',
  transferencias: 'almacen.transferencias',
  'inventario-inicial': 'almacen.inventario-inicial',
};

/** Ruta activa mínima con `data.tipo` y `data.modulo`, como la declara `rutaModulo`. */
function rutaDe(tipo: RutaDocumento) {
  const hoja = { data: { tipo, modulo: MODULO[tipo] } };
  return { provide: ActivatedRoute, useValue: { snapshot: { ...hoja, pathFromRoot: [hoja] } } };
}

/** Matriz con `acciones` en el módulo indicado (por defecto solo `ver`). */
function permisosEn(modulo: ClaveModulo, acciones: Partial<Permisos> = {}) {
  const modulos: Partial<Record<ClaveModulo, Partial<Permisos>>> = {};
  modulos[modulo] = acciones;
  return misPermisos('Almacenero', modulos);
}

/** Superficie protegida del componente que ejercita la prueba. */
interface Internals {
  form: {
    patchValue(value: Record<string, unknown>): void;
    controls: { lineas: { at(i: number): { patchValue(v: Record<string, unknown>): void } } };
  };
  formError(): string;
  openCreate(): void;
  save(): void;
}

/** Monta la pantalla de `tipo` con permiso de crear en su módulo y abre el formulario. */
async function setup(tipo: RutaDocumento) {
  const storage = new MemoryStorage();
  guardarSesion(storage, 'Almacenero');
  TestBed.configureTestingModule({ providers: [...providersPantalla(storage), rutaDe(tipo)] });
  await cargarPermisos(permisosEn(MODULO[tipo], { crear: true }));
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(DocumentosAlmacenComponent);
  // Descarta las cargas iniciales (catálogos y listado).
  http.match(() => true).forEach((r) => r.flush(r.request.url.endsWith('/select') ? [] : { data: [], page: 1, pageSize: 20, total: 0, totalPages: 0 }));
  const cmp = fixture.componentInstance as unknown as Internals;
  cmp.openCreate();
  return { http, cmp };
}

describe('DocumentosAlmacenComponent', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('no envía nada si falta el almacén', async () => {
    const { cmp } = await setup('ingresos');
    cmp.save();
    expect(cmp.formError()).toBe('Seleccione el almacén.');
  });

  it('exige producto y costo unitario en una compra', async () => {
    const { cmp } = await setup('ingresos');
    cmp.form.patchValue({ id_almacen: 1 });
    cmp.save();
    expect(cmp.formError()).toBe('Línea 1: seleccione un producto.');

    cmp.form.controls.lineas.at(0).patchValue({ id_producto: 10, cantidad: '5' });
    cmp.save();
    expect(cmp.formError()).toBe('Línea 1: el costo unitario es obligatorio.');
  });

  it('rechaza cantidades inválidas', async () => {
    const { cmp } = await setup('salidas');
    cmp.form.patchValue({ id_almacen: 1 });
    cmp.form.controls.lineas.at(0).patchValue({ id_producto: 10, cantidad: '0' });
    cmp.save();
    expect(cmp.formError()).toContain('la cantidad debe ser mayor a 0');
  });

  it('arma el payload de una compra sin campos vacíos', async () => {
    const { http, cmp } = await setup('ingresos');
    cmp.form.patchValue({ fecha: '2026-10-06', id_almacen: 1, id_proveedor: 7, documento_referencia: ' F001-0023 ' });
    cmp.form.controls.lineas.at(0).patchValue({ id_producto: 10, cantidad: ' 36 ', costo_unitario: '22' });
    cmp.save();

    const req = http.expectOne(`${environment.apiUrl}/almacen/ingresos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      fecha: '2026-10-06',
      motivo: 'COMPRA',
      id_almacen: 1,
      id_almacen_destino: undefined,
      documento_referencia: 'F001-0023',
      id_proveedor: 7,
      id_centro_costo: undefined,
      id_recibido_por: undefined,
      id_solicitado_por: undefined,
      id_entregado_a: undefined,
      motivo_trabajo: undefined,
      observaciones: undefined,
      lineas: [{ id_producto: 10, cantidad: '36', costo_unitario: '22', observaciones: undefined }],
    });
    req.flush({});
    http.match(() => true).forEach((r) => r.flush({ data: [], page: 1, pageSize: 20, total: 0, totalPages: 0 }));
  });

  it('en una salida no envía costo ni proveedor', async () => {
    const { http, cmp } = await setup('salidas');
    cmp.form.patchValue({ id_almacen: 1, id_proveedor: 99, id_solicitado_por: 3 });
    cmp.form.controls.lineas.at(0).patchValue({ id_producto: 10, cantidad: '2', costo_unitario: '50' });
    cmp.save();

    const req = http.expectOne(`${environment.apiUrl}/almacen/salidas`);
    expect(req.request.body.id_proveedor).toBeUndefined();
    expect(req.request.body.id_solicitado_por).toBe(3);
    expect(req.request.body.lineas[0].costo_unitario).toBeUndefined();
    req.flush({});
    http.match(() => true).forEach((r) => r.flush({ data: [], page: 1, pageSize: 20, total: 0, totalPages: 0 }));
  });

  it('en una transferencia el destino es obligatorio y distinto del origen', async () => {
    const { cmp } = await setup('transferencias');
    cmp.form.patchValue({ id_almacen: 1 });
    cmp.save();
    expect(cmp.formError()).toBe('Seleccione el almacén de destino.');

    cmp.form.patchValue({ id_almacen_destino: 1 });
    cmp.save();
    expect(cmp.formError()).toBe('El almacén de destino debe ser distinto del origen.');
  });

  it('el inventario inicial exige costo y usa su propia ruta', async () => {
    const { http, cmp } = await setup('inventario-inicial');
    cmp.form.patchValue({ id_almacen: 1 });
    cmp.form.controls.lineas.at(0).patchValue({ id_producto: 10, cantidad: '50' });
    cmp.save();
    expect(cmp.formError()).toBe('Línea 1: el costo unitario es obligatorio.');

    cmp.form.controls.lineas.at(0).patchValue({ costo_unitario: '20' });
    cmp.save();
    const req = http.expectOne(`${environment.apiUrl}/almacen/inventario-inicial`);
    expect(req.request.body.motivo).toBe('INVENTARIO_INICIAL');
    req.flush({});
    http.match(() => true).forEach((r) => r.flush({ data: [], page: 1, pageSize: 20, total: 0, totalPages: 0 }));
  });
});

const REGISTRADO: Documento = {
  id: 1,
  numero: 'DOC-000001',
  naturaleza: 'SALIDA',
  motivo: 'CONSUMO',
  fecha: '2026-10-01',
  id_almacen: 1,
  almacen: 'Almacén General',
  id_almacen_destino: null,
  almacen_destino: null,
  documento_referencia: null,
  id_proveedor: null,
  proveedor: null,
  id_centro_costo: null,
  centro_costo: null,
  id_recibido_por: null,
  recibido_por: null,
  id_solicitado_por: null,
  solicitado_por: null,
  id_entregado_a: null,
  entregado_a: null,
  motivo_trabajo: null,
  observaciones: null,
  estado: 'REGISTRADO',
  id_documento_anula: null,
  id_orden_compra: null,
  numero_oc: null,
  created_at: '2026-10-01T10:00:00Z',
  total_lineas: 1,
};

function responder(req: HttpRequest<unknown>) {
  if (req.url.endsWith('/select')) return [];
  const pagina: Paginated<Documento> = { data: [REGISTRADO], total: 1, page: 1, pageSize: 20, totalPages: 1 };
  return pagina;
}

async function montarPermisos(tipo: RutaDocumento, modulo: ClaveModulo, acciones: Partial<Permisos>) {
  const p = await montarPantalla(DocumentosAlmacenComponent, permisosEn(modulo, acciones), responder, [rutaDe(tipo)]);
  expect(p.el.textContent).toContain('DOC-000001');
  return p;
}

describe('DocumentosAlmacenComponent: botones según permisos (clave de la ruta)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const BOTONES = { nueva: 'Nueva salida', anular: 'Anular', detalle: 'Ver detalle' };

  it('con solo ver: solo "Ver detalle" (sin Nueva ni Anular)', async () => {
    const { el } = await montarPermisos('salidas', 'almacen.salidas', {});
    expect(botonesVisibles(el, BOTONES)).toEqual({ nueva: false, anular: false, detalle: true });
  });

  it('crear → Nueva salida; anular → Anular', async () => {
    expect(botonesVisibles((await montarPermisos('salidas', 'almacen.salidas', { crear: true })).el, BOTONES)).toEqual({
      nueva: true,
      anular: false,
      detalle: true,
    });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montarPermisos('salidas', 'almacen.salidas', { anular: true })).el, BOTONES)).toEqual({
      nueva: false,
      anular: true,
      detalle: true,
    });
  });

  it('la clave sale de data.modulo de la ruta: los permisos de otro módulo de almacén no cuentan', async () => {
    // Pantalla de Salidas con crear/anular solo en Entradas → nada de escritura.
    const { el } = await montarPermisos('salidas', 'almacen.ingresos', { crear: true, anular: true });
    expect(botonesVisibles(el, BOTONES)).toEqual({ nueva: false, anular: false, detalle: true });
  });

  it('cada ruta usa su módulo: Entradas e Inventario inicial (que también se anula)', async () => {
    const entradas = await montarPermisos('ingresos', 'almacen.ingresos', { crear: true });
    expect(botonesVisibles(entradas.el, { nueva: 'Nueva entrada', anular: 'Anular' })).toEqual({ nueva: true, anular: false });
    TestBed.resetTestingModule();
    const inicial = await montarPermisos('inventario-inicial', 'almacen.inventario-inicial', { anular: true });
    expect(botonesVisibles(inicial.el, { nuevo: 'Nuevo inventario inicial', anular: 'Anular' })).toEqual({ nuevo: false, anular: true });
  });

  it('sin crear, abrir el formulario no hace nada (defensa)', async () => {
    const { cmp, el, render } = await montarPermisos('salidas', 'almacen.salidas', {});
    (cmp as unknown as Internals).openCreate();
    await render();
    expect(el.querySelector('.doc-lines__add')).toBeNull();
  });
});

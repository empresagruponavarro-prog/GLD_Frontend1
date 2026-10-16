import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env';
import { MemoryStorage, cargarPermisos, guardarSesion, misPermisos, provideSesionStorage } from '@app/core/auth/auth.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { RecepcionPendiente } from '../almacen.models';
import { RecepcionesComponent } from './recepciones';

/** Superficie protegida del componente que ejercita la prueba. */
interface Internals {
  form: {
    patchValue(value: Record<string, unknown>): void;
    controls: { lineas: { at(i: number): { patchValue(v: Record<string, unknown>): void; getRawValue(): { cantidad: string } } } };
  };
  formError(): string;
  recibir(item: { id: number }): void;
  save(): void;
}

const api = `${environment.apiUrl}/almacen`;

const oc = (esSoles: boolean) => ({
  id: 12,
  id_oc: 'OC-12',
  numero_oc: '0012-2026',
  fecha_emision: null,
  id_proveedor: 3,
  proveedor: 'ACME',
  id_centro_costo: null,
  centro_costo: null,
  numero_requerimiento: 'FUR-000001',
  moneda_simbolo: esSoles ? 'S/' : '$',
  es_soles: esSoles,
  total: '300',
  lineas: [
    { id_detalle: 100, id_producto: 1, codigo: 'P-1', descripcion: 'Cemento', unidad: 'BLS', cantidad: '10', recibida: '4', saldo: '6', precio: '20' },
    { id_detalle: 101, id_producto: 2, codigo: 'P-2', descripcion: 'Arena', unidad: 'M3', cantidad: '5', recibida: '0', saldo: '5', precio: '50' },
  ],
  no_recibibles: [{ id_detalle: 102, descripcion: 'Flete', motivo: 'Servicio: no ingresa a almacén' }],
});

async function setup(esSoles = true) {
  const storage = new MemoryStorage();
  guardarSesion(storage, 'Almacenero');
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideSesionStorage(storage)] });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(RecepcionesComponent);
  await cargarPermisos(misPermisos('Almacenero', { 'almacen.recepciones': { crear: true } }));
  // Catálogos y listado inicial.
  http.match((r) => r.url.endsWith('/select')).forEach((r) => r.flush([]));
  http.expectOne((r) => r.url === `${api}/recepciones/pendientes`).flush([]);
  const cmp = fixture.componentInstance as unknown as Internals;
  cmp.recibir({ id: 12 });
  http.expectOne(`${api}/recepciones/orden-compra/12`).flush(oc(esSoles));
  return { http, cmp };
}

describe('RecepcionesComponent', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('precarga la cantidad a recibir con el saldo de cada línea', async () => {
    const { cmp } = await setup();
    expect(cmp.form.controls.lineas.at(0).getRawValue().cantidad).toBe('6');
    expect(cmp.form.controls.lineas.at(1).getRawValue().cantidad).toBe('5');
  });

  it('exige el almacén que recibe', async () => {
    const { cmp } = await setup();
    cmp.save();
    expect(cmp.formError()).toBe('Seleccione el almacén que recibe.');
  });

  it('no permite recibir más que el saldo', async () => {
    const { cmp } = await setup();
    cmp.form.patchValue({ id_almacen: 1 });
    cmp.form.controls.lineas.at(0).patchValue({ cantidad: '7' });
    cmp.save();
    expect(cmp.formError()).toContain('no puede recibir más del saldo (6)');
  });

  it('exige recibir al menos un producto', async () => {
    const { cmp } = await setup();
    cmp.form.patchValue({ id_almacen: 1 });
    cmp.form.controls.lineas.at(0).patchValue({ cantidad: '0' });
    cmp.form.controls.lineas.at(1).patchValue({ cantidad: '' });
    cmp.save();
    expect(cmp.formError()).toBe('Indique la cantidad recibida de al menos un producto.');
  });

  it('una OC en dólares exige tipo de cambio', async () => {
    const { cmp } = await setup(false);
    cmp.form.patchValue({ id_almacen: 1 });
    cmp.save();
    expect(cmp.formError()).toBe('La OC no está en soles: indique un tipo de cambio mayor a 0.');
  });

  it('envía solo las líneas con cantidad y el tipo de cambio cuando corresponde', async () => {
    const { http, cmp } = await setup(false);
    cmp.form.patchValue({ id_almacen: 1, fecha: '2026-10-11', tipo_cambio: ' 3.75 ', id_recibido_por: 8 });
    cmp.form.controls.lineas.at(1).patchValue({ cantidad: '0' });
    cmp.save();

    const req = http.expectOne(`${api}/recepciones`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      id_orden_compra: 12,
      id_almacen: 1,
      fecha: '2026-10-11',
      id_recibido_por: 8,
      tipo_cambio: '3.75',
      observaciones: undefined,
      lineas: [{ id_orden_compra_detalle: 100, cantidad: '6' }],
    });
    req.flush({ id: 40, numero: 'ING-000040' });
    http.expectOne((r) => r.url === `${api}/recepciones/pendientes`).flush([]);
  });

  it('muestra el error del servidor si la recepción falla', async () => {
    const { http, cmp } = await setup();
    cmp.form.patchValue({ id_almacen: 1 });
    cmp.save();
    http.expectOne(`${api}/recepciones`).flush({ message: 'supera el saldo por recibir' }, { status: 400, statusText: 'Bad Request' });
    expect(cmp.formError()).toBe('supera el saldo por recibir');
  });
});

describe('RecepcionesComponent: Recibir según permisos (almacen.recepciones)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const PENDIENTE: RecepcionPendiente = {
    id: 12,
    id_oc: 'OC-12',
    numero_oc: '0012-2026',
    fecha_emision: null,
    proveedor: 'ACME',
    id_centro_costo: null,
    centro_costo: null,
    numero_requerimiento: null,
    moneda_simbolo: 'S/',
    total: '300',
    lineas_pendientes: 2,
  };

  async function montar(acciones: Partial<Permisos>) {
    const p = await montarPantalla(
      RecepcionesComponent,
      misPermisos('Almacenero', { 'almacen.recepciones': acciones }),
      (req) => (req.url.endsWith('/recepciones/pendientes') ? [PENDIENTE] : []),
    );
    expect(p.el.textContent).toContain('ACME');
    return p;
  }

  it('con solo ver no aparece Recibir y recibir() no abre el modal', async () => {
    const { el, cmp, http } = await montar({});
    expect(botonesVisibles(el, { recibir: 'Recibir' })).toEqual({ recibir: false });
    const internos: Internals = cmp as unknown as Internals;
    internos.recibir({ id: 12 });
    http.expectNone(`${api}/recepciones/orden-compra/12`);
  });

  it('con crear aparece Recibir', async () => {
    const { el } = await montar({ crear: true });
    expect(botonesVisibles(el, { recibir: 'Recibir' })).toEqual({ recibir: true });
  });
});

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { environment } from '@env';
import { DocumentosAlmacenComponent } from './documentos';

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

function setup(tipo: string) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { data: { tipo } } } },
    ],
  });
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

  it('no envía nada si falta el almacén', () => {
    const { cmp } = setup('ingresos');
    cmp.save();
    expect(cmp.formError()).toBe('Seleccione el almacén.');
  });

  it('exige producto y costo unitario en una compra', () => {
    const { cmp } = setup('ingresos');
    cmp.form.patchValue({ id_almacen: 1 });
    cmp.save();
    expect(cmp.formError()).toBe('Línea 1: seleccione un producto.');

    cmp.form.controls.lineas.at(0).patchValue({ id_producto: 10, cantidad: '5' });
    cmp.save();
    expect(cmp.formError()).toBe('Línea 1: el costo unitario es obligatorio.');
  });

  it('rechaza cantidades inválidas', () => {
    const { cmp } = setup('salidas');
    cmp.form.patchValue({ id_almacen: 1 });
    cmp.form.controls.lineas.at(0).patchValue({ id_producto: 10, cantidad: '0' });
    cmp.save();
    expect(cmp.formError()).toContain('la cantidad debe ser mayor a 0');
  });

  it('arma el payload de una compra sin campos vacíos', () => {
    const { http, cmp } = setup('ingresos');
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

  it('en una salida no envía costo ni proveedor', () => {
    const { http, cmp } = setup('salidas');
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

  it('en una transferencia el destino es obligatorio y distinto del origen', () => {
    const { cmp } = setup('transferencias');
    cmp.form.patchValue({ id_almacen: 1 });
    cmp.save();
    expect(cmp.formError()).toBe('Seleccione el almacén de destino.');

    cmp.form.patchValue({ id_almacen_destino: 1 });
    cmp.save();
    expect(cmp.formError()).toBe('El almacén de destino debe ser distinto del origen.');
  });

  it('el inventario inicial exige costo y usa su propia ruta', () => {
    const { http, cmp } = setup('inventario-inicial');
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

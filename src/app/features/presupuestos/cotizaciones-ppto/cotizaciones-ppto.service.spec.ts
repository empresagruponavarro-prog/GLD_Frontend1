import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { Conciliacion, resumenConciliacion } from './cotizaciones-ppto.models';
import { CotizacionesPptoService } from './cotizaciones-ppto.service';

describe('CotizacionesPptoService', () => {
  let service: CotizacionesPptoService;
  let http: HttpTestingController;
  const api = `${environment.apiUrl}/presupuestos/7`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CotizacionesPptoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista las cotizaciones del presupuesto, con o sin filtro de fase', () => {
    service.getCotizaciones(7).subscribe();
    const todas = http.expectOne((r) => r.url === `${api}/cotizaciones`);
    expect(todas.request.params.has('id_detalle_fase')).toBe(false);
    todas.flush([]);

    service.getCotizaciones(7, 12).subscribe();
    const fase = http.expectOne((r) => r.url === `${api}/cotizaciones`);
    expect(fase.request.params.get('id_detalle_fase')).toBe('12');
    fase.flush([]);
  });

  it('crea, edita y elimina una cotización por la ruta del presupuesto', () => {
    const payload = { id_detalle_fase: 12, id_proveedor: 3, fecha: '2026-11-18', moneda_id: 'PEN', forma_pago: 'Contado', lineas: [] };
    service.createCotizacion(7, payload).subscribe();
    const crear = http.expectOne(`${api}/cotizaciones`);
    expect(crear.request.method).toBe('POST');
    expect(crear.request.body).toEqual(payload);
    crear.flush({});

    service.updateCotizacion(7, 5, { forma_pago: 'Credito 30' }).subscribe();
    const editar = http.expectOne(`${api}/cotizaciones/5`);
    expect(editar.request.method).toBe('PATCH');
    editar.flush({});

    service.deleteCotizacion(7, 5).subscribe();
    expect(http.expectOne(`${api}/cotizaciones/5`).request.method).toBe('DELETE');
  });

  it('el cuadro lleva la fase obligatoria; la adjudicación y los compromisos usan su ruta', () => {
    service.getCuadro(7, 12).subscribe();
    const cuadro = http.expectOne((r) => r.url === `${api}/cuadro-comparativo`);
    expect(cuadro.request.params.get('id_detalle_fase')).toBe('12');
    cuadro.flush({});

    service.adjudicar(7, { items: [{ id_ppto_item: 1, id_cot_detalle: null }], comentario: 'x' }).subscribe();
    const adj = http.expectOne(`${api}/adjudicacion`);
    expect(adj.request.method).toBe('PUT');
    expect(adj.request.body.items[0].id_cot_detalle).toBeNull(); // null explícito = quitar el ganador
    adj.flush({});

    service.getCompromisos(7).subscribe();
    expect(http.expectOne(`${api}/compromisos`).request.method).toBe('GET');
  });
});

describe('resumenConciliacion', () => {
  const vacio: Conciliacion = { creados: [], actualizados: [], anulados: [], sin_cambio: 0 };

  it('sin cambios o sin dato no dice nada', () => {
    expect(resumenConciliacion(undefined)).toBe('');
    expect(resumenConciliacion(vacio)).toBe('');
    expect(resumenConciliacion({ ...vacio, sin_cambio: 2 })).toBe('');
  });

  it('nombra los FUR y las órdenes que se generaron, actualizaron o anularon', () => {
    const texto = resumenConciliacion({
      creados: [{ id_requerimiento: 1, numero: 'FUR-000031', fase: 'F', id_proveedor: 2, proveedor: 'A', documentos: [{ id: 9, numero_documento: 'OC-000012', clase: 'ORDEN_COMPRA' }] }],
      actualizados: [{ id_requerimiento: 2, numero: 'FUR-000030', fase: 'F', id_proveedor: 3, proveedor: 'B', documentos: [] }],
      anulados: [{ id_requerimiento: 3, numero: 'FUR-000029' }],
      sin_cambio: 0,
    });
    expect(texto).toContain('1 FUR nuevo(s) (FUR-000031) y 1 orden(es): OC-000012');
    expect(texto).toContain('1 FUR actualizado(s) (FUR-000030)');
    expect(texto).toContain('1 FUR anulado(s) (FUR-000029)');
  });
});

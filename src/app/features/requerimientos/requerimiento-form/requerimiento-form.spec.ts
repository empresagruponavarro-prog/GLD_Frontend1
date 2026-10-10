import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { environment } from '@env';
import { RequerimientoFormComponent } from './requerimiento-form';

/** Superficie protegida del componente que ejercita la prueba. */
interface Internals {
  form: {
    patchValue(value: Record<string, unknown>): void;
    controls: { lineas: { at(i: number): { patchValue(v: Record<string, unknown>): void } } };
  };
  formError(): string;
  save(enviar?: boolean): void;
}

function setup(id: string | null = null) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(RequerimientoFormComponent);
  // Catálogos iniciales (centros de costos y trabajadores).
  http.match((r) => r.url.endsWith('/select')).forEach((r) => r.flush([]));
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

  it('exige centro de costos, solicitante y justificación', () => {
    const { cmp } = setup();
    cmp.save();
    expect(cmp.formError()).toBe('Seleccione el centro de costos.');

    cmp.form.patchValue({ id_centro_costo: 4 });
    cmp.save();
    expect(cmp.formError()).toBe('Seleccione al solicitante.');

    cmp.form.patchValue({ id_solicitante: 7 });
    cmp.save();
    expect(cmp.formError()).toBe('Indique la justificación del requerimiento.');
  });

  it('valida cada ítem antes de enviar', () => {
    const { cmp } = setup();
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

  it('crea el borrador con los valores limpios y abre su detalle', () => {
    const { http, navigate, cmp } = setup();
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
      area: undefined,
      justificacion: 'Reposición de materiales',
      lineas: [{ id_producto: 10, cantidad: '3', precio_referencial: undefined, observaciones: 'urgente' }],
    });
    req.flush({ id: 55, numero: 'FUR-000055', estado: 'BORRADOR' });
    expect(navigate).toHaveBeenCalledWith(['/requerimientos', 55]);
  });

  it('"Guardar y enviar" crea el borrador y luego lo envía a aprobación', () => {
    const { http, navigate, cmp } = setup();
    cmp.form.patchValue(valido);
    cmp.form.controls.lineas.at(0).patchValue({ id_producto: 10, cantidad: '3' });
    cmp.save(true);

    http.expectOne(`${environment.apiUrl}/requerimientos`).flush({ id: 55, numero: 'FUR-000055', estado: 'BORRADOR' });
    const enviar = http.expectOne(`${environment.apiUrl}/requerimientos/55/enviar`);
    expect(enviar.request.method).toBe('POST');
    enviar.flush({ id: 55, estado: 'ENVIADO' });
    expect(navigate).toHaveBeenCalledWith(['/requerimientos']);
  });

  it('muestra el mensaje del servidor si el guardado falla', () => {
    const { http, cmp } = setup();
    cmp.form.patchValue(valido);
    cmp.form.controls.lineas.at(0).patchValue({ id_producto: 10, cantidad: '3' });
    cmp.save();
    http.expectOne(`${environment.apiUrl}/requerimientos`).flush({ message: 'Producto 10 no encontrado' }, { status: 400, statusText: 'Bad Request' });
    expect(cmp.formError()).toBe('Producto 10 no encontrado');
  });

  it('carga un requerimiento existente y lo guarda con PATCH', () => {
    const { http, cmp } = setup('9');
    http.expectOne(`${environment.apiUrl}/requerimientos/9`).flush({
      id: 9,
      numero: 'FUR-000009',
      fecha: '2026-10-10',
      fecha_requerida: null,
      id_centro_costo: 4,
      id_fase: null,
      id_solicitante: 7,
      area: null,
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
});

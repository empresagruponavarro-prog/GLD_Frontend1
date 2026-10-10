import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env';
import { RequerimientosService } from './requerimientos.service';
import { avanceBadge, esEditable, estadoBadge } from './requerimientos.utils';

describe('RequerimientosService', () => {
  let service: RequerimientosService;
  let http: HttpTestingController;
  const api = `${environment.apiUrl}/requerimientos`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RequerimientosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('omite filtros vacíos al listar', () => {
    service.getAll({ page: 2, estado: 'APROBADO', search: '', desde: undefined }).subscribe();
    const req = http.expectOne((r) => r.url === api);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('estado')).toBe('APROBADO');
    expect(req.request.params.has('search')).toBe(false);
    expect(req.request.params.has('desde')).toBe(false);
    req.flush({ data: [], page: 2, pageSize: 20, total: 0, totalPages: 0 });
  });

  it('usa un endpoint por cada transición del flujo', () => {
    service.enviar(5).subscribe();
    expect(http.expectOne(`${api}/5/enviar`).request.method).toBe('POST');

    service.observar(5, 9, 'Falta detalle').subscribe();
    const observar = http.expectOne(`${api}/5/observar`);
    expect(observar.request.body).toEqual({ id_aprobador: 9, comentario: 'Falta detalle' });

    service.aprobar(5, { id_aprobador: 9, lineas: [{ id_detalle: 1, cantidad_aprobada: '3' }] }).subscribe();
    const aprobar = http.expectOne(`${api}/5/aprobar`);
    expect(aprobar.request.body.lineas).toEqual([{ id_detalle: 1, cantidad_aprobada: '3' }]);

    service.rechazar(5, 9, 'Sin presupuesto').subscribe();
    expect(http.expectOne(`${api}/5/rechazar`).request.body).toEqual({ id_aprobador: 9, comentario: 'Sin presupuesto' });

    service.anular(5).subscribe();
    expect(http.expectOne(`${api}/5/anular`).request.method).toBe('POST');

    http.match(() => true).forEach((r) => r.flush({}));
  });

  it('consulta los requerimientos pendientes de generar OC', () => {
    service.getPendientesOc().subscribe();
    const req = http.expectOne(`${api}/pendientes-oc`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('busca en el catálogo por código y descripción y une los resultados sin repetir', () => {
    let resultado: number[] = [];
    service.buscarCatalogo('cem').subscribe((items) => (resultado = items.map((i) => i.id)));
    const url = `${environment.apiUrl}/maestros/producto`;
    const porCodigo = http.expectOne((r) => r.url === url && r.params.has('codigo'));
    const porDescripcion = http.expectOne((r) => r.url === url && r.params.has('descripcion'));
    expect(porCodigo.request.params.get('codigo')).toBe('cem');
    expect(porDescripcion.request.params.get('descripcion')).toBe('cem');
    expect(porCodigo.request.params.get('estado')).toBe('true');
    const item = (id: number, tipo: 'PRODUCTO' | 'SERVICIO') => ({ id, codigo: `C${id}`, descripcion: `D${id}`, tipo_producto: tipo });
    const page = (data: ReturnType<typeof item>[]) => ({ data, page: 1, pageSize: 10, total: data.length, totalPages: 1 });
    porCodigo.flush(page([item(1, 'PRODUCTO'), item(2, 'SERVICIO')]));
    porDescripcion.flush(page([item(2, 'SERVICIO'), item(3, 'PRODUCTO')]));
    expect(resultado).toEqual([1, 2, 3]);
  });
});

describe('requerimientos.utils', () => {
  it('solo BORRADOR y OBSERVADO son editables', () => {
    expect(esEditable('BORRADOR')).toBe(true);
    expect(esEditable('OBSERVADO')).toBe(true);
    for (const estado of ['ENVIADO', 'APROBADO', 'RECHAZADO', 'ANULADO'] as const) expect(esEditable(estado)).toBe(false);
  });

  it('asigna un badge por estado y avance', () => {
    expect(estadoBadge('APROBADO')).toBe('badge-completed');
    expect(estadoBadge('ENVIADO')).toBe('badge-pending');
    expect(estadoBadge('RECHAZADO')).toBe('badge-danger');
    expect(estadoBadge('BORRADOR')).toBe('badge-progress');
    expect(avanceBadge('ATENDIDO')).toBe('badge-completed');
    expect(avanceBadge('PARCIAL')).toBe('badge-pending');
    expect(avanceBadge('SIN_ATENDER')).toBe('badge-progress');
  });
});

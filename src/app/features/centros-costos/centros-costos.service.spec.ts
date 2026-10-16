import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env';
import { CentrosCostosService } from './centros-costos.service';

describe('CentrosCostosService', () => {
  let service: CentrosCostosService;
  let http: HttpTestingController;
  const api = `${environment.apiUrl}/centros-costos`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CentrosCostosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envía página, filtros y grupo de estado; omite vacíos y TODOS', () => {
    service
      .getAll(3, 50, { search: ' obra ', empresa: 'GLD', cliente: '', pptoEstado: 'TODOS', pptoEstadoGrupo: 'cierre' })
      .subscribe();

    const req = http.expectOne((r) => r.url === api);
    const p = req.request.params;
    expect(p.get('page')).toBe('3');
    expect(p.get('pageSize')).toBe('50');
    expect(p.get('search')).toBe('obra');
    expect(p.get('empresa')).toBe('GLD');
    expect(p.get('pptoEstadoGrupo')).toBe('cierre');
    expect(p.has('cliente')).toBe(false);
    expect(p.has('pptoEstado')).toBe(false);
    req.flush({ data: [], page: 3, pageSize: 50, total: 0, totalPages: 0 });
  });

  it('normaliza la respuesta paginada y la lista sin paginar', () => {
    let paginada: unknown;
    service.getAll(1, 20).subscribe((r) => (paginada = r));
    http.expectOne((r) => r.url === api).flush({ data: [{ id: 1, CentroCosto: 'Obra A' }], total: 41, page: 2 });
    expect(paginada).toEqual({ data: [{ id: 1, CentroCosto: 'Obra A' }], total: 41, page: 2, pageSize: 20, totalPages: 3 });

    let lista: unknown;
    service.getAll(2, 1).subscribe((r) => (lista = r));
    http.expectOne((r) => r.url === api).flush([{ CentroCosto: 'A' }, { CentroCosto: 'B' }, { CentroCosto: 'C' }]);
    expect(lista).toEqual({ data: [{ CentroCosto: 'B' }], total: 3, page: 2, pageSize: 1, totalPages: 3 });

    let vacia: unknown;
    service.getAll(1, 20).subscribe((r) => (vacia = r));
    http.expectOne((r) => r.url === api).flush(null);
    expect(vacia).toEqual({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 });
  });

  it('pide las métricas de presupuestos de todos los centros de costos', () => {
    let resultado: unknown;
    service.getMetricasPresupuestos().subscribe((r) => (resultado = r));

    const metricas = { total: 3, abiertos: 1, enCierre: 1, cerrados: 1, totalPortafolio: 10 };
    http.expectOne(`${api}/metricas/presupuestos`).flush(metricas);
    expect(resultado).toEqual(metricas);
  });
});

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env';
import { AlmacenService } from './almacen.service';

describe('AlmacenService', () => {
  let service: AlmacenService;
  let http: HttpTestingController;
  const api = `${environment.apiUrl}/almacen`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AlmacenService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('omite filtros vacíos al listar documentos', () => {
    service.getDocumentos('ingresos', { page: 2, desde: '', id_almacen: 1, motivo: undefined }).subscribe();
    const req = http.expectOne((r) => r.url === `${api}/ingresos`);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('id_almacen')).toBe('1');
    expect(req.request.params.has('desde')).toBe(false);
    expect(req.request.params.has('motivo')).toBe(false);
    req.flush({ data: [], page: 2, pageSize: 20, total: 0, totalPages: 0 });
  });

  it('registra un documento por POST y lo anula por /anular', () => {
    service
      .createDocumento('salidas', { fecha: '2026-10-06', motivo: 'CONSUMO', id_almacen: 1, lineas: [{ id_producto: 1, cantidad: '2' }] })
      .subscribe();
    const create = http.expectOne(`${api}/salidas`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body.lineas).toHaveLength(1);
    create.flush({});

    service.anularDocumento('salidas', 7).subscribe();
    const anular = http.expectOne(`${api}/salidas/7/anular`);
    expect(anular.request.method).toBe('POST');
    anular.flush({});
  });

  it('registra retornos de un préstamo', () => {
    service
      .registrarRetorno(3, { fecha_retorno: '2026-10-10', retornos: [{ id_prestamo_detalle: 9, cantidad: '1', condicion: 'DANADO' }] })
      .subscribe();
    const req = http.expectOne(`${api}/prestamos/3/retornos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.retornos[0].condicion).toBe('DANADO');
    req.flush({});
  });

  it('consulta stock, compra sugerida y marca operativo', () => {
    service.getStock({ q: 'sika', incluir_sin_stock: true }).subscribe();
    const stock = http.expectOne((r) => r.url === `${api}/stock`);
    expect(stock.request.params.get('q')).toBe('sika');
    expect(stock.request.params.get('incluir_sin_stock')).toBe('true');
    stock.flush({ data: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });

    service.getCompraSugerida().subscribe();
    http.expectOne(`${api}/stock/compra-sugerida`).flush({ data: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });

    service.marcarOperativo(5, 1, '2').subscribe();
    const op = http.expectOne(`${api}/stock/5/1/operativo`);
    expect(op.request.method).toBe('PATCH');
    expect(op.request.body).toEqual({ cantidad: '2' });
    op.flush(null);
  });

  it('pide anexos por tipo para proveedores y trabajadores', () => {
    service.getProveedoresSelect().subscribe();
    expect(http.expectOne((r) => r.url.endsWith('/maestros/anexo/select')).request.params.get('tipoAnexo')).toBe('Proveedor');
    http.match(() => true).forEach((r) => r.flush([]));
    service.getTrabajadoresSelect().subscribe();
    expect(http.expectOne((r) => r.url.endsWith('/maestros/anexo/select')).request.params.get('tipoAnexo')).toBe('Trabajador');
    http.match(() => true).forEach((r) => r.flush([]));
  });
});

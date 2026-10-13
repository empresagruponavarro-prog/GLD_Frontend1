import { TestBed } from '@angular/core/testing';
import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env';
import { ObraService } from './obra.service';

describe('ObraService (documentos)', () => {
  let service: ObraService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/operaciones/obra/7/documentos`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ObraService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sube el archivo como multipart con reportProgress', () => {
    const file = new File(['contenido'], 'acta.pdf', { type: 'application/pdf' });
    const eventos: HttpEventType[] = [];
    service.subirArchivoDocumento(7, file).subscribe((ev) => eventos.push(ev.type));

    const req = http.expectOne(`${base}/archivo`);
    expect(req.request.method).toBe('POST');
    expect(req.request.reportProgress).toBe(true);
    const body = req.request.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect((body.get('archivo') as File).name).toBe('acta.pdf');

    req.event({ type: HttpEventType.UploadProgress, loaded: 5, total: 10 });
    req.flush({ archivo_url: 'k/ab12cd34_acta.pdf', nombre_original: 'acta.pdf', bytes: 9 });
    expect(eventos).toContain(HttpEventType.UploadProgress);
    expect(eventos).toContain(HttpEventType.Response);
  });

  it('descarta un archivo subido enviando la clave como query param', () => {
    service.descartarArchivoDocumento(7, 'k/ab12cd34_acta.pdf').subscribe();
    const req = http.expectOne((r) => r.url === `${base}/archivo`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.get('clave')).toBe('k/ab12cd34_acta.pdf');
    req.flush({ deleted: true, clave: 'k/ab12cd34_acta.pdf' });
  });

  it('descarga el archivo como blob, con o sin inline', () => {
    let blob: Blob | undefined;
    service.descargarArchivoDocumento(7, 3).subscribe((b) => (blob = b));
    const normal = http.expectOne(`${base}/3/archivo`);
    expect(normal.request.method).toBe('GET');
    expect(normal.request.responseType).toBe('blob');
    normal.flush(new Blob(['x']));
    expect(blob).toBeInstanceOf(Blob);

    service.descargarArchivoDocumento(7, 3, true).subscribe();
    const inline = http.expectOne(`${base}/3/archivo?inline=1`);
    expect(inline.request.responseType).toBe('blob');
    inline.flush(new Blob(['x']));
  });

  it('actualiza enviando null para limpiar campos opcionales', () => {
    service.updateDocumento(7, 3, { subtitulo: null, archivo_url: null, titulo: 'Nuevo' }).subscribe();
    const req = http.expectOne(`${base}/3`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ subtitulo: null, archivo_url: null, titulo: 'Nuevo' });
    req.flush({});
  });
});

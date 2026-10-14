import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ObraDocumento } from '../../obra.interface';
import { DocumentoVistaDialogComponent } from './documento-vista-dialog';

const doc = (archivo_url: string | undefined, over: Partial<ObraDocumento> = {}): ObraDocumento => ({
  id: 7,
  titulo: 'Acta de entrega',
  subtitulo: 'Entrega del predio',
  categoria: 'Acta',
  estado: 'Validado',
  nro_registro: 'ACT-004',
  fecha_emision: '2026-09-18',
  archivo_url,
  created_at: '2026-09-18',
  ...over,
});

const URL_ARCHIVO = (id = 7) => (r: { method: string; url: string }) =>
  r.method === 'GET' && r.url.includes(`/operaciones/obra/10/documentos/${id}/archivo`);

describe('DocumentoVistaDialogComponent', () => {
  let fixture: ComponentFixture<DocumentoVistaDialogComponent>;
  let http: HttpTestingController;
  let crear: ReturnType<typeof vi.fn>;
  let revocar: ReturnType<typeof vi.fn>;
  const originales = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL };

  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => el().textContent?.replace(/\s+/g, ' ') ?? '';

  const abrir = (documento: ObraDocumento) => {
    fixture.componentRef.setInput('idCentroCosto', 10);
    fixture.componentRef.setInput('documento', documento);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
  };

  const responder = (peticion: TestRequest, blob: Blob) => {
    peticion.flush(blob);
    fixture.detectChanges();
  };

  beforeEach(() => {
    crear = vi.fn(() => 'blob:prueba');
    revocar = vi.fn();
    Object.assign(URL, { createObjectURL: crear, revokeObjectURL: revocar });
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    fixture = TestBed.createComponent(DocumentoVistaDialogComponent);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    Object.assign(URL, { createObjectURL: originales.crear, revokeObjectURL: originales.revocar });
    vi.restoreAllMocks();
  });

  it('muestra los datos del documento', () => {
    abrir(doc(undefined));

    expect(texto()).toContain('Acta de entrega');
    expect(texto()).toContain('Entrega del predio');
    expect(texto()).toContain('ACT-004');
    expect(texto()).toContain('18/09/2026');
    expect(texto()).toContain('Permanente');
    expect(texto()).toContain('Validado');
  });

  it('un PDF se pide inline y se muestra en un iframe', () => {
    abrir(doc('obras/10/documentos/1a2b3c4d_Acta.pdf'));
    expect(texto()).toContain('Cargando vista previa');

    const req = http.expectOne(URL_ARCHIVO());
    expect(req.request.responseType).toBe('blob');
    expect(req.request.urlWithParams).toContain('inline=1');
    responder(req, new Blob(['%PDF'], { type: 'application/octet-stream' }));

    const iframe = el().querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('title')).toBe('Vista previa de Acta de entrega');
    // El tipo se fija por la extensión, sin depender del servidor.
    expect(crear.mock.calls[0][0].type).toBe('application/pdf');
    expect(texto()).toContain('Abrir en pestaña nueva');
    expect(texto()).toContain('Descargar');
  });

  it.each([
    ['foto.png', 'image/png'],
    ['foto.JPG', 'image/jpeg'],
    ['foto.jpeg', 'image/jpeg'],
  ])('una imagen (%s) se muestra con <img>', (nombre, tipo) => {
    abrir(doc(`obras/10/documentos/1a2b3c4d_${nombre}`));

    responder(http.expectOne(URL_ARCHIVO()), new Blob(['x']));

    const img = el().querySelector('img');
    expect(img?.getAttribute('src')).toBe('blob:prueba');
    expect(img?.getAttribute('alt')).toBe('Vista previa de Acta de entrega');
    expect(crear.mock.calls[0][0].type).toBe(tipo);
  });

  it.each(['metrado.xlsx', 'presentacion.pptx', 'planos.zip', 'antiguo.doc'])(
    '%s no se previsualiza: avisa y ofrece descargar sin pedir el archivo',
    (nombre) => {
      abrir(doc(`obras/10/documentos/1a2b3c4d_${nombre}`));

      http.expectNone(() => true);
      expect(texto()).toContain('no se pueden previsualizar en el navegador');
      expect(el().querySelector('iframe')).toBeNull();
      expect(el().querySelector('#btn-vista-descargar')).not.toBeNull();
    },
  );

  it('un Word (.docx) se pide inline y se prepara el contenedor de vista previa', () => {
    abrir(doc('obras/10/documentos/1a2b3c4d_memoria.docx'));

    const req = http.expectOne(URL_ARCHIVO());
    expect(req.request.urlWithParams).toContain('inline=1');
    responder(req, new Blob(['docx']));

    expect(el().querySelector('#docx-preview-container')).not.toBeNull();
    expect(crear.mock.calls[0][0].type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(texto()).not.toContain('no se pueden previsualizar');
  });

  it('un Word dañado que no se puede renderizar muestra el error de vista previa', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    abrir(doc('obras/10/documentos/1a2b3c4d_memoria.docx'));
    responder(http.expectOne(URL_ARCHIVO()), new Blob(['esto no es un docx']));

    await new Promise((r) => setTimeout(r, 300));
    fixture.detectChanges();

    expect(texto()).toContain('No se pudo cargar la vista previa');
  });

  it('un enlace externo no se pide al servidor y se abre en pestaña nueva con noopener', () => {
    const abrirVentana = vi.spyOn(window, 'open').mockReturnValue(null);
    abrir(doc('https://drive.example.com/doc'));

    http.expectNone(() => true);
    expect(texto()).toContain('enlace externo');
    expect(texto()).toContain('https://drive.example.com/doc');
    expect(el().querySelector('#btn-vista-descargar')).toBeNull();

    const boton = [...el().querySelectorAll('button')].find((b) => b.textContent?.includes('Abrir en pestaña nueva'));
    boton?.click();
    expect(abrirVentana).toHaveBeenCalledWith('https://drive.example.com/doc', '_blank', 'noopener');
  });

  it('un documento sin archivo lo indica', () => {
    abrir(doc(undefined));

    http.expectNone(() => true);
    expect(texto()).toContain('no tiene un archivo adjunto');
    expect(el().querySelector('#btn-vista-descargar')).toBeNull();
  });

  it('si falla la carga muestra el error y Reintentar vuelve a pedirlo', () => {
    abrir(doc('obras/10/documentos/1a2b3c4d_Acta.pdf'));
    http.expectOne(URL_ARCHIVO()).flush(new Blob(['error']), { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(texto()).toContain('No se pudo cargar la vista previa');

    const reintentar = [...el().querySelectorAll('button')].find((b) => b.textContent?.includes('Reintentar'));
    reintentar?.click();
    fixture.detectChanges();

    responder(http.expectOne(URL_ARCHIVO()), new Blob(['%PDF']));
    expect(el().querySelector('iframe')).not.toBeNull();
  });

  it('Descargar reutiliza el archivo ya cargado, sin volver a pedirlo', () => {
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    abrir(doc('obras/10/documentos/1a2b3c4d_Acta.pdf'));
    responder(http.expectOne(URL_ARCHIVO()), new Blob(['%PDF']));

    (el().querySelector('#btn-vista-descargar') as HTMLButtonElement).click();

    http.expectNone(() => true);
    expect(clic).toHaveBeenCalledTimes(1);
  });

  it('Descargar un formato sin vista previa pide el archivo como adjunto', () => {
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    abrir(doc('obras/10/documentos/1a2b3c4d_metrado.xlsx'));

    (el().querySelector('#btn-vista-descargar') as HTMLButtonElement).click();

    const req = http.expectOne(URL_ARCHIVO());
    expect(req.request.urlWithParams).not.toContain('inline');
    req.flush(new Blob(['docx']));
    expect(clic).toHaveBeenCalledTimes(1);
  });

  it('un error al descargar muestra un aviso', () => {
    abrir(doc('obras/10/documentos/1a2b3c4d_metrado.xlsx'));

    (el().querySelector('#btn-vista-descargar') as HTMLButtonElement).click();
    http.expectOne(URL_ARCHIVO()).flush(new Blob(['x']), { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(texto()).toContain('No se pudo descargar el archivo');
  });

  it('al cerrar se libera el archivo cargado', () => {
    abrir(doc('obras/10/documentos/1a2b3c4d_Acta.pdf'));
    responder(http.expectOne(URL_ARCHIVO()), new Blob(['%PDF']));

    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();
    TestBed.tick();

    expect(revocar).toHaveBeenCalledWith('blob:prueba');
  });

  it('cerrar mientras carga cancela la petición', () => {
    abrir(doc('obras/10/documentos/1a2b3c4d_Acta.pdf'));
    const req = http.expectOne(URL_ARCHIVO());

    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();
    TestBed.tick();

    expect(req.cancelled).toBe(true);
  });

  it('Escape y el botón Cerrar emiten closed', () => {
    const cerrado = vi.fn();
    fixture.componentInstance.closed.subscribe(cerrado);
    abrir(doc(undefined));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    (el().querySelector('#btn-vista-cerrar') as HTMLButtonElement).click();

    expect(cerrado).toHaveBeenCalledTimes(2);
  });
});

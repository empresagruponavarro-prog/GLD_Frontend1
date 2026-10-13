import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ObraDocumento } from '../../obra.interface';
import { DocumentoDialogComponent } from './documento-dialog';

const guardado: ObraDocumento = {
  id: 7,
  titulo: 'Licencia',
  categoria: 'Permiso',
  estado: 'Observado',
  fecha_emision: '2026-03-02',
  created_at: '2026-03-02',
};

interface Dialogo {
  form: {
    getRawValue(): Record<string, string>;
    controls: { fecha_emision: { invalid: boolean }; titulo: { invalid: boolean } };
  };
  onSoltar(ev: DragEvent): void;
  archivoError(): string;
}

describe('DocumentoDialogComponent', () => {
  let fixture: ComponentFixture<DocumentoDialogComponent>;
  let http: HttpTestingController;

  const dialogo = () => fixture.componentInstance as unknown as Dialogo;
  const texto = () => (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';

  const abrir = (documento: ObraDocumento | null, nombreObra = '') => {
    fixture.componentRef.setInput('idCentroCosto', 10);
    fixture.componentRef.setInput('nombreObra', nombreObra);
    fixture.componentRef.setInput('documento', documento);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    return dialogo().form.getRawValue();
  };

  const soltar = (archivo: File) =>
    dialogo().onSoltar({ preventDefault: () => undefined, dataTransfer: { files: [archivo] } } as unknown as DragEvent);

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    fixture = TestBed.createComponent(DocumentoDialogComponent);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => vi.useRealTimers());

  describe('valores por defecto', () => {
    it('un documento nuevo nace Pendiente y con la emisión de hoy (hora de Lima)', () => {
      // 14-oct 03:30 UTC = 13-oct 22:30 en Lima.
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-14T03:30:00Z'));

      const v = abrir(null);

      expect(v['estado']).toBe('Pendiente');
      expect(v['fecha_emision']).toBe('2026-10-13');
    });

    it('al editar se respeta el estado y la fecha guardados', () => {
      const v = abrir(guardado);

      expect(v['estado']).toBe('Observado');
      expect(v['fecha_emision']).toBe('2026-03-02');
    });

    it('al editar un documento sin fecha no se inventa una', () => {
      const v = abrir({ ...guardado, fecha_emision: undefined });

      expect(v['fecha_emision']).toBe('');
    });
  });

  describe('cabecera y etiquetas', () => {
    it('muestra el centro de costo y la obra', () => {
      abrir(null, 'Tambo VES');

      expect(texto()).toContain('# CC-10: Tambo VES');
      expect(texto()).toContain('Anexar documento técnico / acta');
    });

    it('sin nombre de obra solo muestra el código', () => {
      abrir(null);

      expect(texto()).toContain('# CC-10');
      expect(texto()).not.toContain('# CC-10:');
    });

    it('al editar cambia el título', () => {
      abrir(guardado);

      expect(texto()).toContain('Editar documento técnico / acta');
    });

    it('las categorías y los estados tienen etiquetas descriptivas, con el valor del backend', () => {
      abrir(null);
      const el = fixture.nativeElement as HTMLElement;
      const opciones = (id: string) =>
        [...el.querySelectorAll<HTMLOptionElement>(`#${id} option`)].map((o) => [o.value, o.textContent?.trim()]);

      expect(opciones('doc-categoria')).toContainEqual(['Acta', 'Acta Oficial']);
      expect(opciones('doc-categoria')).toContainEqual(['Seguridad', 'Seguridad y Salud (SST)']);
      expect(opciones('doc-estado')).toContainEqual(['Validado', 'Validado por Supervisión Técnica']);
      expect(opciones('doc-estado')).toContainEqual(['Pendiente', 'Pendiente de validación']);
    });
  });

  describe('validación', () => {
    it('la fecha de emisión es obligatoria', () => {
      abrir({ ...guardado, fecha_emision: undefined });
      expect(dialogo().form.controls.fecha_emision.invalid).toBe(true);

      abrir(null);
      expect(dialogo().form.controls.fecha_emision.invalid).toBe(false);
    });

    it('el título es obligatorio', () => {
      abrir(null);

      expect(dialogo().form.controls.titulo.invalid).toBe(true);
    });
  });

  describe('archivo', () => {
    it('sin archivo ofrece seleccionar uno', () => {
      abrir(null);

      expect(texto()).toContain('Arrastra un archivo aquí o');
      expect(texto()).toContain('Seleccionar archivo');
      expect(texto()).toContain('Máx. 50 MB');
    });

    it('con archivo guardado muestra la tarjeta con su nombre, tipo y botón Reemplazar', () => {
      abrir({ ...guardado, archivo_url: 'obras/10/documentos/1a2b3c4d_Acta_entrega.pdf' });
      const el = fixture.nativeElement as HTMLElement;

      expect(el.querySelector('#doc-archivo-nombre')?.textContent?.trim()).toBe('Acta_entrega.pdf');
      expect(el.querySelector('.material-symbols-outlined')).not.toBeNull();
      expect(texto()).toContain('PDF');
      expect(texto()).toContain('Archivo adjunto a este documento');
      expect(texto()).toContain('Reemplazar');
      expect(el.querySelector('[aria-label="Ver archivo"]')).not.toBeNull();
      expect(el.querySelector('[aria-label="Descargar archivo"]')).not.toBeNull();
    });

    it('con un enlace externo muestra el campo de enlace y no la tarjeta', () => {
      abrir({ ...guardado, archivo_url: 'https://drive.example.com/doc' });
      const el = fixture.nativeElement as HTMLElement;

      expect((el.querySelector('#doc-enlace') as HTMLInputElement).value).toBe('https://drive.example.com/doc');
      expect(el.querySelector('#doc-archivo-nombre')).toBeNull();
    });

    it('arrastrar un archivo con formato no permitido muestra el error y no sube nada', () => {
      abrir(null);

      soltar(new File(['MZ'], 'virus.exe'));
      fixture.detectChanges();

      expect(dialogo().archivoError()).toContain('Formato no permitido');
      expect(texto()).toContain('Formato no permitido');
      http.expectNone(() => true);
    });

    it('arrastrar un archivo permitido lo sube al backend', () => {
      abrir(null);

      soltar(new File(['%PDF'], 'acta.pdf', { type: 'application/pdf' }));

      const req = http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/operaciones/obra/10/documentos/archivo'));
      expect((req.request.body as FormData).get('archivo')).toBeInstanceOf(File);
    });

    it('quitar el archivo vuelve a la zona de carga', () => {
      abrir({ ...guardado, archivo_url: 'obras/10/documentos/1a2b3c4d_Acta.pdf' });
      const el = fixture.nativeElement as HTMLElement;

      (el.querySelector('[aria-label="Quitar archivo"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(texto()).toContain('Seleccionar archivo');
      expect(el.querySelector('#doc-archivo-nombre')).toBeNull();
    });
  });
});

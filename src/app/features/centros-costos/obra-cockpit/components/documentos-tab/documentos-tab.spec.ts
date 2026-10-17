import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocumentosTabComponent } from './documentos-tab';
import { ObraDocumento } from '../../obra.interface';
import { hayBoton } from '@app/core/auth/pantalla.testing';
import { TODOS_PERMISOS_OBRA, montar, permisosObra } from '../../obra-cockpit.testing';

const doc = (over: Partial<ObraDocumento>): ObraDocumento => ({
  id: 1,
  titulo: 'Acta',
  categoria: 'Acta',
  estado: 'Validado',
  created_at: '2026-01-01',
  ...over,
});

describe('DocumentosTabComponent', () => {
  let fixture: ComponentFixture<DocumentosTabComponent>;
  let el: HTMLElement;

  const docs = [
    doc({ id: 1, titulo: 'Acta de entrega', archivo_url: 'k/ab12cd34_acta.pdf' }),
    doc({ id: 2, titulo: 'Licencia municipal', categoria: 'Permiso', estado: 'Pendiente' }),
  ];

  const filas = () => el.querySelectorAll('tbody tr');
  const escribir = (selector: string, valor: string, evento: 'input' | 'change') => {
    const campo = el.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
    campo.value = valor;
    campo.dispatchEvent(new Event(evento));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DocumentosTabComponent] }).compileComponents();
    fixture = TestBed.createComponent(DocumentosTabComponent);
    el = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('documentos', docs);
    fixture.componentRef.setInput('permisos', TODOS_PERMISOS_OBRA);
    fixture.detectChanges();
  });

  it('muestra todos los documentos y el contador N de M', () => {
    expect(filas().length).toBe(2);
    expect(el.querySelector('#doc-contador')?.textContent?.trim()).toBe('2 de 2');
  });

  it('filtra por texto sin distinguir tildes ni mayúsculas', () => {
    escribir('#doc-filtro-texto', 'MUNICIPAL', 'input');
    expect(filas().length).toBe(1);
    expect(el.textContent).toContain('Licencia municipal');
    expect(el.querySelector('#doc-contador')?.textContent?.trim()).toBe('1 de 2');
  });

  it('filtra por categoría y estado, y limpia los filtros', () => {
    escribir('#doc-filtro-categoria', 'Permiso', 'change');
    expect(filas().length).toBe(1);
    escribir('#doc-filtro-estado', 'Validado', 'change');
    expect(el.textContent).toContain('Ningún documento coincide');

    const limpiar = el.querySelector<HTMLButtonElement>('button[aria-label="Limpiar filtros"]')!;
    expect(limpiar.disabled).toBe(false);
    limpiar.click();
    fixture.detectChanges();
    expect(filas().length).toBe(2);
    expect(limpiar.disabled).toBe(true);
  });

  it('distingue "sin documentos" de "filtro sin resultados"', () => {
    escribir('#doc-filtro-texto', 'no existe', 'input');
    expect(el.textContent).toContain('Ningún documento coincide');
    expect(el.textContent).not.toContain('No hay documentos registrados');

    fixture.componentRef.setInput('documentos', []);
    escribir('#doc-filtro-texto', '', 'input');
    expect(el.textContent).toContain('No hay documentos registrados');
  });

  it('deshabilita Descargar y oculta Ver cuando no hay archivo', () => {
    const [conArchivo, sinArchivo] = Array.from(filas());
    const descargar = (fila: Element) => fila.querySelector<HTMLButtonElement>('button[aria-label^="Descargar"]')!;
    expect(descargar(conArchivo).disabled).toBe(false);
    expect(conArchivo.querySelector('button[aria-label^="Ver "]')).not.toBeNull();
    expect(descargar(sinArchivo).disabled).toBe(true);
    expect(sinArchivo.querySelector('button[aria-label^="Ver "]')).toBeNull();
  });

  it('emite ver, descargar y verDetalle con el documento', () => {
    const ver = vi.fn();
    const descargar = vi.fn();
    const detalle = vi.fn();
    fixture.componentInstance.ver.subscribe(ver);
    fixture.componentInstance.descargar.subscribe(descargar);
    fixture.componentInstance.verDetalle.subscribe(detalle);

    const fila = filas()[0];
    fila.querySelector<HTMLButtonElement>('button[aria-label^="Ver "]')!.click();
    fila.querySelector<HTMLButtonElement>('button[aria-label^="Descargar"]')!.click();
    fila.querySelector<HTMLButtonElement>('button[aria-label^="Detalle"]')!.click();
    expect(ver).toHaveBeenCalledWith(docs[0]);
    expect(descargar).toHaveBeenCalledWith(docs[0]);
    expect(detalle).toHaveBeenCalledWith(docs[0]);
  });

  it('cada fila tiene Eliminar, también las que no tienen archivo, y emite el documento', () => {
    const eliminar = vi.fn();
    fixture.componentInstance.eliminar.subscribe(eliminar);

    for (const fila of Array.from(filas())) {
      const boton = fila.querySelector<HTMLButtonElement>('button[aria-label^="Eliminar "]');
      expect(boton).not.toBeNull();
      expect(boton!.disabled).toBe(false);
      expect(boton!.title).toBe('Eliminar documento');
    }

    filas()[1].querySelector<HTMLButtonElement>('button[aria-label^="Eliminar "]')!.click();
    expect(eliminar).toHaveBeenCalledTimes(1);
    expect(eliminar).toHaveBeenCalledWith(docs[1]);
  });

  it('el aria-label de Eliminar incluye el título del documento', () => {
    const boton = filas()[0].querySelector<HTMLButtonElement>('button[aria-label^="Eliminar "]')!;

    expect(boton.getAttribute('aria-label')).toBe(`Eliminar ${docs[0].titulo}`);
  });

  it('muestra el aviso de error cuando se recibe', () => {
    expect(el.querySelector('[role="alert"]')).toBeNull();
    fixture.componentRef.setInput('error', 'No se pudo descargar');
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('No se pudo descargar');
  });
});

describe('DocumentosTabComponent: botones según permisos (obra)', () => {
  const docs = [doc({ id: 1, titulo: 'Acta de entrega', archivo_url: 'k/ab12cd34_acta.pdf' })];

  it('con solo ver: sin Anexar ni Eliminar; Ver, Descargar y Detalle siguen', async () => {
    const { el } = await montar(DocumentosTabComponent, { documentos: docs, permisos: permisosObra() });

    expect(hayBoton(el, 'Anexar Documento')).toBe(false);
    expect(el.querySelector('button[aria-label^="Eliminar "]')).toBeNull();
    expect(el.querySelector('button[aria-label^="Ver "]')).not.toBeNull();
    expect(el.querySelector('button[aria-label^="Descargar "]')).not.toBeNull();
    expect(el.querySelector('button[aria-label^="Detalle"]')).not.toBeNull();
  });

  it('crear → Anexar; eliminar → Eliminar', async () => {
    const crear = await montar(DocumentosTabComponent, { documentos: docs, permisos: permisosObra({ crear: true }) });
    expect(hayBoton(crear.el, 'Anexar Documento')).toBe(true);
    expect(crear.el.querySelector('button[aria-label^="Eliminar "]')).toBeNull();

    const eliminar = await montar(DocumentosTabComponent, { documentos: docs, permisos: permisosObra({ eliminar: true }) });
    expect(hayBoton(eliminar.el, 'Anexar Documento')).toBe(false);
    expect(eliminar.el.querySelector('button[aria-label^="Eliminar "]')).not.toBeNull();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ObraDocumento } from '../../obra.interface';
import { DocumentoEliminarDialogComponent } from './documento-eliminar-dialog';

const doc = (archivo_url?: string): ObraDocumento => ({
  id: 7,
  titulo: 'Acta de entrega',
  categoria: 'Acta',
  estado: 'Validado',
  archivo_url,
  created_at: '2026-09-18',
});

describe('DocumentoEliminarDialogComponent', () => {
  let fixture: ComponentFixture<DocumentoEliminarDialogComponent>;
  const cancelado = vi.fn();
  const confirmado = vi.fn();

  const el = () => fixture.nativeElement as HTMLElement;
  const texto = () => el().textContent?.replace(/\s+/g, ' ') ?? '';
  const boton = (id: string) => el().querySelector<HTMLButtonElement>(`#${id}`)!;

  const abrir = (documento: ObraDocumento, extra: { eliminando?: boolean; error?: string } = {}) => {
    fixture.componentRef.setInput('documento', documento);
    fixture.componentRef.setInput('eliminando', extra.eliminando ?? false);
    fixture.componentRef.setInput('error', extra.error ?? '');
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
  };

  beforeEach(() => {
    cancelado.mockClear();
    confirmado.mockClear();
    fixture = TestBed.createComponent(DocumentoEliminarDialogComponent);
    fixture.componentInstance.cancelled.subscribe(cancelado);
    fixture.componentInstance.confirmed.subscribe(confirmado);
  });

  it('pide confirmación nombrando el documento y avisa que no se puede deshacer', () => {
    abrir(doc());

    expect(texto()).toContain('Eliminar documento');
    expect(texto()).toContain('«Acta de entrega»');
    expect(texto()).toContain('Esta acción no se puede deshacer');
    expect(el().querySelector('[role="alertdialog"]')).not.toBeNull();
  });

  it('avisa que también se borra el archivo cuando el documento tiene uno propio', () => {
    abrir(doc('obras/10/documentos/1a2b3c4d_Acta.pdf'));

    expect(texto()).toContain('También se borrará su archivo adjunto: Acta.pdf');
  });

  it.each([[undefined], ['https://drive.example.com/doc']])('no menciona archivo si no hay uno propio (%s)', (archivo) => {
    abrir(doc(archivo));

    expect(texto()).not.toContain('También se borrará');
  });

  it('Eliminar confirma y Cancelar cancela', () => {
    abrir(doc());

    boton('btn-eliminar-confirmar').click();
    expect(confirmado).toHaveBeenCalledTimes(1);
    expect(cancelado).not.toHaveBeenCalled();

    boton('btn-eliminar-cancelar').click();
    expect(cancelado).toHaveBeenCalledTimes(1);
  });

  it('Escape cancela', () => {
    abrir(doc());

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(cancelado).toHaveBeenCalledTimes(1);
  });

  it('mientras elimina bloquea los botones y no se puede cancelar ni con Escape ni confirmar de nuevo', () => {
    abrir(doc(), { eliminando: true });

    expect(boton('btn-eliminar-confirmar').disabled).toBe(true);
    expect(boton('btn-eliminar-cancelar').disabled).toBe(true);
    expect(texto()).toContain('Eliminando…');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    boton('btn-eliminar-confirmar').click();

    expect(cancelado).not.toHaveBeenCalled();
    expect(confirmado).not.toHaveBeenCalled();
  });

  it('muestra el error si la eliminación falló y deja reintentar', () => {
    abrir(doc(), { error: 'Documento no encontrado' });

    expect(el().querySelector('[role="alert"]')?.textContent).toContain('Documento no encontrado');
    expect(boton('btn-eliminar-confirmar').disabled).toBe(false);
  });

  it('sin error no hay aviso', () => {
    abrir(doc());

    expect(el().querySelector('[role="alert"]')).toBeNull();
  });
});

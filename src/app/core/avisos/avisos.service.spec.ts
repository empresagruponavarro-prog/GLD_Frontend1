import { TestBed } from '@angular/core/testing';
import { AVISO_DURACION_MS, AvisosService } from './avisos.service';

describe('AvisosService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('muestra un aviso y lo cierra solo pasado el tiempo', () => {
    const avisos = TestBed.inject(AvisosService);
    avisos.mostrar('No tienes permiso para esta acción');
    expect(avisos.aviso()).toEqual({ texto: 'No tienes permiso para esta acción', tipo: 'error' });
    vi.advanceTimersByTime(AVISO_DURACION_MS - 1);
    expect(avisos.aviso()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(avisos.aviso()).toBeNull();
  });

  it('un aviso nuevo reemplaza al anterior y reinicia el temporizador', () => {
    const avisos = TestBed.inject(AvisosService);
    avisos.mostrar('uno');
    vi.advanceTimersByTime(AVISO_DURACION_MS - 100);
    avisos.mostrar('dos', 'ok');
    vi.advanceTimersByTime(200);
    expect(avisos.aviso()).toEqual({ texto: 'dos', tipo: 'ok' });
    vi.advanceTimersByTime(AVISO_DURACION_MS);
    expect(avisos.aviso()).toBeNull();
  });

  it('cerrar() lo quita al momento; duración 0 no se cierra sola', () => {
    const avisos = TestBed.inject(AvisosService);
    avisos.mostrar('fijo', 'aviso', 0);
    vi.advanceTimersByTime(10 * AVISO_DURACION_MS);
    expect(avisos.aviso()?.texto).toBe('fijo');
    avisos.cerrar();
    expect(avisos.aviso()).toBeNull();
  });
});

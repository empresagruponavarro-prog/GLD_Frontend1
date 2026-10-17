import { TODOS_PERMISOS_OBRA, camposEditables, montar, permisosObra } from '../../obra-cockpit.testing';
import { GeneradorSemanasDialogComponent } from './generador-semanas-dialog';

const abrir = (permisos = permisosObra()) =>
  montar(GeneradorSemanasDialogComponent, { isOpen: true, idCentroCosto: 10, fechaInicioSugerida: '2026-03-02T00:00:00', permisos });

/** Pills de cantidad y tarjetas de distribución (todo botón del formulario salvo Cancelar). */
const opciones = (el: HTMLElement) =>
  Array.from(el.querySelectorAll<HTMLButtonElement>('form button[type="button"]')).filter((b) => b.textContent?.trim() !== 'Cancelar');

describe('GeneradorSemanasDialogComponent: permisos (obra)', () => {
  it('sin crear: solo lectura, opciones bloqueadas, sin Generar y el submit no envía nada', async () => {
    const { el, http } = await abrir(permisosObra({ editar: true, eliminar: true }));

    expect(el.querySelector('#btn-generar-guardar')).toBeNull();
    expect(camposEditables(el)).toHaveLength(0);
    expect(opciones(el).length).toBeGreaterThan(0);
    expect(opciones(el).every((b) => b.disabled)).toBe(true);
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    http.expectNone(() => true);
  });

  it('con crear: formulario editable y Generar visible; parte de la fecha sugerida', async () => {
    const { el } = await abrir(TODOS_PERMISOS_OBRA);

    expect(el.querySelector('#btn-generar-guardar')).not.toBeNull();
    expect(camposEditables(el).length).toBeGreaterThan(0);
    expect(opciones(el).some((b) => b.disabled)).toBe(false);
    expect(el.querySelector<HTMLInputElement>('#gen-inicio')?.value).toBe('2026-03-02');
  });
});

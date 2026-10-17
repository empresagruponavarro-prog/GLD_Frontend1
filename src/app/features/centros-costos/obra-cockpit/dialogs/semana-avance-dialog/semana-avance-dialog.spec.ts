import { ObraSemana } from '../../obra.interface';
import { TODOS_PERMISOS_OBRA, camposEditables, montar, permisosObra } from '../../obra-cockpit.testing';
import { SemanaAvanceDialogComponent } from './semana-avance-dialog';

const SEMANA: ObraSemana = {
  id: 4,
  numero_semana: 2,
  etiqueta_semana: 'SEM 02',
  fecha_inicio: '2026-01-12',
  fecha_fin: '2026-01-18',
  fase_principal: 'Cimentación',
  porcentaje_meta: 20,
  porcentaje_real: 15,
  estado: 'Retrasado',
  orden: 2,
};

const abrir = (permisos = permisosObra()) => montar(SemanaAvanceDialogComponent, { isOpen: true, idCentroCosto: 10, semana: SEMANA, permisos });

describe('SemanaAvanceDialogComponent: permisos (obra)', () => {
  it('sin editar: solo lectura, accesos rápidos bloqueados, sin Guardar y el submit no envía nada', async () => {
    const { el, http } = await abrir(permisosObra({ crear: true, eliminar: true }));

    expect(el.querySelector('#btn-guardar-avance')).toBeNull();
    expect(camposEditables(el)).toHaveLength(0);
    expect(el.querySelector<HTMLButtonElement>('[title="Copiar meta exacta"]')?.disabled).toBe(true);
    expect(el.querySelector<HTMLButtonElement>('[title="Completar 100%"]')?.disabled).toBe(true);
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    http.expectNone(() => true);
  });

  it('con editar: editable y Guardar Avance envía el PATCH', async () => {
    const { el, http } = await abrir(TODOS_PERMISOS_OBRA);

    expect(camposEditables(el).length).toBeGreaterThan(0);
    expect(el.querySelector<HTMLButtonElement>('[title="Completar 100%"]')?.disabled).toBe(false);
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    const req = http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/cronograma/4/avance'));
    expect(req.request.method).toBe('PATCH');
  });
});

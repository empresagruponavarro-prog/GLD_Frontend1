import { hayBoton } from '@app/core/auth/pantalla.testing';
import { ObraResidente } from '../../obra.interface';
import { TODOS_PERMISOS_OBRA, montar, montarConCarga, permisosObra } from '../../obra-cockpit.testing';
import { DirectorioTabComponent } from './directorio-tab';

const RESIDENTE: ObraResidente = {
  id: 3,
  clave: 'res-3',
  origen: 'directorio',
  nombre_completo: 'Ana Torres',
  rol_obra: 'Residente',
  estado_planta: 'En Planta',
  orden: 1,
};

/** Jefe de proyecto de la ficha técnica, sin datos de obra propios ni teléfono en Trabajadores. */
const JEFE: ObraResidente = {
  id: null,
  clave: 'equipo-7',
  origen: 'equipo',
  roles_equipo: ['jefe_proyecto'],
  id_anexo: 7,
  nombre_completo: 'Luis Paz',
  rol_obra: 'Jefe de proyecto',
  correo: 'lpaz@gld.pe',
  correo_trabajador: 'lpaz@gld.pe',
  estado_planta: 'En Planta',
  orden: 0,
};

describe('DirectorioTabComponent: botones según permisos (obra)', () => {
  it('con solo ver no aparece Asignar, pero sí Ver ficha (abre en solo lectura)', async () => {
    const { el, fixture } = await montar(DirectorioTabComponent, { residentes: [RESIDENTE], permisos: permisosObra() });
    const vistos: ObraResidente[] = [];
    fixture.componentInstance.editar.subscribe((r) => vistos.push(r));

    expect(hayBoton(el, 'Asignar Nuevo Residente')).toBe(false);
    el.querySelector<HTMLButtonElement>('[title="Ver ficha"]')?.click();
    expect(vistos).toEqual([RESIDENTE]);
  });

  it('con crear aparece Asignar', async () => {
    const { el } = await montar(DirectorioTabComponent, { residentes: [RESIDENTE], permisos: permisosObra({ crear: true }) });

    expect(hayBoton(el, 'Asignar Nuevo Residente')).toBe(true);
  });

  it('con todos los permisos aparecen Asignar y Ver ficha', async () => {
    const { el } = await montar(DirectorioTabComponent, { residentes: [RESIDENTE], permisos: TODOS_PERMISOS_OBRA });

    expect(hayBoton(el, 'Asignar Nuevo Residente')).toBe(true);
    expect(hayBoton(el, 'Ver ficha')).toBe(true);
  });
});

describe('DirectorioTabComponent: equipo de la ficha', () => {
  it('marca la tarjeta «De la ficha» y avisa si no hay teléfono', async () => {
    const { el } = await montar(DirectorioTabComponent, { residentes: [JEFE, RESIDENTE], permisos: permisosObra() });
    const tarjetas = Array.from(el.querySelectorAll('.grid > div'));

    expect(tarjetas[0].textContent).toContain('Jefe de proyecto');
    expect(tarjetas[0].textContent).toContain('De la ficha');
    expect(tarjetas[0].textContent).toContain('Sin teléfono');
    expect(tarjetas[0].textContent).not.toContain('Sin correo');
    expect(tarjetas[1].textContent).not.toContain('De la ficha');
    expect(tarjetas[1].textContent).not.toContain('Sin teléfono');
  });
});

describe('DirectorioTabComponent: historial del equipo (GRP S-06)', () => {
  const ANTERIOR: ObraResidente = {
    id: 21,
    clave: 'historial-21',
    origen: 'historial',
    roles_equipo: ['residente'],
    nombre_completo: 'Rosa Gil',
    rol_obra: 'Residente',
    fecha_alta: '2026-01-10',
    fecha_baja: '2026-06-30',
    estado_planta: 'En Planta',
    orden: 0,
  };
  const esHistorial = (r: { method: string; url: string }) => r.method === 'GET' && r.url.endsWith('/operaciones/obra/10/residentes/historial');

  it('lista a quienes ocuparon antes un rol, con sus fechas de alta y baja', async () => {
    const { el } = await montarConCarga(DirectorioTabComponent, { residentes: [JEFE], idCentroCosto: 10, permisos: permisosObra() }, (http) =>
      http.expectOne(esHistorial).flush([ANTERIOR]),
    );

    const seccion = el.querySelector('[data-testid="historial-equipo"]')!;
    expect(seccion.textContent).toContain('Historial del equipo');
    expect(seccion.textContent).toContain('Rosa Gil');
    expect(seccion.textContent).toContain('2026-01-10 → 2026-06-30');
  });

  it('sin cambios de equipo lo dice', async () => {
    const { el } = await montarConCarga(DirectorioTabComponent, { residentes: [JEFE], idCentroCosto: 10, permisos: permisosObra() }, (http) =>
      http.expectOne(esHistorial).flush([]),
    );

    expect(el.querySelector('[data-testid="historial-equipo"]')?.textContent).toContain('Aún no hay cambios en el equipo');
  });

  it('la tarjeta del equipo muestra desde cuándo ocupa el rol', async () => {
    const { el } = await montarConCarga(
      DirectorioTabComponent,
      { residentes: [{ ...JEFE, fecha_alta: '2026-03-02' }], idCentroCosto: 10, permisos: permisosObra() },
      (http) => http.expectOne(esHistorial).flush([]),
    );

    expect(el.querySelector('[data-testid="fecha-alta"]')?.textContent).toContain('Desde 2026-03-02');
  });

  it('sin obra no pide el historial ni muestra la sección', async () => {
    const { el, http } = await montar(DirectorioTabComponent, { residentes: [JEFE], permisos: permisosObra() });

    http.expectNone(() => true);
    expect(el.querySelector('[data-testid="historial-equipo"]')).toBeNull();
  });
});

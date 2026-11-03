import { hayBoton } from '@app/core/auth/pantalla.testing';
import { ObraResidente } from '../../obra.interface';
import { TODOS_PERMISOS_OBRA, montar, permisosObra } from '../../obra-cockpit.testing';
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

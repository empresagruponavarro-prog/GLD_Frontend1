import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { misPermisos } from '@app/core/auth/auth.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { LocalItem, UbicacionItem } from './locales.interface';
import { LocalesComponent } from './locales';

const UBICACION: UbicacionItem = {
  id: 1,
  codigo: 'SEDE-LIM-P2-OF-TI',
  id_local: 1,
  local_codigo: 'SEDE-LIM',
  local_nombre: 'SEDE CENTRAL LIMA',
  id_nivel: 2,
  nivel_codigo: 'P2',
  nivel_descripcion: 'PISO 2',
  id_ambiente: 3,
  ambiente_codigo: 'OF-TI',
  ambiente_descripcion: 'OFICINA DE TI',
  id_area: 4,
  area_codigo: 'TI',
  area_nombre: 'TECNOLOGÍA DE LA INFORMACIÓN',
  observaciones: null,
  estado: true,
};

const LOCAL: LocalItem = {
  id: 1,
  codigo: 'SEDE-LIM',
  nombre: 'SEDE CENTRAL LIMA',
  direccion: 'Av. Javier Prado Este 1234',
  id_empresa: 1,
  empresa_nombre: 'GLD CONSTRUCTORA S.A.C.',
  id_centro_costo: null,
  centro_costo_codigo: null,
  centro_costo_nombre: null,
  tipo_asignacion: 'EMPRESA',
  estado: true,
};

const BOTONES_LOCAL = { nuevo: 'Nuevo local', editar: 'Editar local' };

async function montar(acciones: Partial<Permisos>) {
  const p = await montarPantalla(
    LocalesComponent,
    misPermisos('Usuario', { 'maestros.generales': acciones }),
    (req) => {
      if (req.url.includes('/maestros/ubicacion')) return [UBICACION];
      if (req.url.includes('/maestros/local')) return [LOCAL];
      return [];
    },
  );
  return p;
}

describe('LocalesComponent: Ubicaciones solo lectura y permisos en Locales', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('en pestaña Ubicaciones es solo lectura: muestra datos y sin botones de crear ni editar', async () => {
    const p = await montar({ crear: true, editar: true });
    expect(p.el.textContent).toContain('SEDE-LIM-P2-OF-TI');
    expect(p.el.textContent).not.toContain('Nueva ubicación');
    expect(p.el.textContent).not.toContain('Editar ubicación');
  });

  it('en pestaña Locales: con solo ver no aparece botón Nuevo local', async () => {
    const p = await montar({ ver: true });
    p.cmp['activeTab'].set('locales');
    await p.render();
    expect(botonesVisibles(p.el, BOTONES_LOCAL)).toEqual({ nuevo: false, editar: false });
  });

  it('en pestaña Locales: crear → botón Nuevo local visible', async () => {
    const p = await montar({ crear: true });
    p.cmp['activeTab'].set('locales');
    await p.render();
    expect(botonesVisibles(p.el, BOTONES_LOCAL)['nuevo']).toBe(true);
  });
});

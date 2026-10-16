import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { misPermisos } from '@app/core/auth/auth.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { Cuenta } from '../tesoreria.models';
import { CuentasComponent } from './cuentas';

const CUENTA: Cuenta = {
  id: 1,
  codigo: 'BCP-SOLES',
  nombre: 'BCP Soles',
  tipo: 'BANCO',
  banco: 'BCP',
  numero_cuenta: '191-000',
  cci: null,
  moneda_id: 'PEN',
  id_empresa: null,
  estado: true,
};

const BOTONES = { nueva: 'Nueva cuenta', editar: 'Editar', estado: 'Desactivar' };

async function montar(acciones: Partial<Permisos>) {
  const p = await montarPantalla(CuentasComponent, misPermisos('Tesorero', { 'tesoreria.cuentas': acciones }), () => [CUENTA]);
  expect(p.el.textContent).toContain('BCP-SOLES');
  return p;
}

describe('CuentasComponent: botones según permisos (tesoreria.cuentas)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver no aparecen Nueva, Editar ni Activar/Desactivar', async () => {
    const { el } = await montar({});
    expect(botonesVisibles(el, BOTONES)).toEqual({ nueva: false, editar: false, estado: false });
  });

  it('crear → Nueva cuenta; editar → Editar y Activar/Desactivar (PATCH)', async () => {
    expect(botonesVisibles((await montar({ crear: true })).el, BOTONES)).toEqual({ nueva: true, editar: false, estado: false });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ editar: true, eliminar: true })).el, BOTONES)).toEqual({ nueva: false, editar: true, estado: true });
  });
});

import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { misPermisos } from '@app/core/auth/auth.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { TipoCambio } from '../tesoreria.models';
import { TipoCambioComponent } from './tipo-cambio';

const TC: TipoCambio = { id: 1, fecha: '2026-10-15', moneda_id: 'USD', compra: '3.7500', venta: '3.7800' };

const BOTONES = { guardar: 'Guardar', corregir: 'Corregir' };

async function montar(acciones: Partial<Permisos>) {
  const p = await montarPantalla(TipoCambioComponent, misPermisos('Tesorero', { 'tesoreria.tipo-cambio': acciones }), () => [TC]);
  expect(p.el.textContent).toContain('3.7800');
  return p;
}

describe('TipoCambioComponent: botones según permisos (tesoreria.tipo-cambio)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver (o editar) no aparecen el formulario, Guardar ni Corregir', async () => {
    const { el } = await montar({ editar: true });
    expect(botonesVisibles(el, BOTONES)).toEqual({ guardar: false, corregir: false });
    expect(el.querySelector('form')).toBeNull();
  });

  it('con crear aparecen el formulario, Guardar y Corregir (ambos hacen POST)', async () => {
    const { el } = await montar({ crear: true });
    expect(botonesVisibles(el, BOTONES)).toEqual({ guardar: true, corregir: true });
    expect(el.querySelector('form')).not.toBeNull();
  });
});

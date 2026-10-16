import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { misPermisos } from '@app/core/auth/auth.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { EmpresaApi } from './interfaces';
import { normalizarEmpresa } from './empresas.service';
import { EmpresasComponent } from './empresas';

const EMPRESA: EmpresaApi = {
  id_empresa: 7,
  ruc: '20123456789',
  razon_social: 'GLD SERVICIOS GENERALES EIRL',
  domicilio_fiscal: null,
  direccion_entrega: null,
  correo_compras: null,
};

const BOTONES = { nueva: 'Nueva Empresa', editar: 'Editar', eliminar: 'Eliminar' };

async function montar(acciones: Partial<Permisos>) {
  const p = await montarPantalla(EmpresasComponent, misPermisos('Usuario', { 'admin.empresas': acciones }), () => [EMPRESA]);
  expect(p.el.textContent).toContain('GLD SERVICIOS GENERALES EIRL');
  return p;
}

describe('EmpresasComponent: botones según permisos (admin.empresas)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver no aparecen Nueva, Editar ni Eliminar', async () => {
    const { el } = await montar({});
    expect(botonesVisibles(el, BOTONES)).toEqual({ nueva: false, editar: false, eliminar: false });
  });

  it('cada botón aparece solo con su acción', async () => {
    expect(botonesVisibles((await montar({ crear: true })).el, BOTONES)).toEqual({ nueva: true, editar: false, eliminar: false });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ editar: true })).el, BOTONES)).toEqual({ nueva: false, editar: true, eliminar: false });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ eliminar: true })).el, BOTONES)).toEqual({ nueva: false, editar: false, eliminar: true });
  });
});

describe('normalizarEmpresa', () => {
  it('añade el código y los alias sin null', () => {
    expect(normalizarEmpresa(EMPRESA)).toEqual({
      id: 7,
      id_empresa: 7,
      CodEmpresa: 'EMP-007',
      RUC: '20123456789',
      ruc: '20123456789',
      RazonSocial: 'GLD SERVICIOS GENERALES EIRL',
      razon_social: 'GLD SERVICIOS GENERALES EIRL',
      DomicilioFiscal: '',
      domicilio_fiscal: '',
      DireccionEntrega: '',
      direccion_entrega: '',
      CorreoCompras: '',
      correo_compras: '',
    });
  });
});

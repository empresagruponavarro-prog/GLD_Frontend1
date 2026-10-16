import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { HttpRequest } from '@angular/common/http';
import { misPermisos } from '@app/core/auth/auth.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { Anexo, AnexoPaginated } from './interfaces/anexos.interface';
import { AnexosComponent } from './anexos';

const ANEXO: Anexo = {
  id: 1,
  tipoAnexo: 'Proveedor',
  AnexoEspecialidadId: null,
  AnexoTipoDocIdeId: null,
  NumeroDocIde: '20123456789',
  Anexo: 'ACME SAC',
  NombreComercial: null,
  Direccion: null,
  Contacto: null,
  Telefono: null,
  Correo: null,
  estado: true,
};

function responder(req: HttpRequest<unknown>) {
  if (req.url.endsWith('/maestros/anexo')) {
    const pagina: AnexoPaginated = { data: [ANEXO], page: 1, pageSize: 20, total: 1, totalPages: 1 };
    return pagina;
  }
  return [];
}

const BOTONES = { nuevo: 'Nuevo Anexo', editar: 'Editar', eliminar: 'Eliminar', detalle: 'Ver detalle' };

async function montar(acciones: Partial<Permisos>) {
  const p = await montarPantalla(AnexosComponent, misPermisos('Logística', { 'maestros.anexos': acciones }), responder);
  expect(p.el.textContent).toContain('ACME SAC');
  return p;
}

describe('AnexosComponent: botones según permisos (maestros.anexos)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver: solo "Ver detalle"', async () => {
    const { el } = await montar({});
    expect(botonesVisibles(el, BOTONES)).toEqual({ nuevo: false, editar: false, eliminar: false, detalle: true });
  });

  it('cada botón aparece solo con su acción', async () => {
    expect(botonesVisibles((await montar({ crear: true })).el, BOTONES)).toEqual({ nuevo: true, editar: false, eliminar: false, detalle: true });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ editar: true })).el, BOTONES)).toEqual({ nuevo: false, editar: true, eliminar: false, detalle: true });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ eliminar: true })).el, BOTONES)).toEqual({ nuevo: false, editar: false, eliminar: true, detalle: true });
  });
});

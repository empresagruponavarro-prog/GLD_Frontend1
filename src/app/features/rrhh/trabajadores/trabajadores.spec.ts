import { HttpRequest } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { misPermisos } from '@app/core/auth/auth.testing';
import { botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { OpcionesTrabajador, ResumenTrabajadores, Trabajador, TrabajadoresPaginados } from './trabajadores.models';
import { TrabajadoresComponent } from './trabajadores';

const TRABAJADOR: Trabajador = {
  id: 7,
  Anexo: 'JUAN PÉREZ',
  AnexoTipoDocIdeId: 4,
  NumeroDocIde: '12345678',
  AnexoEspecialidadId: null,
  Direccion: null,
  Telefono: '999888777',
  Correo: null,
  estado: true,
  conFicha: true,
  idTipoTrabajador: 1,
  tipoTrabajador: 'EMPLEADO',
  idModalidadContrato: 9,
  modalidadContrato: 'MODALIDAD ANTIGUA',
  idArea: 3,
  area: 'Sistemas',
  direccionInstitucional: null,
  telefonoInstitucional: null,
  correoInstitucional: 'jperez@empresa.pe',
};

const ANTIGUO: Trabajador = {
  ...TRABAJADOR,
  id: 8,
  Anexo: 'ROSA ANTIGUA',
  NumeroDocIde: '-',
  conFicha: false,
  idTipoTrabajador: null,
  tipoTrabajador: null,
  idModalidadContrato: null,
  modalidadContrato: null,
  idArea: null,
  area: null,
  correoInstitucional: null,
};

const OPCIONES: OpcionesTrabajador = {
  tiposDocumento: [
    { id: 4, nombre: 'DNI', activo: true },
    { id: 5, nombre: 'PASAPORTE', activo: true },
  ],
  tiposTrabajador: [{ id: 1, nombre: 'EMPLEADO', activo: true }],
  modalidadesContrato: [
    { id: 2, nombre: 'PLAZO INDETERMINADO', activo: true },
    { id: 9, nombre: 'MODALIDAD ANTIGUA', activo: false },
  ],
};

const RESUMEN: ResumenTrabajadores = { total: 320, activos: 300, deBaja: 20, fichaPendiente: 280, documentoPendiente: 166 };

function responder(req: HttpRequest<unknown>) {
  if (req.url.endsWith('/rrhh/trabajadores/resumen')) return RESUMEN;
  if (req.url.endsWith('/rrhh/trabajadores/opciones')) return OPCIONES;
  if (req.url.endsWith('/maestros/area')) return [{ id: 3, nombre: 'Sistemas', jefe: 'LUIS ÁLVAREZ' }];
  if (req.url.endsWith('/rrhh/trabajadores')) {
    const pagina: TrabajadoresPaginados = { data: [TRABAJADOR, ANTIGUO], page: 1, pageSize: 20, total: 2, totalPages: 1 };
    return pagina;
  }
  return [];
}

const BOTONES = { nuevo: 'Nuevo trabajador', editar: 'Editar', equipos: 'Ver equipos' };

async function montar(acciones: Partial<Permisos>, conEquipos = false) {
  const permisos = misPermisos('RR.HH.', { 'rrhh.trabajadores': acciones, ...(conEquipos ? { 'tecnologia.mantenimiento': {} } : {}) });
  const p = await montarPantalla(TrabajadoresComponent, permisos, responder);
  expect(p.el.textContent).toContain('JUAN PÉREZ');
  return p;
}

describe('TrabajadoresComponent (RR.HH.)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver no hay Nuevo, Editar ni Ver equipos', async () => {
    const { el } = await montar({});
    expect(botonesVisibles(el, BOTONES)).toEqual({ nuevo: false, editar: false, equipos: false });
  });

  it('crear → Nuevo trabajador; editar → Editar', async () => {
    expect(botonesVisibles((await montar({ crear: true })).el, BOTONES)).toEqual({ nuevo: true, editar: false, equipos: false });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ editar: true })).el, BOTONES)).toEqual({ nuevo: false, editar: true, equipos: false });
  });

  it('«Ver equipos» solo aparece a quien tiene el módulo de equipos', async () => {
    expect(botonesVisibles((await montar({}, true)).el, BOTONES)).toEqual({ nuevo: false, editar: false, equipos: true });
  });

  it('muestra tipo, modalidad y área; el trabajador antiguo aparece con la ficha pendiente', async () => {
    const { el } = await montar({});
    expect(el.textContent).toContain('MODALIDAD ANTIGUA');
    expect(el.textContent).toContain('Sistemas');
    expect(el.textContent).toContain('Ficha pendiente');
  });

  it('guarda un trabajador nuevo con su ficha, el nombre limpio y los vacíos como null', async () => {
    const p = await montar({ crear: true });
    p.cmp['nuevo']();
    expect(p.cmp['opcionesModalidad']().map((o) => o.id)).toEqual([2]);
    p.cmp['form'].patchValue({
      idTipoTrabajador: 1,
      AnexoTipoDocIdeId: 4,
      NumeroDocIde: '87654321',
      Anexo: '  ANA TORRES  ',
      idModalidadContrato: 2,
      idArea: 3,
      Telefono: '  ',
      correoInstitucional: 'atorres@empresa.pe',
    });
    expect(p.cmp['jefeInmediato']()).toBe('Jefe inmediato: LUIS ÁLVAREZ');
    p.cmp['guardar']();
    const req = p.http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/rrhh/trabajadores'));
    expect(req.request.body).toEqual({
      Anexo: 'ANA TORRES',
      AnexoTipoDocIdeId: 4,
      NumeroDocIde: '87654321',
      AnexoEspecialidadId: null,
      idTipoTrabajador: 1,
      idModalidadContrato: 2,
      idArea: 3,
      Direccion: null,
      Telefono: null,
      Correo: null,
      direccionInstitucional: null,
      telefonoInstitucional: null,
      correoInstitucional: 'atorres@empresa.pe',
      estado: true,
    });
    req.flush({ ...TRABAJADOR, id: 10, Anexo: 'ANA TORRES' });
    // Al guardar se recargan la lista y las tarjetas.
    for (const pendiente of p.http.match((r) => r.method === 'GET')) pendiente.flush(responder(pendiente.request));
    expect(p.cmp['modalAbierto']()).toBe(false);
  });

  it('no envía nada si faltan datos o el DNI no tiene 8 dígitos, y lo explica', async () => {
    const p = await montar({ crear: true });
    p.cmp['nuevo']();
    p.cmp['guardar']();
    p.http.expectNone((r) => r.method === 'POST');
    const mensaje = p.cmp['modalError']();
    expect(mensaje).toContain('tipo de trabajador');
    expect(mensaje).toContain('modalidad de contrato');
    expect(mensaje).toContain('número de documento');
    p.cmp['form'].patchValue({ idTipoTrabajador: 1, AnexoTipoDocIdeId: 4, NumeroDocIde: '1234567', Anexo: 'ANA', idModalidadContrato: 2 });
    p.cmp['guardar']();
    p.http.expectNone((r) => r.method === 'POST');
    expect(p.cmp['modalError']()).toBe('El DNI tiene 8 dígitos.');
  });

  it('las tarjetas muestran los pendientes y filtran la lista al hacer clic', async () => {
    const p = await montar({});
    expect(p.el.textContent).toContain('280');
    expect(p.el.textContent).toContain('166');
    const tarjeta = Array.from(p.el.querySelectorAll<HTMLButtonElement>('button.trab-tarjeta')).find((b) => b.textContent?.includes('documento pendiente'));
    if (!tarjeta) throw new Error('falta la tarjeta de documento pendiente');
    tarjeta.click();
    const peticiones = p.http.match((r) => r.method === 'GET');
    const lista = peticiones.find((r) => r.request.url.endsWith('/rrhh/trabajadores'));
    expect(lista?.request.params.get('situacion')).toBe('documento-pendiente');
    for (const pendiente of peticiones) pendiente.flush(responder(pendiente.request));
    expect(p.cmp['situacionFiltro']()).toBe('documento-pendiente');
  });

  it('marca el documento pendiente en la fila del trabajador antiguo', async () => {
    const { el } = await montar({});
    const filas = Array.from(el.querySelectorAll('tbody tr'));
    const antigua = filas.find((f) => f.textContent?.includes('ROSA ANTIGUA'));
    const nueva = filas.find((f) => f.textContent?.includes('JUAN PÉREZ'));
    expect(antigua?.textContent).toContain('Documento pendiente');
    expect(nueva?.textContent).not.toContain('Documento pendiente');
  });

  it('filtra por área con su id', async () => {
    const p = await montar({});
    const select = p.el.querySelector<HTMLSelectElement>('select[aria-label="Área"]');
    if (!select) throw new Error('falta el filtro de área');
    select.value = '3';
    select.dispatchEvent(new Event('change'));
    const peticiones = p.http.match((r) => r.method === 'GET');
    expect(peticiones.find((r) => r.request.url.endsWith('/rrhh/trabajadores'))?.request.params.get('idArea')).toBe('3');
    for (const pendiente of peticiones) pendiente.flush(responder(pendiente.request));
  });

  it('al editar ofrece la modalidad desactivada que ya tenía y deja vacío un documento «-»', async () => {
    const p = await montar({ editar: true });
    p.cmp['editar'](TRABAJADOR);
    expect(p.cmp['opcionesModalidad']().map((o) => o.id)).toEqual([2, 9]);
    p.cmp['editar'](ANTIGUO);
    expect(p.cmp['form'].controls.NumeroDocIde.value).toBe('');
    expect(p.cmp['opcionesModalidad']().map((o) => o.id)).toEqual([2]);
  });
});

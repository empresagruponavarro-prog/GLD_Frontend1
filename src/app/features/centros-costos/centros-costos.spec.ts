import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { HttpRequest } from '@angular/common/http';
import { misPermisos } from '@app/core/auth/auth.testing';
import { ClaveModulo, Permisos } from '@app/core/auth/permisos.models';
import { botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { CatalogosFiltros, CentroCosto, PaginatedCentrosCostos } from './interfaces';
import { CentrosCostosComponent } from './centros-costos';

const CC: CentroCosto = { id: 5, CentroCosto: 'Obra Tambo San Miguel', Estado: 'ABIERTO', periodo: 2026, CodCliente: 'ACME', Cliente: 'ACME' };

function responder(req: HttpRequest<unknown>) {
  if (req.url.endsWith('/centros-costos')) {
    const pagina: PaginatedCentrosCostos = { data: [CC], total: 1, page: 1, pageSize: 20, totalPages: 1 };
    return pagina;
  }
  if (req.url.endsWith('/catalogos-filtros')) {
    const catalogos: CatalogosFiltros = { empresas: [], clientes: [], periodos: [], estados: [], pptoEstados: [] };
    return catalogos;
  }
  return [];
}

const BOTONES = { nuevo: 'Nuevo Centro', ppto: 'Ir a Presupuestos', datos: 'Datos', editar: 'Editar', eliminar: 'Eliminar' };
const NINGUNO = { nuevo: false, ppto: false, datos: false, editar: false, eliminar: false };

async function montar(acciones: Partial<Permisos>, otros: Partial<Record<ClaveModulo, Partial<Permisos>>> = {}) {
  const permisos = misPermisos('Usuario', { 'centros-costos': acciones, ...otros });
  const p = await montarPantalla(CentrosCostosComponent, permisos, responder);
  expect(p.el.textContent).toContain('Obra Tambo San Miguel');
  return p;
}

describe('CentrosCostosComponent: botones según permisos (centros-costos)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver no aparecen Nuevo, Ppto, Datos, Editar ni Eliminar', async () => {
    const { el } = await montar({});
    expect(botonesVisibles(el, BOTONES)).toEqual(NINGUNO);
  });

  it('crear → Nuevo; editar → Editar; eliminar → Eliminar', async () => {
    expect(botonesVisibles((await montar({ crear: true })).el, BOTONES)).toEqual({ ...NINGUNO, nuevo: true });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ editar: true })).el, BOTONES)).toEqual({ ...NINGUNO, editar: true });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ eliminar: true })).el, BOTONES)).toEqual({ ...NINGUNO, eliminar: true });
  });

  it('"Ppto" exige crear en presupuestos y "Datos" acceso a obra', async () => {
    expect(botonesVisibles((await montar({}, { presupuestos: {} })).el, BOTONES)).toEqual(NINGUNO);
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({}, { presupuestos: { crear: true } })).el, BOTONES)).toEqual({ ...NINGUNO, ppto: true });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({}, { obra: {} })).el, BOTONES)).toEqual({ ...NINGUNO, datos: true });
  });

  it('el modal muestra "Duplicar" solo con crear', async () => {
    const soloEditar = await montar({ editar: true });
    soloEditar.el.querySelector<HTMLButtonElement>('[title="Editar"]')?.click();
    soloEditar.http.match((r) => r.url.endsWith('/resumen-financiero')).forEach((r) => r.flush({}));
    await soloEditar.render();
    expect(soloEditar.el.textContent).toContain('Guardar Centro de Costo');
    expect(botonesVisibles(soloEditar.el, { duplicar: 'Duplicar' })).toEqual({ duplicar: false });
    TestBed.resetTestingModule();

    const ambos = await montar({ editar: true, crear: true });
    ambos.el.querySelector<HTMLButtonElement>('[title="Editar"]')?.click();
    ambos.http.match((r) => r.url.endsWith('/resumen-financiero')).forEach((r) => r.flush({}));
    await ambos.render();
    expect(botonesVisibles(ambos.el, { duplicar: 'Duplicar' })).toEqual({ duplicar: true });
  });
});

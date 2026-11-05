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
  if (req.url.includes('/proyectos/catalogos/periodos')) return [{ anio: 2026, activo: true }, { anio: 2027, activo: true }];
  if (req.url.includes('/proyectos/catalogos/tipos-proyecto')) return [{ id: 1, nombre: 'TAMBO' }, { id: 2, nombre: 'ARUMA' }];
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

  it('«solo consulta» (S-10): sin permisos de escritura ninguna fila tiene botones de acción y no hay alta', async () => {
    // Promotor, Supervisor y Usuario quedan así tras la migración M4: ver sin crear, editar ni eliminar.
    const { el } = await montar({ ver: true }, { presupuestos: {} });

    expect(el.querySelectorAll('.table-actions button')).toHaveLength(0);
    expect(el.querySelector('.table-actions')).not.toBeNull();
    expect(Array.from(el.querySelectorAll('button')).some((b) => /Nuevo Centro/.test(b.textContent ?? ''))).toBe(false);
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

describe('CentrosCostosComponent: formulario (GRP)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const abrirNuevo = async () => {
    const p = await montar({ crear: true });
    (Array.from(p.el.querySelectorAll('button')).find((b) => b.textContent?.includes('Nuevo Centro')) as HTMLButtonElement).click();
    await p.render();
    p.fixture.detectChanges();
    return p;
  };
  const abrirEdicion = async () => {
    const p = await montar({ editar: true });
    p.el.querySelector<HTMLButtonElement>('[title="Editar"]')?.click();
    p.http.match((r) => r.url.endsWith('/resumen-financiero')).forEach((r) => r.flush({}));
    await p.render();
    p.fixture.detectChanges();
    return p;
  };
  const segmentos = (el: HTMLElement) => Array.from(el.querySelectorAll('.cc-segmented:not(.cc-segmented-state) .cc-segment')).map((b) => b.textContent?.trim());

  it('los periodos salen del catálogo (con 2027 activo) y no de una lista fija', async () => {
    const p = await abrirNuevo();
    expect(segmentos(p.el)).toEqual(['2026', '2027']);
    expect(p.cmp.formData.periodo).toBe(new Date().getFullYear());
  });

  it('al editar se conserva el periodo del centro de costo aunque ya no esté activo', async () => {
    const p = await abrirEdicion();
    p.cmp.formData.periodo = 2024;
    p.fixture.detectChanges();
    expect(p.cmp.periodosDisponibles()).toEqual([2024, 2026, 2027]);
  });

  it('al cambiar la fecha de inicio, el periodo pasa al año de esa fecha si está activo', async () => {
    const p = await abrirNuevo();
    p.cmp.onFechaInicioChange('2027-03-01');
    expect(p.cmp.formData.periodo).toBe(2027);
    expect(p.cmp.periodoNoCoincide()).toBe(false);
    // Un año que no está en el catálogo no se impone: el periodo se queda y se avisa.
    // Igual que en la pantalla: el cambio llega por el evento del campo de fecha.
    const fecha = Array.from(p.el.querySelectorAll<HTMLInputElement>('input[type="date"]'))[0];
    fecha.value = '2031-01-15';
    fecha.dispatchEvent(new Event('input'));
    p.fixture.detectChanges();
    expect(p.cmp.formData.periodo).toBe(2027);
    expect(p.cmp.periodoNoCoincide()).toBe(true);
    expect(p.el.textContent).toContain('no coincide con el año de la fecha de inicio (2031)');
  });

  it('la fecha de fin real no se edita al crear y sí al editar', async () => {
    const nuevo = await abrirNuevo();
    expect(nuevo.el.querySelector<HTMLInputElement>('#cc-fin-real')?.disabled).toBe(true);
    TestBed.resetTestingModule();
    const edicion = await abrirEdicion();
    expect(edicion.el.querySelector<HTMLInputElement>('#cc-fin-real')?.disabled).toBe(false);
    expect(edicion.el.textContent).toContain('100 % de avance');
  });

  it('el estado y los montos del presupuesto son de solo lectura (los calcula el presupuesto)', async () => {
    const p = await abrirEdicion();
    const modal = p.el;
    expect(modal.textContent).toContain('Solo lectura: se calcula desde los presupuestos');
    const numeros = Array.from(modal.querySelectorAll<HTMLInputElement>('input[type="number"]'));
    expect(numeros).toHaveLength(4);
    expect(numeros.every((i) => i.readOnly)).toBe(true);
    expect(modal.querySelector<HTMLSelectElement>('select[aria-label="Estado del presupuesto (solo lectura)"]')?.disabled).toBe(true);
  });

  it('el tipo de proyecto se elige del catálogo y viaja en el payload (null lo quita)', async () => {
    const p = await abrirEdicion();
    const opciones = Array.from(p.el.querySelectorAll('#cc-tipo-proyecto option')).map((o) => o.textContent?.trim());
    expect(opciones).toEqual(['— Sin tipo —', 'TAMBO', 'ARUMA']);
    p.cmp.formData.id_tipo_proyecto = 2;
    expect(p.cmp.buildPayload().id_tipo_proyecto).toBe(2);
    p.cmp.formData.id_tipo_proyecto = null;
    expect(p.cmp.buildPayload().id_tipo_proyecto).toBeNull();
  });

  it('avisa que una obra se cierra al liquidarla', async () => {
    const p = await abrirEdicion();
    expect(p.el.textContent).toContain('Una obra se cierra al liquidarla');
  });
});

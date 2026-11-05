import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { misPermisos } from '@app/core/auth/auth.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { montarPantalla } from '@app/core/auth/pantalla.testing';
import { PeriodoFiscal, TipoPlano, TipoProyecto } from './catalogos.models';
import { CatalogosProyectoComponent } from './catalogos';

const PLANOS: TipoPlano[] = [
  { id: 1, codigo: 'ARQ', nombre: 'ARQUITECTURA', disciplina: 'ARQUITECTURA', activo: true, orden: 1 },
  { id: 2, codigo: 'EST', nombre: 'ESTRUCTURAS', disciplina: null, activo: true, orden: 2 },
  { id: 3, codigo: 'OLD', nombre: 'ANTIGUO', disciplina: null, activo: false, orden: 3 },
];
const TIPOS: TipoProyecto[] = [
  { id: 10, nombre: 'TAMBO', activo: true, orden: 1, planos: [{ id_tipo_plano: 1, codigo: 'ARQ', nombre: 'ARQUITECTURA', obligatorio: true }] },
  { id: 11, nombre: 'OTROS', activo: false, orden: 2, planos: [] },
];
const ANIOS: PeriodoFiscal[] = [
  { anio: 2026, activo: true },
  { anio: 2027, activo: true },
];

const responder = (req: { url: string }) => {
  if (req.url.endsWith('/tipos-proyecto')) return TIPOS;
  if (req.url.endsWith('/tipos-plano')) return PLANOS;
  if (req.url.endsWith('/periodos')) return ANIOS;
  return [];
};

async function montar(acciones: Partial<Permisos>) {
  return montarPantalla(CatalogosProyectoComponent, misPermisos('Usuario', { 'proyectos.catalogos': acciones }), responder);
}

const clic = (el: HTMLElement, selector: string) => el.querySelector<HTMLElement>(selector)!.click();
const escribir = (el: HTMLElement, selector: string, valor: string) => {
  const input = el.querySelector<HTMLInputElement>(selector)!;
  input.value = valor;
  input.dispatchEvent(new Event('input'));
};

/** Tras una escritura el componente recarga los tres catálogos: se responden para poder esperar. */
async function recargar(p: Awaited<ReturnType<typeof montar>>) {
  for (let i = 0; i < 4; i++) {
    await p.render();
    const pendientes = p.http.match(() => true);
    if (pendientes.length === 0) return;
    for (const r of pendientes) r.flush(responder(r.request));
  }
}

describe('CatalogosProyectoComponent (GRP T76)', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.restoreAllMocks();
  });

  it('con solo ver lista los tipos de proyecto con su resumen de planos y sin botones de escritura', async () => {
    const { el } = await montar({});

    expect(el.querySelector('[data-tipo-proyecto="10"]')?.textContent).toContain('1 plano(s), 1 obligatorio(s)');
    expect(el.querySelector('[data-tipo-proyecto="11"]')?.textContent).toContain('Sin planos');
    expect(el.querySelector('#btn-crear-tipo-proyecto')).toBeNull();
    expect(el.querySelector('[title="Desactivar"]')).toBeNull();
    expect(el.querySelector('[title="Eliminar"]')).toBeNull();
    expect(el.querySelector('[title="Ver / editar planos"]')).not.toBeNull();
  });

  it('con crear agrega un tipo de proyecto', async () => {
    const p = await montar({ crear: true });
    escribir(p.el, '#nuevo-tipo-proyecto', 'ARUMA');
    await p.render();
    clic(p.el, '#btn-crear-tipo-proyecto');

    const req = p.http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/tipos-proyecto'));
    expect(req.request.body).toEqual({ nombre: 'ARUMA' });
    req.flush({ id: 12 });
    await recargar(p);
  });

  it('el editor de planos manda la lista completa con lo obligatorio', async () => {
    const p = await montar({ editar: true });
    clic(p.el, '[data-tipo-proyecto="10"] [title="Ver / editar planos"]');
    await p.render();

    const select = (id: number) => p.el.querySelector<HTMLSelectElement>(`#inclusion-${id}`)!;
    expect(select(1).value).toBe('OBLIGATORIO');
    expect(select(2).value).toBe('NO');
    expect(p.el.querySelector('#inclusion-3')).toBeNull(); // los inactivos no se ofrecen

    select(2).value = 'SI';
    select(2).dispatchEvent(new Event('change'));
    clic(p.el, '#btn-guardar-planos');

    const req = p.http.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/tipos-proyecto/10/planos'));
    expect((req.request.body as { planos: unknown[] }).planos).toEqual([
      { id_tipo_plano: 1, obligatorio: true },
      { id_tipo_plano: 2, obligatorio: false },
    ]);
    req.flush(TIPOS[0]);
    await recargar(p);
    expect(p.el.querySelector('[data-testid="editor-planos"]')).toBeNull();
  });

  it('sin editar, el editor de planos es de solo consulta', async () => {
    const p = await montar({});
    clic(p.el, '[data-tipo-proyecto="10"] [title="Ver / editar planos"]');
    await p.render();

    expect(p.el.querySelector<HTMLSelectElement>('#inclusion-1')?.disabled).toBe(true);
    expect(p.el.querySelector('#btn-guardar-planos')).toBeNull();
  });

  it('un 409 al eliminar se muestra tal cual', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const p = await montar({ eliminar: true });
    clic(p.el, '[data-tipo-proyecto="10"] [title="Eliminar"]');

    p.http
      .expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/tipos-proyecto/10'))
      .flush({ message: 'Hay centros de costo de este tipo: desactívelo en lugar de eliminarlo' }, { status: 409, statusText: 'Conflict' });
    await p.render();

    expect(p.el.querySelector('[data-testid="cat-error"]')?.textContent).toContain('desactívelo en lugar de eliminarlo');
  });

  it('tipos de plano: alta con código y nombre', async () => {
    const p = await montar({ crear: true });
    clic(p.el, '#tab-tipos-plano');
    await p.render();
    escribir(p.el, '#nuevo-plano-codigo', 'SAN');
    escribir(p.el, '#nuevo-plano-nombre', 'SANITARIAS');
    await p.render();
    clic(p.el, '#btn-crear-tipo-plano');

    const req = p.http.expectOne((r) => r.method === 'POST' && r.url.endsWith('/tipos-plano'));
    expect(req.request.body).toEqual({ codigo: 'SAN', nombre: 'SANITARIAS' });
    req.flush({ id: 9 });
    await recargar(p);
  });

  it('años fiscales: activar/desactivar y agregar un año nuevo (PUT, permiso editar)', async () => {
    const p = await montar({ editar: true });
    clic(p.el, '#tab-periodos');
    await p.render();

    clic(p.el, '[data-anio="2027"] [title="Desactivar"]');
    const off = p.http.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/periodos/2027'));
    expect(off.request.body).toEqual({ activo: false });
    off.flush({ anio: 2027, activo: false });
    await recargar(p);

    escribir(p.el, '#nuevo-anio', '2028');
    await p.render();
    clic(p.el, '#btn-agregar-anio');
    const nuevo = p.http.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/periodos/2028'));
    expect(nuevo.request.body).toEqual({ activo: true });
    nuevo.flush({ anio: 2028, activo: true });
    await recargar(p);
  });

  it('años fiscales: rechaza un año fuera de rango o repetido sin llamar a la API', async () => {
    const p = await montar({ editar: true });
    clic(p.el, '#tab-periodos');
    await p.render();

    escribir(p.el, '#nuevo-anio', '1999');
    await p.render();
    clic(p.el, '#btn-agregar-anio');
    await p.render();
    expect(p.el.querySelector('[data-testid="cat-error"]')?.textContent).toContain('entre 2000 y 2100');

    escribir(p.el, '#nuevo-anio', '2026');
    await p.render();
    clic(p.el, '#btn-agregar-anio');
    await p.render();
    expect(p.el.querySelector('[data-testid="cat-error"]')?.textContent).toContain('ya está en la lista');
    p.http.expectNone((r) => r.method === 'PUT');
  });
});

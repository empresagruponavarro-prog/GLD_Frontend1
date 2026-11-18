import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { HttpRequest } from '@angular/common/http';
import { misPermisos } from '@app/core/auth/auth.testing';
import { botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { ClaveModulo, Permisos } from '@app/core/auth/permisos.models';
import { paginaDe, requerimiento } from '../requerimientos.testing';
import { RequerimientosListaComponent } from './requerimientos-lista';

const BORRADOR = requerimiento({ id: 5, numero: 'FUR-000005', estado: 'BORRADOR' });
const APROBADO = requerimiento({ id: 6, numero: 'FUR-000006', estado: 'APROBADO', tipo: 'COMPRA', avance: 'SIN_ATENDER' });

function responder(req: HttpRequest<unknown>) {
  if (req.url.endsWith('/requerimientos')) return paginaDe([BORRADOR, APROBADO]);
  return [];
}

const BOTONES = {
  nuevo: 'Nuevo requerimiento',
  verEditar: 'Ver / editar',
  verDetalle: 'Ver detalle',
  enviar: 'Enviar a aprobación',
  eliminar: 'Eliminar borrador',
  anular: 'Anular',
  generarOc: 'Generar orden de compra',
};

async function montar(modulos: Partial<Record<ClaveModulo, Partial<Permisos>>>) {
  const p = await montarPantalla(RequerimientosListaComponent, misPermisos('Usuario', modulos), responder);
  expect(p.el.textContent).toContain('FUR-000005');
  return p;
}

describe('RequerimientosListaComponent: botones según permisos (requerimientos)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver: sin Nuevo, Eliminar borrador ni Generar OC; el enlace dice "Ver"; Enviar y Anular (basta ver) siguen', async () => {
    const { el } = await montar({ requerimientos: {} });
    expect(botonesVisibles(el, BOTONES)).toEqual({
      nuevo: false,
      verEditar: false,
      verDetalle: true,
      enviar: true,
      eliminar: false,
      anular: true,
      generarOc: false,
    });
    // El enlace al formulario sigue disponible para todas las filas (solo lectura hasta D3).
    expect(el.querySelectorAll('a[title="Ver detalle"]').length).toBe(2);
    expect(el.querySelector('.fa-pen-to-square')).toBeNull();
  });

  it('Enviar y Anular conservan su regla de estado: Enviar solo en editables, Anular no en BORRADOR', async () => {
    const { el } = await montar({ requerimientos: {} });
    const filas = Array.from(el.querySelectorAll('tbody tr'));
    const titulos = (fila: Element) => Array.from(fila.querySelectorAll('button, a')).map((b) => b.getAttribute('title'));
    const borrador = filas.find((f) => f.textContent?.includes('FUR-000005'));
    const aprobado = filas.find((f) => f.textContent?.includes('FUR-000006'));
    expect(borrador && titulos(borrador)).toEqual(['Ver detalle', 'Enviar a aprobación']);
    expect(aprobado && titulos(aprobado)).toEqual(['Ver detalle', 'Anular']);
  });

  it('crear → Nuevo; editar → "Ver / editar"; eliminar → Eliminar borrador', async () => {
    expect(botonesVisibles((await montar({ requerimientos: { crear: true } })).el, BOTONES)).toMatchObject({ nuevo: true, verEditar: false, eliminar: false });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ requerimientos: { editar: true } })).el, BOTONES)).toMatchObject({ nuevo: false, verEditar: true, eliminar: false });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ requerimientos: { eliminar: true } })).el, BOTONES)).toMatchObject({ nuevo: false, verEditar: false, eliminar: true });
  });

  it('Generar OC exige crear en documentos.origen (no basta verlo)', async () => {
    const soloVer = await montar({ requerimientos: {}, 'documentos.origen': {} });
    expect(botonesVisibles(soloVer.el, BOTONES)['generarOc']).toBe(false);
    TestBed.resetTestingModule();
    const conCrear = await montar({ requerimientos: {}, 'documentos.origen': { crear: true } });
    expect(botonesVisibles(conCrear.el, BOTONES)['generarOc']).toBe(true);
  });
});


describe('RequerimientosListaComponent: FUR que nacen de un presupuesto (plan 09)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const DESDE_PPTO = requerimiento({
    id: 8,
    numero: 'FUR-000008',
    estado: 'APROBADO',
    tipo: 'COMPRA',
    avance: 'SIN_ATENDER',
    origen: 'PPTO_ADJUDICACION',
    id_ppto_principal: 7,
    codigo_presupuesto: 'PPTO-2026-007',
    provisional: true,
  });

  async function montarConPresupuesto() {
    const responderPpto = (req: HttpRequest<unknown>) => (req.url.endsWith('/requerimientos') ? paginaDe([DESDE_PPTO, BORRADOR]) : []);
    const p = await montarPantalla(RequerimientosListaComponent, misPermisos('Usuario', { requerimientos: { editar: true }, 'documentos.origen': { crear: true } }), responderPpto);
    expect(p.el.textContent).toContain('FUR-000008');
    return p;
  }

  it('muestra de qué presupuesto viene y que sus órdenes son provisionales', async () => {
    const { el } = await montarConPresupuesto();
    expect(el.querySelector('[data-testid="origen-presupuesto"]')?.textContent).toContain('PPTO-2026-007');
    expect(el.textContent).toContain('Provisional');
  });

  it('un FUR con órdenes provisionales no se anula ni genera otra orden a mano: lo gestiona el presupuesto', async () => {
    const { el } = await montarConPresupuesto();
    expect(botonesVisibles(el, { anular: 'Anular', generarOc: 'Generar orden de compra' })).toEqual({ anular: false, generarOc: false });
  });

  it('el filtro de origen manda el parámetro al servidor', async () => {
    const p = await montarConPresupuesto();
    const select = p.el.querySelector<HTMLSelectElement>('select[aria-label="Origen del requerimiento"]');
    expect(select).not.toBeNull();
    select!.value = 'PPTO_ADJUDICACION';
    select!.dispatchEvent(new Event('change'));
    const req = p.http.expectOne((r: HttpRequest<unknown>) => r.url.endsWith('/requerimientos') && r.params.get('origen') === 'PPTO_ADJUDICACION');
    req.flush(paginaDe([DESDE_PPTO]));
    await p.render();
  });
});

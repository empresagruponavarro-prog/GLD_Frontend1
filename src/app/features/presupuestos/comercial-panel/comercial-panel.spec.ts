import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PresupuestoComercial } from '../presupuestos.service';
import { ComercialPanelComponent } from './comercial-panel';

const item = (id_item: number, meta: number, comercial: number, extra = {}) => ({
  id_item,
  codigo: `P-${id_item}`,
  descripcion: `Ítem ${id_item}`,
  cantidad: 10,
  meta,
  comercial,
  diferencia: comercial - meta,
  diferencia_pct: meta === 0 ? null : Math.round(((comercial - meta) / meta) * 10000) / 100,
  proveedor: comercial === meta ? null : 'ACME SAC',
  adjudicado: comercial !== meta,
  sin_tipo_cambio: false,
  ...extra,
});

const datos = (fases: PresupuestoComercial['fases'], total = { meta: 1100, comercial: 1000, diferencia: -100 }): PresupuestoComercial => ({
  id: 7,
  id_presupuesto: 'PPTO-2026-007',
  proyecto: 'OBRA',
  id_centro_costo: 3,
  estado_ppto: 'EN_DESARROLLO',
  fases,
  total,
  fases_cotizadas: fases.filter((f) => f.fuente !== 'META').length,
});

const faseMixta = {
  id_fase: 1,
  nombre_fase: 'PRELIMINARES',
  meta: 1100,
  comercial: 1000,
  fuente: 'MIXTA' as const,
  items: [item(1, 600, 500), item(2, 500, 500)],
  items_adjudicados: 1,
  requerimientos: [],
  sin_tipo_cambio: false,
};

async function montar(d: PresupuestoComercial) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [ComercialPanelComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(ComercialPanelComponent);
  fixture.componentRef.setInput('idPresupuesto', 'PPTO-2026-007');
  fixture.detectChanges();
  TestBed.inject(HttpTestingController)
    .expectOne((r) => r.url.endsWith('/presupuestos/PPTO-2026-007/comercial'))
    .flush(d);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ComercialPanelComponent', () => {
  it('sin proveedores elegidos dice que el Comercial es igual al Meta y no muestra la tabla', async () => {
    const el = await montar(
      datos([{ ...faseMixta, comercial: 1100, fuente: 'META', items_adjudicados: 0, items: [item(1, 600, 600), item(2, 500, 500)] }], { meta: 1100, comercial: 1100, diferencia: 0 }),
    );
    expect(el.textContent).toContain('el Comercial es igual al Meta');
    expect(el.querySelector('table')).toBeNull();
  });

  it('con proveedores muestra Meta, Comercial y la diferencia por fase y por ítem', async () => {
    const el = await montar(datos([faseMixta]));
    expect(el.textContent).toContain('PRELIMINARES');
    expect(el.textContent).toContain('1 / 2');
    expect(el.textContent).toContain('Parte con proveedor, el resto al Meta');
    expect(el.textContent).toContain('El Meta no cambia');
    // Diferencia de la fase y del ítem adjudicado (con su porcentaje).
    expect(el.textContent).toContain('-100');
    expect(el.textContent).toContain('(-16.67 %)');
    expect(el.textContent).toContain('ACME SAC');
    expect(el.textContent).toContain('Sin proveedor');
    expect(el.querySelector('tfoot')?.textContent).toContain('Total');
  });

  it('un ítem con proveedor en otra moneda sin tipo de cambio avisa que queda al Meta', async () => {
    const f = { ...faseMixta, sin_tipo_cambio: true, items: [item(1, 600, 600, { adjudicado: false, sin_tipo_cambio: true, proveedor: 'GLOBAL INC' }), item(2, 500, 400)] };
    const el = await montar(datos([f]));
    expect(el.textContent).toContain('falta tipo de cambio');
    expect(el.textContent).toContain('sin tipo de cambio');
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CompromisosPresupuesto } from '../cotizaciones-ppto/cotizaciones-ppto.models';
import { CompromisosPanelComponent } from './compromisos-panel';

const datos = (sobre: Partial<CompromisosPresupuesto> = {}): CompromisosPresupuesto => ({
  id_presupuesto: 7,
  codigo_presupuesto: 'PPTO-2026-007',
  estado: 'EN_DESARROLLO',
  items_total: 4,
  items_adjudicados: 3,
  items_sin_adjudicar: [{ id_ppto_item: 9, codigo: 'P-9', descripcion: 'Pintura', fase: 'ACABADOS' }],
  conflictos: [],
  compromisos: [
    {
      id_requerimiento: 31,
      numero: 'FUR-000031',
      estado_requerimiento: 'APROBADO',
      estado: 'PROVISIONAL',
      fase: 'ACABADOS',
      id_proveedor: 3,
      proveedor: 'ACME SAC',
      lineas: 2,
      documentos: [
        { id: 12, numero_documento: 'OC-000012', clase: 'ORDEN_COMPRA', estado: 'PROVISIONAL', total: '118.00', moneda_simbolo: 'S/', fecha_emision: '2026-11-18' },
        { id: 13, numero_documento: 'OS-000004', clase: 'ORDEN_SERVICIO', estado: 'PROVISIONAL', total: '59.00', moneda_simbolo: 'S/', fecha_emision: '2026-11-18' },
      ],
    },
  ],
  ...sobre,
});

async function montar(d: CompromisosPresupuesto) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [CompromisosPanelComponent], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
  const fixture = TestBed.createComponent(CompromisosPanelComponent);
  fixture.componentRef.setInput('idPresupuesto', 7);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  http.expectOne((r) => r.url.endsWith('/presupuestos/7/compromisos')).flush(d);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, http };
}

describe('CompromisosPanelComponent', () => {
  it('muestra el avance de adjudicación, los ítems sin proveedor y los FUR con sus órdenes provisionales', async () => {
    const { el } = await montar(datos());
    expect(el.textContent).toContain('3 de 4 ítem(s) con proveedor ganador');
    expect(el.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('75');
    expect(el.textContent).toContain('Faltan ítems por adjudicar (1)');
    expect(el.textContent).toContain('P-9 — Pintura');
    expect(el.textContent).toContain('FUR-000031');
    expect(el.textContent).toContain('OC OC-000012');
    expect(el.textContent).toContain('OS OS-000004');
    expect(el.textContent).toContain('Provisional');
    expect(el.textContent).toContain('no se programan, pagan ni reciben');
  });

  it('las órdenes enlazan a su impresión y el FUR a su pantalla', async () => {
    const { el } = await montar(datos());
    const enlaces = Array.from(el.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(enlaces).toContain('/requerimientos/31');
    expect(enlaces).toContain('/imprimir/documento-origen/12');
    expect(enlaces).toContain('/imprimir/documento-origen/13');
  });

  it('con todo adjudicado y las órdenes registradas no avisa de pendientes ni de provisionales', async () => {
    const d = datos({ items_adjudicados: 4, items_sin_adjudicar: [] });
    d.compromisos[0].estado = 'REGISTRADO';
    d.compromisos[0].documentos.forEach((o) => (o.estado = 'REGISTRADO'));
    const { el } = await montar(d);
    expect(el.textContent).not.toContain('Faltan ítems por adjudicar');
    expect(el.textContent).not.toContain('no se programan, pagan ni reciben');
    expect(el.textContent).toContain('Registrada');
    expect(el.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('100');
  });

  it('los conflictos con una orden de una versión anterior se destacan y dicen cómo resolverlos', async () => {
    const { el } = await montar(datos({ conflictos: [{ id_ppto_item: 9, codigo: 'P-9', documentos: ['OS-000002'] }] }));
    const alerta = el.querySelector('[role="alert"]');
    expect(alerta?.textContent).toContain('P-9 (OS-000002)');
    expect(alerta?.textContent).toContain('Anule la orden anterior o vuelva a adjudicar al mismo proveedor');
  });

  it('un FUR anulado se ve atenuado y sin pendientes si no hay ninguno', async () => {
    const d = datos({ items_sin_adjudicar: [] });
    d.compromisos[0].estado = 'ANULADO';
    d.compromisos[0].documentos.forEach((o) => (o.estado = 'ANULADO'));
    const { el } = await montar(d);
    expect(el.textContent).toContain('Anulada');
    expect(el.querySelector('tbody tr')?.className).toContain('opacity-60');
  });

  it('sin FUR explica que se crean solos al elegir un ganador', async () => {
    const { el } = await montar(datos({ compromisos: [], items_adjudicados: 0 }));
    expect(el.textContent).toContain('Todavía no se generó ningún FUR');
  });
});

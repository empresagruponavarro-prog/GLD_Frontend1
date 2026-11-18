import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { environment } from '@env';
import { ImprimirComponent } from './imprimir';

const PECOSA = {
  id: 4,
  numero: 'SAL-000004',
  naturaleza: 'SALIDA',
  motivo: 'CONSUMO',
  fecha: '2026-11-05',
  almacen: 'Almacén central',
  centro_costo: 'Tienda Norte',
  documento_referencia: 'VALE-9',
  solicitado_por: 'Ana Ruiz',
  entregado_a: 'Luis Paz',
  motivo_trabajo: 'Vaciado de losa',
  observaciones: null,
  estado: 'REGISTRADO',
  lineas: [
    { id: 1, id_producto: 1, codigo: 'P-1', descripcion: 'Cemento', unidad: 'BOL', cantidad: '3', costo_unitario: '7', subfase: 'MATERIALES', id_ppto_detalle_categoria: 40 },
    { id: 2, id_producto: 2, codigo: 'P-2', descripcion: 'Arena', unidad: 'M3', cantidad: '2', costo_unitario: '10', subfase: 'MATERIALES', id_ppto_detalle_categoria: 40 },
  ],
};

describe('ImprimirComponent: PECOSA', () => {
  async function montar() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { tipo: 'pecosa' }, paramMap: convertToParamMap({ id: '4' }), queryParamMap: convertToParamMap({}) } } },
      ],
    });
    const fixture = TestBed.createComponent(ImprimirComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.match((r) => r.url.includes('/empresa')).forEach((r) => r.flush([{ razon_social: 'GLD SAC', ruc: '20123456789' }]));
    http.expectOne(`${environment.apiUrl}/almacen/salidas/4`).flush(PECOSA);
    await fixture.whenStable();
    fixture.detectChanges();
    return { el: fixture.nativeElement as HTMLElement, http };
  }

  it('imprime la salida con su obra, sus subfases y el total imputado', async () => {
    const { el, http } = await montar();

    expect(el.querySelector('h1')?.textContent).toContain('PECOSA');
    expect(el.textContent).toContain('SAL-000004');
    expect(el.textContent).toContain('Tienda Norte');
    expect(el.textContent).toContain('Vaciado de losa');
    expect(Array.from(el.querySelectorAll('tbody tr')).map((f) => f.textContent)).toEqual([
      expect.stringContaining('MATERIALES'),
      expect.stringContaining('MATERIALES'),
    ]);
    // 3 × 7 + 2 × 10 = 41
    expect(el.querySelector('.imp-total')?.textContent).toContain('41.00');
    expect(el.textContent).toContain('Almacén (entregó)');
    http.verify();
  });

  async function montarOrden(id: string, cuerpo: object) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { tipo: 'documento-origen' }, paramMap: convertToParamMap({ id }), queryParamMap: convertToParamMap({}) } } },
      ],
    });
    const fixture = TestBed.createComponent(ImprimirComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.match((r) => r.url.includes('/empresa')).forEach((r) => r.flush([]));
    http.expectOne((r) => r.url.endsWith(`/administracion/documentos-origen/${id}`)).flush(cuerpo);
    await fixture.whenStable();
    fixture.detectChanges();
    http.verify();
    return fixture.nativeElement as HTMLElement;
  }

  const MONTOS = { monto: '100.00', igv: '18.00', total: '118.00', renta_4ta: '0', dscto_compras: '0', dscto_intervencion: '0', dscto_otros: '0', neto_proveedor: '118.00', lineas: [], programaciones: [], pagos: [], tope_avance: null };

  it('una orden provisional lleva la marca de agua y las condiciones de su cotización', async () => {
    const el = await montarOrden('12', {
      ...MONTOS,
      id: 12,
      numero_documento: 'OS-000012',
      numero_oc: null,
      clase_documento: 'ORDEN_SERVICIO',
      estado: 'PROVISIONAL',
      proveedor: 'CONTRATISTA SAC',
      ruc: '20111111111',
      cotizacion: { numero: 'COT-3', referencia: null, plazo_entrega_dias: 20, validez_dias: 15, garantia: '12 MESES', adelanto_porcentaje: '30', medio_pago: null, condiciones: 'INCLUYE MATERIALES MENORES', archivo_url: null },
    });
    expect(el.querySelector('h1')?.textContent).toContain('ORDEN DE SERVICIO');
    expect(el.querySelector('.imp-marca-agua')?.textContent).toContain('PROVISIONAL');
    expect(el.textContent).toContain('20 días');
    expect(el.textContent).toContain('12 MESES');
    expect(el.textContent).toContain('30 %');
    expect(el.textContent).toContain('INCLUYE MATERIALES MENORES');
  });

  it('una orden registrada no lleva marca de agua', async () => {
    const el = await montarOrden('13', { ...MONTOS, id: 13, numero_documento: 'OC-000013', clase_documento: 'ORDEN_COMPRA', estado: 'REGISTRADO', cotizacion: null });
    expect(el.querySelector('.imp-marca-agua')).toBeNull();
    expect(el.querySelector('h1')?.textContent).toContain('ORDEN DE COMPRA');
  });

  it('los formatos nuevos ponen el encabezado de la página y dejan que el formato cargue sus datos', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { tipo: 'ficha-obra' }, paramMap: convertToParamMap({ id: '10' }), queryParamMap: convertToParamMap({}) } } },
      ],
    });
    const fixture = TestBed.createComponent(ImprimirComponent);
    fixture.detectChanges();
    await new Promise<void>((r) => setTimeout(r, 0));
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.match((r) => r.url.includes('/empresa')).forEach((r) => r.flush([]));
    http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/cockpit')).flush({ id_centro_costo: 10, nombre_obra: 'TIENDA NORTE', cabecera: {}, residentes: [], planos: [], documentos: [] });
    await new Promise<void>((r) => setTimeout(r, 0));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('h1')?.textContent).toContain('FICHA TÉCNICA DE LA OBRA');
    expect(el.querySelector('[data-testid="formato-ficha-obra"]')?.textContent).toContain('TIENDA NORTE');
    http.verify();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  CotizacionFormDialogComponent,
  CotizacionFormValue,
  CotizacionInicial,
  LineaCotizable,
} from './cotizacion-form-dialog';

const linea = (id: number, solicitado = '10', extra: Partial<LineaCotizable> = {}): LineaCotizable => ({
  id,
  codigo: `P-${id}`,
  descripcion: `Producto ${id}`,
  unidad: 'UND',
  solicitado,
  precio_ref: '5',
  ...extra,
});

/** Lo que el spec necesita del formulario interno (es protegido: se lee como lo haría la plantilla). */
interface Interno {
  form: {
    patchValue(v: object): void;
    controls: {
      lineas: { length: number; at(i: number): { patchValue(v: object): void; getRawValue(): Record<string, unknown> } };
      total: { value: string };
      adjudicar: { value: boolean };
    };
  };
  onGuardar(): void;
  mensajeError(): string;
  vistaPrevia(): { error: string; filas: { monto: number | null; precioUnitario: number | null; pesoPct: number; cotiza: boolean }[]; suma: number | null; costoMeta: number } | null;
}

describe('CotizacionFormDialogComponent', () => {
  let fixture: ComponentFixture<CotizacionFormDialogComponent>;
  let emitidos: CotizacionFormValue[];
  const interno = () => fixture.componentInstance as unknown as Interno;

  async function abrir(entradas: Record<string, unknown>) {
    for (const [k, v] of Object.entries(entradas)) fixture.componentRef.setInput(k, v);
    fixture.componentRef.setInput('abierto', true);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CotizacionFormDialogComponent] });
    fixture = TestBed.createComponent(CotizacionFormDialogComponent);
    emitidos = [];
    fixture.componentInstance.guardar.subscribe((v) => emitidos.push(v));
  });

  it('modo FUR: exige proveedor y precio, y devuelve las líneas con su id y sin la columna «adjudicar»', async () => {
    await abrir({ lineas: [linea(11), linea(12)], proveedores: [{ id: 3, nombre: 'ACME' }] });
    interno().onGuardar();
    expect(interno().mensajeError()).toMatch(/proveedor/);
    expect(emitidos).toHaveLength(0);

    interno().form.patchValue({ id_proveedor: 3 });
    interno().onGuardar();
    expect(interno().mensajeError()).toMatch(/Ítem 1: indique el precio unitario/);

    interno().form.controls.lineas.at(0).patchValue({ precio_unitario: '4.5' });
    interno().form.controls.lineas.at(1).patchValue({ precio_unitario: '6' });
    interno().onGuardar();
    expect(interno().mensajeError()).toBe('');
    expect(emitidos).toHaveLength(1);
    expect(emitidos[0]).toMatchObject({ id_proveedor: 3, moneda_id: 'PEN', moneda_simbolo: 'S/', forma_pago: 'Contado', dias_credito: 0 });
    expect(emitidos[0].lineas.map((l) => [l.id, l.cotiza, l.cantidad, l.precio_unitario])).toEqual([[11, true, '10', '4.5'], [12, true, '10', '6']]);
    expect(emitidos[0].lineas[0]).not.toHaveProperty('adjudicar');
  });

  it('no deja ofrecer más de lo solicitado, y un ítem que no se cotiza no pide precio', async () => {
    await abrir({ lineas: [linea(11), linea(12)] });
    interno().form.patchValue({ id_proveedor: 3 });
    interno().form.controls.lineas.at(0).patchValue({ cantidad: '11', precio_unitario: '1' });
    interno().onGuardar();
    expect(interno().mensajeError()).toMatch(/no puede ofrecer más de lo solicitado/);

    interno().form.controls.lineas.at(0).patchValue({ cantidad: '10' });
    interno().form.controls.lineas.at(1).patchValue({ cotiza: false });
    interno().onGuardar();
    expect(emitidos).toHaveLength(1);
    expect(emitidos[0].lineas[1]).toMatchObject({ cotiza: false, cantidad: '0', precio_unitario: '0' });
  });

  it('una cotización sin ningún ítem ofrecido se rechaza', async () => {
    await abrir({ lineas: [linea(11)] });
    interno().form.patchValue({ id_proveedor: 3 });
    interno().form.controls.lineas.at(0).patchValue({ cotiza: false });
    interno().onGuardar();
    expect(interno().mensajeError()).toMatch(/al menos un ítem/);
  });

  describe('modo presupuesto (una subpartida: un total que se prorratea)', () => {
    const items = [
      linea(1, '26.45', { costo_total: '431.66' }),
      linea(2, '33.76', { costo_total: '713.01' }),
    ];

    it('propone adjudicar la subpartida solo si ningún ítem tiene ganador todavía', async () => {
      await abrir({ modo: 'presupuesto', lineas: items });
      expect(interno().form.controls.adjudicar.value).toBe(true);
    });

    it('si la subpartida ya tiene proveedor, no propone adjudicar', async () => {
      await abrir({ modo: 'presupuesto', lineas: [linea(1, '10', { costo_total: '50', ganador: 'OTRO SAC' }), linea(2, '5', { costo_total: '30' })] });
      expect(interno().form.controls.adjudicar.value).toBe(false);
    });

    it('no pide precio por ítem: solo el total de la subpartida', async () => {
      await abrir({ modo: 'presupuesto', lineas: items });
      expect(interno().form.controls.lineas.length).toBe(0);
      interno().form.patchValue({ id_proveedor: 3 });
      interno().onGuardar();
      expect(interno().mensajeError()).toMatch(/total de la subpartida/);
      expect(emitidos).toHaveLength(0);
    });

    it('el cuadro de ítems se ve siempre, aun sin total: con su peso en el Meta y sin montos todavía', async () => {
      await abrir({ modo: 'presupuesto', lineas: items });
      const v = interno().vistaPrevia();
      expect(v?.filas).toHaveLength(2);
      expect(v?.error).toMatch(/total de la subpartida/);
      expect(v?.filas.map((f) => f.monto)).toEqual([null, null]);
      expect(v?.filas.map((f) => Math.round(f.pesoPct * 10) / 10)).toEqual([37.7, 62.3]);
      expect(v?.costoMeta).toBeCloseTo(1144.67, 2);
      expect(v?.suma).toBeNull();
      expect(fixture.nativeElement.querySelectorAll('table[aria-label="Ítems de la subpartida y reparto del total"] tbody tr')).toHaveLength(3); // 2 ítems + total
    });

    it('al escribir el total, el cuadro reparte según el costo Meta y la suma sale exacta', async () => {
      await abrir({ modo: 'presupuesto', lineas: items });
      interno().form.patchValue({ total: '1000' });
      const v = interno().vistaPrevia();
      expect(v?.error).toBe('');
      expect(v?.filas.map((f) => f.monto)).toEqual([377.1, 622.9]);
      expect(v?.suma).toBe(1000);
    });

    it('avisa si la subpartida no tiene costo en el Meta (no hay base para repartir)', async () => {
      await abrir({ modo: 'presupuesto', lineas: [linea(1, '4', { costo_total: '0' })] });
      interno().form.patchValue({ id_proveedor: 3, total: '100' });
      interno().onGuardar();
      expect(interno().mensajeError()).toMatch(/no tiene costo en el Meta/);
      expect(emitidos).toHaveLength(0);
    });

    it('emite el total y la marca de adjudicar, sin líneas por ítem', async () => {
      await abrir({ modo: 'presupuesto', lineas: items });
      interno().form.patchValue({ id_proveedor: 3, total: ' 1000.50 ' });
      interno().onGuardar();
      expect(interno().mensajeError()).toBe('');
      expect(emitidos).toHaveLength(1);
      expect(emitidos[0]).toMatchObject({ id_proveedor: 3, total: '1000.50', adjudicar: true, lineas: [] });
    });

    it('al editar trae el total y deja marcada la adjudicación si esta cotización ya gana la subpartida', async () => {
      const inicial: CotizacionInicial = {
        id_proveedor: 3,
        fecha: '2026-11-18',
        referencia: 'A-1',
        moneda_id: 'PEN',
        incluye_igv: false,
        afecto_igv: true,
        forma_pago: 'Credito 30 dias',
        dias_credito: 30,
        adelanto_porcentaje: '20',
        medio_pago: 'TRANSFERENCIA',
        plazo_entrega_dias: 15,
        validez_dias: null,
        garantia: null,
        condiciones: null,
        archivo_url: null,
        lineas: [],
        total_global: '900',
        adjudicada: true,
      };
      await abrir({ modo: 'presupuesto', lineas: items, inicial });
      expect(interno().form.controls.total.value).toBe('900');
      expect(interno().form.controls.adjudicar.value).toBe(true);
      interno().onGuardar();
      expect(emitidos).toHaveLength(1);
      expect(emitidos[0]).toMatchObject({ id_proveedor: 3, referencia: 'A-1', forma_pago: 'Credito 30 dias', dias_credito: 30, adelanto_porcentaje: '20', medio_pago: 'TRANSFERENCIA', plazo_entrega_dias: 15, total: '900', adjudicar: true });
    });
  });
});

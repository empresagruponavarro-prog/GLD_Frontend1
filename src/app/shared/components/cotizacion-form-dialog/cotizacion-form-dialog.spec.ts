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
    controls: { lineas: { at(i: number): { patchValue(v: object): void; getRawValue(): Record<string, unknown> } } };
  };
  onGuardar(): void;
  mensajeError(): string;
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

  describe('modo presupuesto', () => {
    it('propone adjudicar solo los ítems que todavía no tienen ganador', async () => {
      await abrir({ modo: 'presupuesto', lineas: [linea(1), linea(2, '10', { ganador: 'OTRO SAC' })] });
      expect(interno().form.controls.lineas.at(0).getRawValue()['adjudicar']).toBe(true);
      expect(interno().form.controls.lineas.at(1).getRawValue()['adjudicar']).toBe(false);
    });

    it('al abrir desde un ítem solo ese queda para cotizar', async () => {
      await abrir({ modo: 'presupuesto', lineas: [linea(1), linea(2), linea(3)], marcadas: [2] });
      expect([0, 1, 2].map((i) => interno().form.controls.lineas.at(i).getRawValue()['cotiza'])).toEqual([false, true, false]);
    });

    it('para adjudicar un ítem debe cotizar la cantidad completa (un ítem va completo a un solo proveedor)', async () => {
      await abrir({ modo: 'presupuesto', lineas: [linea(1)] });
      interno().form.patchValue({ id_proveedor: 3 });
      interno().form.controls.lineas.at(0).patchValue({ cantidad: '6', precio_unitario: '2' });
      interno().onGuardar();
      expect(interno().mensajeError()).toMatch(/cantidad completa/);
      expect(emitidos).toHaveLength(0);

      interno().form.controls.lineas.at(0).patchValue({ adjudicar: false });
      interno().onGuardar();
      expect(emitidos).toHaveLength(1); // cotizar menos cantidad sí se puede, solo no se adjudica
      expect(emitidos[0].lineas[0]).toMatchObject({ cantidad: '6', adjudicar: false });
    });

    it('no se adjudica un ítem que el proveedor no cotiza', async () => {
      await abrir({ modo: 'presupuesto', lineas: [linea(1), linea(2)] });
      interno().form.patchValue({ id_proveedor: 3 });
      interno().form.controls.lineas.at(0).patchValue({ precio_unitario: '2' });
      interno().form.controls.lineas.at(1).patchValue({ cotiza: false, adjudicar: true });
      interno().onGuardar();
      expect(interno().mensajeError()).toMatch(/no puede adjudicarlo/);
    });

    it('al editar trae lo registrado y deja marcado el ítem que esta cotización ya gana', async () => {
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
        lineas: [{ id: 1, cotiza: true, cantidad: '10', precio_unitario: '4', plazo_entrega_dias: null, marca_modelo: null, adjudicada: true }],
      };
      await abrir({ modo: 'presupuesto', lineas: [linea(1), linea(2)], inicial });
      const [l1, l2] = [interno().form.controls.lineas.at(0).getRawValue(), interno().form.controls.lineas.at(1).getRawValue()];
      expect(l1).toMatchObject({ cotiza: true, cantidad: '10', precio_unitario: '4', adjudicar: true });
      expect(l2).toMatchObject({ cotiza: false, adjudicar: false }); // el ítem 2 no estaba en la cotización
      interno().onGuardar();
      expect(emitidos).toHaveLength(1);
      expect(emitidos[0]).toMatchObject({ id_proveedor: 3, referencia: 'A-1', forma_pago: 'Credito 30 dias', dias_credito: 30, adelanto_porcentaje: '20', medio_pago: 'TRANSFERENCIA', plazo_entrega_dias: 15 });
      expect(emitidos[0].lineas[0]).toMatchObject({ id: 1, adjudicar: true }); // sigue ganando el ítem
      expect(emitidos[0].lineas[1]).toMatchObject({ id: 2, cotiza: false, adjudicar: false });
    });
  });
});

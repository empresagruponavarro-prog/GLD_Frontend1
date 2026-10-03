import { Observable, Subject, defer, of, throwError } from 'rxjs';
import {
  FaseCategoriaAGuardar,
  FasesCategoriasWriter,
  crearFasesConCategorias,
  describirFasesFallidas,
} from './presupuestos.orchestration';

function crearApi(fallos: { fase?: string[]; categoria?: string[] } = {}) {
  const llamadas: string[] = [];
  const api: FasesCategoriasWriter = {
    createFaseAsignada: (data) =>
      defer(() => {
        llamadas.push(`fase:${data.IdpptoFase}`);
        return fallos.fase?.includes(data.IdpptoFase)
          ? throwError(() => ({ error: { message: 'HTTP 500' } }))
          : of(data);
      }),
    createCategoriaAsignada: (data) =>
      defer(() => {
        llamadas.push(`cat:${data.IdpptoFase}`);
        return fallos.categoria?.includes(data.IdpptoFase)
          ? throwError(() => ({ message: 'sin conexión' }))
          : of(data);
      }),
  };
  return { api, llamadas };
}

const items: FaseCategoriaAGuardar[] = [
  { idFase: 'F1', nombre: 'Fase uno', idCategoria: 'C1', subtotal: 10 },
  { idFase: 'F2', nombre: 'Fase dos', idCategoria: 'C2', subtotal: 20 },
  { idFase: 'F3', nombre: 'Fase tres', idCategoria: 'C3', subtotal: 30 },
];

describe('crearFasesConCategorias', () => {
  it('escribe fase → categoría por cada fase, en orden, y emite una sola vez al final', () => {
    // Arrange
    const { api, llamadas } = crearApi();
    const emisiones: unknown[] = [];

    // Act
    crearFasesConCategorias(api, { IdPresupuesto: 'P1' }, items, 1).subscribe((r) => emisiones.push(r));

    // Assert
    expect(llamadas).toEqual(['fase:F1', 'cat:F1', 'fase:F2', 'cat:F2', 'fase:F3', 'cat:F3']);
    expect(emisiones).toEqual([[]]);
  });

  it('no emite hasta que responden las 2N peticiones', () => {
    // Arrange
    const respuestas = new Subject<void>();
    const api: FasesCategoriasWriter = {
      createFaseAsignada: () => of({}),
      createCategoriaAsignada: () => respuestas as Observable<any>,
    };
    const emisiones: unknown[] = [];

    // Act
    crearFasesConCategorias(api, {}, items.slice(0, 1), 1).subscribe((r) => emisiones.push(r));

    // Assert
    expect(emisiones).toEqual([]);
    respuestas.next();
    respuestas.complete();
    expect(emisiones).toEqual([[]]);
  });

  it('genera IDs únicos dentro de la operación y envía el contexto', () => {
    // Arrange
    const enviados: any[] = [];
    const api: FasesCategoriasWriter = {
      createFaseAsignada: (d) => { enviados.push(d); return of(d); },
      createCategoriaAsignada: (d) => { enviados.push(d); return of(d); },
    };

    // Act
    crearFasesConCategorias(api, { IdPresupuesto: 'P1' }, items, 99).subscribe();

    // Assert
    const idsFase = enviados.filter((d) => !d.IdPresupuestoDetalleCategoria).map((d) => d.IdPresupuestoDetalle);
    expect(new Set(idsFase).size).toBe(3);
    expect(enviados[0]).toMatchObject({ IdPresupuesto: 'P1', IdpptoFase: 'F1', IdPresupuestoDetalle: 'DF-99-0', CostoDirecto: 10 });
    expect(enviados[1]).toMatchObject({ IdPresupuestoDetalleCategoria: 'DFC-99-0', IdPresupuestoDetalle: 'DF-99-0', IdpptoFaseCategoria: 'C1' });
  });

  it('si falla una fase, no escribe su categoría, continúa con las demás y nombra la fase fallida', () => {
    // Arrange
    const { api, llamadas } = crearApi({ fase: ['F2'] });
    let resultado: any;

    // Act
    crearFasesConCategorias(api, {}, items, 1).subscribe((r) => (resultado = r));

    // Assert
    expect(llamadas).toEqual(['fase:F1', 'cat:F1', 'fase:F2', 'fase:F3', 'cat:F3']);
    expect(resultado).toEqual([{ nombre: 'Fase dos', motivo: 'HTTP 500' }]);
  });

  it('si falla una categoría, reporta esa fase y no oculta el resto de fallos', () => {
    // Arrange
    const { api } = crearApi({ categoria: ['F1'], fase: ['F3'] });
    let resultado: any;

    // Act
    crearFasesConCategorias(api, {}, items, 1).subscribe((r) => (resultado = r));

    // Assert
    expect(resultado.map((f: any) => f.nombre)).toEqual(['Fase uno', 'Fase tres']);
    expect(describirFasesFallidas(resultado)).toBe('• Fase uno: sin conexión\n• Fase tres: HTTP 500');
  });

  it('sin fases emite una lista vacía', () => {
    const { api, llamadas } = crearApi();
    let resultado: any;
    crearFasesConCategorias(api, {}, [], 1).subscribe((r) => (resultado = r));
    expect(llamadas).toEqual([]);
    expect(resultado).toEqual([]);
  });
});

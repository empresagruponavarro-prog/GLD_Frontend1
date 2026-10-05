import { Observable, Subject, defer, of, throwError } from 'rxjs';
import {
  FaseCategoriaAGuardar,
  FasesCategoriasWriter,
  FilaFormFase,
  completoAFilas,
  crearFasesConCategorias,
  describirFasesFallidas,
  fusionarFilasPlantilla,
  plantillaAFilas,
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
        llamadas.push(`cat:${data.IdpptoFaseCategoria}`);
        return fallos.categoria?.includes(data.IdpptoFaseCategoria)
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
    expect(llamadas).toEqual(['fase:F1', 'cat:C1', 'fase:F2', 'cat:C2', 'fase:F3', 'cat:C3']);
    expect(emisiones).toEqual([[]]);
  });

  it('no emite hasta que responden todas las peticiones', () => {
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
    expect(enviados[1]).toMatchObject({ IdPresupuestoDetalleCategoria: 'DFC-99-0-0', IdPresupuestoDetalle: 'DF-99-0', IdpptoFaseCategoria: 'C1' });
  });

  it('crea una sola fase por idFase con todas sus categorías y suma el costo directo', () => {
    // Arrange
    const enviados: any[] = [];
    const api: FasesCategoriasWriter = {
      createFaseAsignada: (d) => { enviados.push({ tipo: 'fase', ...d }); return of(d); },
      createCategoriaAsignada: (d) => { enviados.push({ tipo: 'cat', ...d }); return of(d); },
    };
    const filas: FaseCategoriaAGuardar[] = [
      { idFase: 'F1', nombre: 'Fase uno', idCategoria: 'C1', subtotal: 10 },
      { idFase: 'F2', nombre: 'Fase dos', idCategoria: 'C9', subtotal: 5 },
      { idFase: 'F1', nombre: 'Fase uno', idCategoria: 'C2', subtotal: 15 },
    ];

    // Act
    crearFasesConCategorias(api, {}, filas, 7).subscribe();

    // Assert
    const fases = enviados.filter((d) => d.tipo === 'fase');
    expect(fases.map((f) => f.IdpptoFase)).toEqual(['F1', 'F2']);
    expect(fases[0].CostoDirecto).toBe(25);
    const catsF1 = enviados.filter((d) => d.tipo === 'cat' && d.IdPresupuestoDetalle === 'DF-7-0');
    expect(catsF1.map((c) => c.IdpptoFaseCategoria)).toEqual(['C1', 'C2']);
  });

  it('una fila sin categoría solo crea la fase (no crea categoría vacía)', () => {
    // Arrange
    const { api, llamadas } = crearApi();

    // Act
    crearFasesConCategorias(api, {}, [{ idFase: 'F1', nombre: 'Fase uno', idCategoria: '', subtotal: 0 }], 1).subscribe();

    // Assert
    expect(llamadas).toEqual(['fase:F1']);
  });

  it('si falla una fase, no escribe sus categorías, continúa con las demás y nombra la fase fallida', () => {
    // Arrange
    const { api, llamadas } = crearApi({ fase: ['F2'] });
    let resultado: any;

    // Act
    crearFasesConCategorias(api, {}, items, 1).subscribe((r) => (resultado = r));

    // Assert
    expect(llamadas).toEqual(['fase:F1', 'cat:C1', 'fase:F2', 'fase:F3', 'cat:C3']);
    expect(resultado).toEqual([{ nombre: 'Fase dos', motivo: 'HTTP 500' }]);
  });

  it('si falla una categoría, reporta fase/categoría y no oculta el resto de fallos', () => {
    // Arrange
    const { api } = crearApi({ categoria: ['C1'], fase: ['F3'] });
    let resultado: any;

    // Act
    crearFasesConCategorias(api, {}, items, 1).subscribe((r) => (resultado = r));

    // Assert
    expect(resultado.map((f: any) => f.nombre)).toEqual(['Fase uno / C1', 'Fase tres']);
    expect(describirFasesFallidas(resultado)).toBe('• Fase uno / C1: sin conexión\n• Fase tres: HTTP 500');
  });

  it('sin fases emite una lista vacía', () => {
    const { api, llamadas } = crearApi();
    let resultado: any;
    crearFasesConCategorias(api, {}, [], 1).subscribe((r) => (resultado = r));
    expect(llamadas).toEqual([]);
    expect(resultado).toEqual([]);
  });
});

describe('plantillas', () => {
  const plantilla = {
    fases: [
      { IdpptoFase: 'F1', NombreFase: 'Obra civil', categorias: [
        { IdpptoFaseCategoria: 'C1', NombreCategoria: 'Materiales', CostoReferencial: 100 },
        { IdpptoFaseCategoria: 'C2', NombreCategoria: 'Mano de obra' },
      ] },
      { IdpptoFase: 'F2', NombreFase: 'Acabados', categorias: [] },
    ],
  };

  it('plantillaAFilas: una fila por categoría y una "sin categoría" para fases vacías', () => {
    const filas = plantillaAFilas(plantilla);
    expect(filas.map((f) => `${f.idFase}|${f.idCategoria}|${f.subtotal}`)).toEqual(['F1|C1|100', 'F1|C2|0', 'F2||0']);
    expect(filas[2].categoria).toBe('(Sin categoría)');
  });

  it('fusionarFilasPlantilla (agregar): no duplica fase+categoría ni la fila sin categoría de una fase existente', () => {
    const actuales: FilaFormFase[] = [
      { idFase: 'F1', nombre: 'Obra civil', idCategoria: 'C1', categoria: 'Materiales', subtotal: 999, idCategoriaDetalle: 5 },
      { idFase: 'F2', nombre: 'Acabados', idCategoria: 'C7', categoria: 'Pintura', subtotal: 50 },
    ];
    const r = fusionarFilasPlantilla(actuales, plantillaAFilas(plantilla), 'agregar');
    expect(r.filas.map((f) => `${f.idFase}|${f.idCategoria}`)).toEqual(['F1|C1', 'F2|C7', 'F1|C2']);
    expect(r.filas[0].subtotal).toBe(999); // conserva lo editado por el usuario
    expect(r.agregadas).toBe(1);
    expect(r.omitidas).toBe(2);
  });

  it('fusionarFilasPlantilla (reemplazar): descarta las filas actuales', () => {
    const actuales: FilaFormFase[] = [{ idFase: 'X', nombre: 'X', idCategoria: 'Y', categoria: 'Y', subtotal: 1 }];
    const r = fusionarFilasPlantilla(actuales, plantillaAFilas(plantilla), 'reemplazar');
    expect(r.filas.length).toBe(3);
    expect(r.filas.some((f) => f.idFase === 'X')).toBe(false);
  });

  it('completoAFilas: guarda los ids de fase y categoría para poder editar/eliminar', () => {
    const filas = completoAFilas({
      fases: [
        { id: 10, IdpptoFase: 'F1', NombreFase: 'Obra civil', categorias: [{ id: 77, IdpptoFaseCategoria: 'C1', Descripcion: 'Materiales', CostoDirecto: '12.50' }] },
        { id: 11, IdpptoFase: 'F2', NombreFase: 'Acabados', CostoDirecto: '3', categorias: [] },
      ],
    });
    expect(filas[0]).toMatchObject({ idFaseDetalle: 10, idCategoriaDetalle: 77, subtotal: 12.5 });
    expect(filas[1]).toMatchObject({ idFaseDetalle: 11, idCategoria: '', subtotal: 3 });
    expect(filas[1].idCategoriaDetalle).toBeUndefined();
  });
});

import { EquipoInventario } from '../anexos/interfaces/equipo-asignado.interface';
import { contarPor, destinoDe, filtrarEquipos, ramDe, SIN_FILTROS, ubicacionDe } from './equipos-dashboard.util';

function equipo(id: number, extra: Partial<EquipoInventario> = {}): EquipoInventario {
  return {
    id,
    codigo: `pc-0${id}`,
    codigoActivo: `AF-000${id}`,
    tipo: 'PC',
    marca: 'Lenovo',
    modelo: 'ThinkCentre',
    color: null,
    serie: null,
    cantidad: 1,
    estado: 'Operativo',
    fechaAsignacion: '2026-10-26',
    caracteristicas: { RAM: '16 GB DDR4' },
    localId: 1,
    local: 'Chorrillos',
    nivelId: 1,
    nivel: 'Piso 1',
    ambienteId: 1,
    ambiente: 'Sistemas',
    areaId: 1,
    area: 'Sistemas',
    destino: 'Chorrillos',
    destinoTipo: 'EMPRESA',
    destinoId: 1,
    responsableId: 7,
    responsable: 'Ana',
    ...extra,
  };
}

const PC = equipo(1);
const LAPTOP = equipo(2, { tipo: 'Laptop', marca: 'HP', ambiente: 'Logística', area: null, areaId: null, destino: 'TAMBO PRUEBA', destinoTipo: 'CENTRO_COSTO', destinoId: 951 });
const DISPONIBLE = equipo(3, { responsableId: null, responsable: null, estado: 'En reparación', local: '', nivel: '', ambiente: '', destino: null, destinoTipo: null, destinoId: null });
const EQUIPOS = [PC, LAPTOP, DISPONIBLE, equipo(4)];

describe('equipos-dashboard.util', () => {
  it('cuenta por tipo de mayor a menor', () => {
    expect(contarPor(EQUIPOS, (e) => e.tipo)).toEqual([
      { etiqueta: 'PC', cantidad: 3 },
      { etiqueta: 'Laptop', cantidad: 1 },
    ]);
  });

  it('respeta el límite y desempata por nombre', () => {
    expect(contarPor(EQUIPOS, (e) => e.marca, 1)).toEqual([{ etiqueta: 'Lenovo', cantidad: 3 }]);
  });

  it('normaliza la RAM y la ubicación', () => {
    expect(ramDe(PC)).toBe('16 GB');
    expect(ramDe(equipo(9, { caracteristicas: {} }))).toBe('Sin dato');
    expect(ubicacionDe(PC)).toBe('Chorrillos · Piso 1 · Sistemas');
    expect(ubicacionDe(DISPONIBLE)).toBe('Sin ubicación');
  });

  it('indica la obra o sede a la que pertenece el equipo y filtra por ella', () => {
    expect(destinoDe(PC)).toBe('Empresa: Chorrillos');
    expect(destinoDe(LAPTOP)).toBe('Centro de costo: TAMBO PRUEBA');
    expect(destinoDe(DISPONIBLE)).toBe('Sin destino');
    expect(filtrarEquipos(EQUIPOS, { ...SIN_FILTROS, destino: 'Centro de costo: TAMBO PRUEBA' }).map((e) => e.id)).toEqual([2]);
    expect(contarPor(EQUIPOS, destinoDe)).toEqual([
      { etiqueta: 'Empresa: Chorrillos', cantidad: 2 },
      { etiqueta: 'Centro de costo: TAMBO PRUEBA', cantidad: 1 },
      { etiqueta: 'Sin destino', cantidad: 1 },
    ]);
  });

  it('filtra por tipo, asignación y texto', () => {
    expect(filtrarEquipos(EQUIPOS, { ...SIN_FILTROS, tipo: 'Laptop' }).map((e) => e.id)).toEqual([2]);
    expect(filtrarEquipos(EQUIPOS, { ...SIN_FILTROS, asignacion: 'disponibles' }).map((e) => e.id)).toEqual([3]);
    expect(filtrarEquipos(EQUIPOS, { ...SIN_FILTROS, area: 'Sin área' }).map((e) => e.id)).toEqual([2]);
    expect(filtrarEquipos(EQUIPOS, { ...SIN_FILTROS, busqueda: 'hp' }).map((e) => e.id)).toEqual([2]);
    expect(filtrarEquipos(EQUIPOS, { ...SIN_FILTROS, local: 'Sin ubicación' }).map((e) => e.id)).toEqual([3]);
  });
});

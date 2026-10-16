import { GrupoCatalogo, ModuloCatalogo, Permisos, SIN_PERMISOS } from '@app/core/auth/permisos.models';
import {
  aplicarAGrupo,
  aplicarAccion,
  contarCambios,
  estadoColumna,
  filasParaGuardar,
  MapaPermisos,
} from './permisos.calc';

const PAGOS: ModuloCatalogo = {
  id: 10, clave: 'tesoreria.pagos', nombre: 'Ejecución de pagos', ruta: '/tesoreria/pagos', orden: 3,
  admiteAprobar: false, admiteAnular: true,
};
const CUENTAS: ModuloCatalogo = {
  id: 11, clave: 'tesoreria.cuentas', nombre: 'Cuentas de pago', ruta: '/tesoreria/cuentas', orden: 4,
  admiteAprobar: false, admiteAnular: false,
};
const TESORERIA: GrupoCatalogo = { grupo: 'Tesorería', modulos: [PAGOS, CUENTAS] };
const con = (p: Partial<Permisos>): Permisos => ({ ...SIN_PERMISOS, ...p });

describe('permisos.calc', () => {
  it('aplicarAccion: quitar Ver limpia la fila; marcar otra acción marca Ver; no admitidas no cambian', () => {
    expect(aplicarAccion(con({ ver: true, crear: true, anular: true }), PAGOS, 'ver', false)).toEqual(SIN_PERMISOS);
    expect(aplicarAccion(SIN_PERMISOS, PAGOS, 'anular', true)).toEqual(con({ ver: true, anular: true }));
    expect(aplicarAccion(con({ ver: true, editar: true }), PAGOS, 'editar', false)).toEqual(con({ ver: true }));
    expect(aplicarAccion(SIN_PERMISOS, PAGOS, 'aprobar', true)).toEqual(SIN_PERMISOS);
  });

  it('estadoColumna y aplicarAGrupo', () => {
    const mapa: MapaPermisos = new Map([['tesoreria.pagos', con({ ver: true })]]);
    expect(estadoColumna(mapa, TESORERIA, 'ver')).toBe('mixto');
    expect(estadoColumna(mapa, TESORERIA, 'crear')).toBe('ninguno');
    expect(estadoColumna(mapa, TESORERIA, 'aprobar')).toBe('no-aplica');

    const todos = aplicarAGrupo(mapa, TESORERIA, 'crear', true);
    expect(estadoColumna(todos, TESORERIA, 'crear')).toBe('todos');
    expect(estadoColumna(todos, TESORERIA, 'ver')).toBe('todos');
    const anular = aplicarAGrupo(todos, TESORERIA, 'anular', true);
    expect(anular.get('tesoreria.pagos')?.anular).toBe(true);
    expect(anular.get('tesoreria.cuentas')?.anular).toBe(false);
  });

  it('contarCambios cuenta casillas y filasParaGuardar envía una fila por módulo', () => {
    const original: MapaPermisos = new Map();
    const actual: MapaPermisos = new Map([['tesoreria.cuentas', con({ ver: true, editar: true })]]);
    expect(contarCambios([TESORERIA], original, actual)).toBe(2);
    expect(contarCambios([TESORERIA], actual, actual)).toBe(0);
    expect(filasParaGuardar([TESORERIA], actual)).toEqual([
      { clave: 'tesoreria.pagos', ...SIN_PERMISOS },
      { clave: 'tesoreria.cuentas', ...con({ ver: true, editar: true }) },
    ]);
  });
});

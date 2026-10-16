import { ACCIONES, CLAVES_MODULO, esClaveModulo } from './permisos.models';

describe('CLAVES_MODULO', () => {
  it('tiene las 33 claves del catálogo §5, sin repetir y en el orden de la semilla', () => {
    expect(CLAVES_MODULO.length).toBe(33);
    expect(new Set(CLAVES_MODULO).size).toBe(33);
    expect(CLAVES_MODULO[0]).toBe('dashboard');
    expect(CLAVES_MODULO.indexOf('tesoreria.pagos')).toBe(9);
    expect(CLAVES_MODULO.indexOf('almacen.almacenes')).toBe(21);
    expect(CLAVES_MODULO.slice(-3)).toEqual(['admin.empresas', 'admin.usuarios', 'admin.roles']);
  });

  it('esClaveModulo reconoce solo claves del catálogo', () => {
    expect(esClaveModulo('maestros.anexos')).toBe(true);
    expect(esClaveModulo('admin.menus')).toBe(false);
  });

  it('ACCIONES sigue el orden de las columnas de la matriz', () => {
    expect(ACCIONES).toEqual(['ver', 'crear', 'editar', 'eliminar', 'aprobar', 'anular']);
  });
});

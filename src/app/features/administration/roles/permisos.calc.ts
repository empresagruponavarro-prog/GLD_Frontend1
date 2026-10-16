import {
  ACCIONES,
  Accion,
  GrupoCatalogo,
  MatrizPermisosRol,
  ModuloCatalogo,
  PermisoModuloGuardar,
  Permisos,
  SIN_PERMISOS,
} from '@app/core/auth/permisos.models';

/** Permisos de un rol por clave de módulo. */
export type MapaPermisos = ReadonlyMap<string, Permisos>;

/** Estado de la casilla de grupo de una columna. */
export type EstadoColumna = 'todos' | 'ninguno' | 'mixto' | 'no-aplica';

/** `aprobar` y `anular` solo existen en los módulos que los admiten; el resto, siempre. */
export function admiteAccion(modulo: ModuloCatalogo, accion: Accion): boolean {
  if (accion === 'aprobar') return modulo.admiteAprobar;
  if (accion === 'anular') return modulo.admiteAnular;
  return true;
}

function soloPermisos(p: Permisos): Permisos {
  return {
    ver: p.ver,
    crear: p.crear,
    editar: p.editar,
    eliminar: p.eliminar,
    aprobar: p.aprobar,
    anular: p.anular,
  };
}

/** Mapa clave → permisos a partir de la respuesta del backend. */
export function mapaDesdeMatriz(matriz: MatrizPermisosRol): MapaPermisos {
  return new Map(matriz.permisos.map((p) => [p.clave, soloPermisos(p)]));
}

export function permisosDe(mapa: MapaPermisos, clave: string): Permisos {
  return mapa.get(clave) ?? SIN_PERMISOS;
}

/**
 * Cambia una casilla aplicando las reglas de la matriz: desmarcar `ver` desmarca el resto de la
 * fila y marcar cualquier otra acción marca `ver`. Las acciones no admitidas no cambian.
 */
export function aplicarAccion(p: Permisos, modulo: ModuloCatalogo, accion: Accion, valor: boolean): Permisos {
  if (!admiteAccion(modulo, accion)) return p;
  if (accion === 'ver' && !valor) return SIN_PERMISOS;
  const siguiente: Permisos = { ...p, [accion]: valor };
  return valor ? { ...siguiente, ver: true } : siguiente;
}

/** Cambia una acción en todos los módulos de un grupo que la admiten (mismas reglas que una fila). */
export function aplicarAGrupo(mapa: MapaPermisos, grupo: GrupoCatalogo, accion: Accion, valor: boolean): MapaPermisos {
  const siguiente = new Map(mapa);
  for (const modulo of grupo.modulos) {
    if (!admiteAccion(modulo, accion)) continue;
    siguiente.set(modulo.clave, aplicarAccion(permisosDe(mapa, modulo.clave), modulo, accion, valor));
  }
  return siguiente;
}

/** Estado de la columna de un grupo: todas marcadas, ninguna, mixto o sin módulos que la admitan. */
export function estadoColumna(mapa: MapaPermisos, grupo: GrupoCatalogo, accion: Accion): EstadoColumna {
  const aplicables = grupo.modulos.filter((m) => admiteAccion(m, accion));
  if (aplicables.length === 0) return 'no-aplica';
  const marcadas = aplicables.filter((m) => permisosDe(mapa, m.clave)[accion]).length;
  if (marcadas === 0) return 'ninguno';
  return marcadas === aplicables.length ? 'todos' : 'mixto';
}

/** Número de casillas que difieren entre dos mapas (solo módulos del catálogo y acciones admitidas). */
export function contarCambios(catalogo: readonly GrupoCatalogo[], original: MapaPermisos, actual: MapaPermisos): number {
  let total = 0;
  for (const grupo of catalogo) {
    for (const modulo of grupo.modulos) {
      const antes = permisosDe(original, modulo.clave);
      const ahora = permisosDe(actual, modulo.clave);
      total += ACCIONES.filter((a) => admiteAccion(modulo, a) && antes[a] !== ahora[a]).length;
    }
  }
  return total;
}

/** Cuerpo del PUT: una fila por cada módulo del catálogo, en su orden y sin acciones no admitidas. */
export function filasParaGuardar(catalogo: readonly GrupoCatalogo[], mapa: MapaPermisos): PermisoModuloGuardar[] {
  return catalogo.flatMap((grupo) =>
    grupo.modulos.map((modulo) => {
      const p = permisosDe(mapa, modulo.clave);
      return {
        clave: modulo.clave,
        ver: p.ver,
        crear: p.crear,
        editar: p.editar,
        eliminar: p.eliminar,
        aprobar: modulo.admiteAprobar && p.aprobar,
        anular: modulo.admiteAnular && p.anular,
      };
    }),
  );
}

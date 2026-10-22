/**
 * Módulos por área (plan 08): qué módulos tiene habilitados cada área y con qué nivel.
 * Idénticos a los DTO de `GET/PUT /administration/permisos/areas`.
 */

/** Nivel que se guarda para un módulo de un área (sin fila = el área no lo ve). */
export type NivelGuardable = 'solo_ver' | 'completo';

/** Nivel de una celda de la matriz: `no` = el área no tiene el módulo. */
export type NivelCelda = 'no' | NivelGuardable;

/** Módulo del catálogo tal como lo muestra la matriz. */
export interface ModuloMatrizArea {
  id: number;
  clave: string;
  nombre: string;
  grupo: string;
  /** `false` para Administración y el menú de módulos: no dependen del área, solo del rol. */
  configurable: boolean;
}

export interface AccesoArea {
  clave: string;
  nivel: NivelGuardable;
}

export interface AreaMatriz {
  id: number;
  codigo: string;
  nombre: string;
  estado: boolean;
  /** Usuarios ACTIVOS asignados al área. */
  usuarios: number;
  /** `false` = sin ningún módulo: sus usuarios NO tienen restricción por área. */
  configurada: boolean;
  modulos: AccesoArea[];
}

export interface MatrizAreas {
  modulos: ModuloMatrizArea[];
  areas: AreaMatriz[];
  /** Módulos configurables que ninguna área tiene habilitados. */
  sin_area: string[];
}

export interface GuardarModulosArea {
  modulos: AccesoArea[];
}

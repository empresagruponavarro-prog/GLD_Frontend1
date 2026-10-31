import { ObraResumen, Portafolio } from './operaciones.interface';
import { EstadoObra } from '../centros-costos/obra-cockpit/obra-control.interface';

export interface DatosObra {
  id: number;
  estado?: EstadoObra;
  inicio?: string;
  fin?: string;
  cliente?: [number, string] | null;
  jefe?: [number, string] | null;
  coordinador?: [number, string] | null;
  departamento?: string | null;
  clave?: 'good' | 'warn' | 'crit' | 'neutral' | 'rp';
  real?: number;
  programado?: number;
  fueraDePlazo?: number;
  proximoAVencer?: boolean;
  postVenta?: { inicio: string; dias: number } | null;
  tienda?: string;
}

const persona = (p: [number, string] | null | undefined) => (p ? { id: p[0], nombre: p[1] } : null);

/** Obra del portafolio con lo mínimo que usan las vistas. */
export function obraResumen(d: DatosObra): ObraResumen {
  const estado = d.estado ?? 'EN_EJECUCION';
  const inicio = d.inicio ?? '2026-09-14';
  const fin = d.fin ?? '2026-11-30';
  const real = d.real ?? 40;
  const programado = d.programado ?? 40;
  return {
    id_centro_costo: d.id,
    codigo_obra: `OP-26-${String(d.id).padStart(3, '0')}`,
    nombre: `Cliente ${d.tienda ?? 'Tienda ' + d.id}`,
    cliente: d.cliente === undefined ? { id: 1, nombre: 'Cliente A' } : persona(d.cliente),
    tienda: d.tienda ?? `Tienda ${d.id}`,
    departamento: d.departamento === undefined ? 'Lima' : d.departamento,
    comentario: null,
    equipo: {
      jefe_proyecto: persona(d.jefe === undefined ? [10, 'Ana Ruiz'] : d.jefe),
      coordinador: persona(d.coordinador === undefined ? [20, 'Beto Paz'] : d.coordinador),
      residente: null,
      resp_presupuesto: null,
      resp_procura: null,
    },
    estado_obra: estado,
    inicio,
    fin,
    resultado: {
      estadoEfectivo: estado,
      real,
      programado,
      programadoFinSemana: programado,
      desviacion: real - programado,
      situacion: { clave: d.clave ?? 'good', texto: d.clave === 'crit' ? 'Retrasada' : 'A tiempo' },
      sinPartidas: false,
      sinAvance: false,
      semana: { actual: 3, total: 11, texto: 'Sem 3 de 11', tarde: false },
      plazos: {
        finOriginal: fin,
        finVigente: fin,
        finControl: fin,
        diasReprogramados: 0,
        diasExternos: 0,
        diasInternos: 0,
        enPausa: false,
        diasFueraDePlazo: d.fueraDePlazo ?? 0,
        diasRetraso: 0,
        proximoAVencer: d.proximoAVencer ?? false,
      },
      postVenta: d.postVenta ? { inicio: d.postVenta.inicio, cierre: null, dias: d.postVenta.dias, texto: `${d.postVenta.dias} días`, cerrada: false } : null,
      corte: '2026-10-04',
      adicionales: null,
      avisos: 0,
    },
    curva: [
      { semana: 1, pactado: 20, real: 15 },
      { semana: 2, pactado: 50, real: 40 },
    ],
  };
}

export function portafolio(obras: ObraResumen[], hoy = '2026-10-07'): Portafolio {
  return { hoy, total: obras.length, obras, sin_evaluar: [] };
}

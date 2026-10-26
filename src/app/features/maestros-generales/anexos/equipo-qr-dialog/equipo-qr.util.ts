import { EquipoAsignado, TrabajadorResumen } from '../interfaces/equipo-asignado.interface';

/** yyyy-MM-dd → dd/MM/yyyy (sin pasar por Date para evitar corrimientos de zona horaria). */
export function formatearFecha(iso: string): string {
  const [anio, mes, dia] = iso.split('-');
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : iso;
}

/**
 * Líneas legibles que codifica el QR (texto plano: se lee sin app ni internet).
 * Para pasar a una URL pública (https://<dominio>/equipos/{id}) basta con cambiar solo esta función.
 */
export function lineasQR(e: EquipoAsignado, t: TrabajadorResumen): string[] {
  return [
    `EQUIPO ${e.codigo} (${e.codigoActivo})`,
    `Tipo: ${e.tipo}`,
    `Marca: ${e.marca}`,
    `Modelo: ${e.modelo}`,
    `Serie: ${e.serie ?? '-'}`,
    ...(e.color ? [`Color: ${e.color}`] : []),
    ...Object.entries(e.caracteristicas).map(([k, v]) => `${k}: ${v}`),
    `Estado: ${e.estado}`,
    `Ubicacion: ${e.local} / ${e.nivel} / ${e.ambiente}`,
    ...(e.area ? [`Area: ${e.area}`] : []),
    `Asignado a: ${t.anexo} (${t.tipoDocumento} ${t.numeroDocumento})`,
    `Fecha asignacion: ${formatearFecha(e.fechaAsignacion)}`,
  ];
}

export function contenidoQR(e: EquipoAsignado, t: TrabajadorResumen): string {
  return lineasQR(e, t).join('\n');
}

export function escaparHtml(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

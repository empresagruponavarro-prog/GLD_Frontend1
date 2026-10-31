import { Service, inject } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import {
  ArchivoDocumento,
  ArchivoPlano,
  DeleteResult,
  DocumentoPatch,
  DocumentoPayload,
  IncidenciaPayload,
  NuevaVersionPlanoPayload,
  ObraCockpit,
  ObraDatosGenerales,
  ObraDocumento,
  ObraIncidencia,
  ObraPlano,
  ObraResidente,
  ObraSemana,
  PlanoPayload,
  ResidentePayload,
  SemanaPayload,
  UpdateAvancePayload,
  UpdateGeneralesPayload,
} from './obra.interface';
import {
  AvanceObra,
  CambiarEstadoPayload,
  CambioEstado,
  ControlObra,
  CurvaS,
  LineaAvance,
  ObraEvento,
  ObraPartida,
  ObraReprogramacion,
  ObraSubpartida,
  PartidaPayload,
  PresupuestoDisponible,
  ReprogramacionPayload,
  ResultadoGuardarAvance,
  ResultadoImportacionExcel,
  VistaPreviaExcel,
  ResultadoImportacion,
  SubpartidaPayload,
} from './obra-control.interface';

@Service()
export class ObraService {
  readonly #http = inject(HttpClient);
  readonly #baseUrl = `${environment.apiUrl}/operaciones/obra`;

  #cc(idCentroCosto: number, path = ''): string {
    return `${this.#baseUrl}/${idCentroCosto}${path}`;
  }

  /** Vista panorámica consolidada del Centro de Costo */
  getCockpit(idCentroCosto: number): Observable<ObraCockpit> {
    return this.#http.get<ObraCockpit>(this.#cc(idCentroCosto, '/cockpit'));
  }

  /** Crea o actualiza la ficha técnica de la obra */
  updateGenerales(idCentroCosto: number, payload: UpdateGeneralesPayload): Observable<ObraDatosGenerales> {
    return this.#http.patch<ObraDatosGenerales>(this.#cc(idCentroCosto, '/generales'), payload);
  }

  // ─── Cronograma ────────────────────────────────────────────────────────────
  createSemana(idCentroCosto: number, payload: SemanaPayload): Observable<ObraSemana> {
    return this.#http.post<ObraSemana>(this.#cc(idCentroCosto, '/cronograma'), payload);
  }

  createLoteSemanas(idCentroCosto: number, payload: { semanas: SemanaPayload[]; reemplazar_existentes?: boolean }): Observable<ObraSemana[]> {
    return this.#http.post<ObraSemana[]>(this.#cc(idCentroCosto, '/cronograma/lote'), payload);
  }

  updateSemana(idCentroCosto: number, idSemana: number, payload: Partial<SemanaPayload>): Observable<ObraSemana> {
    return this.#http.patch<ObraSemana>(this.#cc(idCentroCosto, `/cronograma/${idSemana}`), payload);
  }

  updateAvanceSemanal(idCentroCosto: number, idSemana: number, payload: UpdateAvancePayload): Observable<ObraSemana> {
    return this.#http.patch<ObraSemana>(this.#cc(idCentroCosto, `/cronograma/${idSemana}/avance`), payload);
  }

  deleteSemana(idCentroCosto: number, idSemana: number): Observable<DeleteResult> {
    return this.#http.delete<DeleteResult>(this.#cc(idCentroCosto, `/cronograma/${idSemana}`));
  }

  // ─── Residentes ────────────────────────────────────────────────────────────
  createResidente(idCentroCosto: number, payload: ResidentePayload): Observable<ObraResidente> {
    return this.#http.post<ObraResidente>(this.#cc(idCentroCosto, '/residentes'), payload);
  }

  updateResidente(idCentroCosto: number, idResidente: number, payload: Partial<ResidentePayload>): Observable<ObraResidente> {
    return this.#http.patch<ObraResidente>(this.#cc(idCentroCosto, `/residentes/${idResidente}`), payload);
  }

  deleteResidente(idCentroCosto: number, idResidente: number): Observable<DeleteResult> {
    return this.#http.delete<DeleteResult>(this.#cc(idCentroCosto, `/residentes/${idResidente}`));
  }

  // ─── Planos ────────────────────────────────────────────────────────────────
  createPlano(idCentroCosto: number, payload: PlanoPayload): Observable<ObraPlano> {
    return this.#http.post<ObraPlano>(this.#cc(idCentroCosto, '/planos'), payload);
  }

  updatePlano(idCentroCosto: number, idPlano: number, payload: Partial<PlanoPayload>): Observable<ObraPlano> {
    return this.#http.patch<ObraPlano>(this.#cc(idCentroCosto, `/planos/${idPlano}`), payload);
  }

  nuevaVersionPlano(idCentroCosto: number, idPlano: number, payload: NuevaVersionPlanoPayload): Observable<ObraPlano> {
    return this.#http.post<ObraPlano>(this.#cc(idCentroCosto, `/planos/${idPlano}/versiones`), payload);
  }

  getHistorialPlano(idCentroCosto: number, idPlano: number): Observable<ObraPlano[]> {
    return this.#http.get<ObraPlano[]>(this.#cc(idCentroCosto, `/planos/${idPlano}/historial`));
  }

  deletePlano(idCentroCosto: number, idPlano: number): Observable<DeleteResult> {
    return this.#http.delete<DeleteResult>(this.#cc(idCentroCosto, `/planos/${idPlano}`));
  }

  /** Sube el archivo del plano (multipart). Emite eventos para mostrar el progreso. */
  subirArchivoPlano(idCentroCosto: number, archivo: File): Observable<HttpEvent<ArchivoPlano>> {
    const body = new FormData();
    body.append('archivo', archivo, archivo.name);
    return this.#http.post<ArchivoPlano>(this.#cc(idCentroCosto, '/planos/archivo'), body, {
      reportProgress: true,
      observe: 'events',
    });
  }

  /** URL para descargar (o ver en el navegador con inline=true) el archivo de un plano. */
  archivoPlanoUrl(idCentroCosto: number, idPlano: number, inline = false): string {
    return this.#cc(idCentroCosto, `/planos/${idPlano}/archivo${inline ? '?inline=1' : ''}`);
  }

  /** Descarga el archivo del plano como Blob en memoria (evita exponer la URL de la API en la barra de navegación). */
  descargarArchivoPlanoBlob(idCentroCosto: number, idPlano: number, inline = true): Observable<Blob> {
    return this.#http.get(this.archivoPlanoUrl(idCentroCosto, idPlano, inline), {
      responseType: 'blob',
    });
  }

  /** Borra un archivo subido que no se llegó a guardar en ningún plano. */
  descartarArchivoPlano(idCentroCosto: number, clave: string): Observable<{ deleted: boolean }> {
    return this.#http.delete<{ deleted: boolean }>(this.#cc(idCentroCosto, '/planos/archivo'), { params: { clave } });
  }

  // ─── Documentos / Actas ────────────────────────────────────────────────────
  createDocumento(idCentroCosto: number, payload: DocumentoPayload): Observable<ObraDocumento> {
    return this.#http.post<ObraDocumento>(this.#cc(idCentroCosto, '/documentos'), payload);
  }

  updateDocumento(idCentroCosto: number, idDocumento: number, payload: DocumentoPatch): Observable<ObraDocumento> {
    return this.#http.patch<ObraDocumento>(this.#cc(idCentroCosto, `/documentos/${idDocumento}`), payload);
  }

  deleteDocumento(idCentroCosto: number, idDocumento: number): Observable<DeleteResult> {
    return this.#http.delete<DeleteResult>(this.#cc(idCentroCosto, `/documentos/${idDocumento}`));
  }

  /** Sube el archivo de un documento (multipart). Emite eventos para mostrar el progreso. */
  subirArchivoDocumento(idCentroCosto: number, archivo: File): Observable<HttpEvent<ArchivoDocumento>> {
    const body = new FormData();
    body.append('archivo', archivo, archivo.name);
    return this.#http.post<ArchivoDocumento>(this.#cc(idCentroCosto, '/documentos/archivo'), body, {
      reportProgress: true,
      observe: 'events',
    });
  }

  /** Borra un archivo subido que no se llegó a guardar en ningún documento. */
  descartarArchivoDocumento(idCentroCosto: number, clave: string): Observable<{ deleted: boolean; clave: string }> {
    return this.#http.delete<{ deleted: boolean; clave: string }>(this.#cc(idCentroCosto, '/documentos/archivo'), {
      params: { clave },
    });
  }

  /** Descarga el archivo del documento como Blob (compatible con autenticación por token). */
  descargarArchivoDocumento(idCentroCosto: number, idDocumento: number, inline = false): Observable<Blob> {
    return this.#http.get(this.#cc(idCentroCosto, `/documentos/${idDocumento}/archivo${inline ? '?inline=1' : ''}`), {
      responseType: 'blob',
    });
  }

  // ─── Incidencias / RFI ─────────────────────────────────────────────────────
  createIncidencia(idCentroCosto: number, payload: IncidenciaPayload): Observable<ObraIncidencia> {
    return this.#http.post<ObraIncidencia>(this.#cc(idCentroCosto, '/incidencias'), payload);
  }

  updateIncidencia(idCentroCosto: number, idIncidencia: number, payload: Partial<IncidenciaPayload>): Observable<ObraIncidencia> {
    return this.#http.patch<ObraIncidencia>(this.#cc(idCentroCosto, `/incidencias/${idIncidencia}`), payload);
  }

  deleteIncidencia(idCentroCosto: number, idIncidencia: number): Observable<DeleteResult> {
    return this.#http.delete<DeleteResult>(this.#cc(idCentroCosto, `/incidencias/${idIncidencia}`));
  }

  // ─── Control de avance (Dashboard de Operaciones) ──────────────────────────
  /** Ficha operativa + todo lo calculado por el motor. `hoy` (YYYY-MM-DD) solo sirve para consultar «como estaba» otro día. */
  getControl(idCentroCosto: number, hoy?: string): Observable<ControlObra> {
    return this.#http.get<ControlObra>(this.#cc(idCentroCosto, '/control'), { params: hoy ? { hoy } : {} });
  }

  getCurvaS(idCentroCosto: number, tipo: 'todo' | 'C' | 'A' = 'todo'): Observable<CurvaS | null> {
    return this.#http.get<CurvaS | null>(this.#cc(idCentroCosto, '/control/curva-s'), { params: { tipo } });
  }

  getEventos(idCentroCosto: number, limite = 50): Observable<ObraEvento[]> {
    return this.#http.get<ObraEvento[]>(this.#cc(idCentroCosto, '/eventos'), { params: { limite } });
  }

  cambiarEstado(idCentroCosto: number, payload: CambiarEstadoPayload): Observable<CambioEstado> {
    return this.#http.post<CambioEstado>(this.#cc(idCentroCosto, '/estado'), payload);
  }

  // Estructura
  getPartidas(idCentroCosto: number): Observable<ObraPartida[]> {
    return this.#http.get<ObraPartida[]>(this.#cc(idCentroCosto, '/partidas'));
  }

  createPartida(idCentroCosto: number, payload: PartidaPayload): Observable<ObraPartida> {
    return this.#http.post<ObraPartida>(this.#cc(idCentroCosto, '/partidas'), payload);
  }

  updatePartida(idCentroCosto: number, idPartida: number, payload: Partial<PartidaPayload>): Observable<ObraPartida> {
    return this.#http.patch<ObraPartida>(this.#cc(idCentroCosto, `/partidas/${idPartida}`), payload);
  }

  deletePartida(idCentroCosto: number, idPartida: number): Observable<DeleteResult> {
    return this.#http.delete<DeleteResult>(this.#cc(idCentroCosto, `/partidas/${idPartida}`));
  }

  createSubpartida(idCentroCosto: number, idPartida: number, payload: SubpartidaPayload): Observable<ObraSubpartida> {
    return this.#http.post<ObraSubpartida>(this.#cc(idCentroCosto, `/partidas/${idPartida}/subpartidas`), payload);
  }

  updateSubpartida(idCentroCosto: number, idSubpartida: number, payload: Partial<SubpartidaPayload>): Observable<ObraSubpartida> {
    return this.#http.patch<ObraSubpartida>(this.#cc(idCentroCosto, `/subpartidas/${idSubpartida}`), payload);
  }

  deleteSubpartida(idCentroCosto: number, idSubpartida: number): Observable<DeleteResult> {
    return this.#http.delete<DeleteResult>(this.#cc(idCentroCosto, `/subpartidas/${idSubpartida}`));
  }

  /** Metas manuales de las semanas 1 a 10; `null` = reparto automático por días laborables. */
  updateMetas(idCentroCosto: number, idSubpartida: number, metas: (number | null)[]): Observable<ObraSubpartida> {
    return this.#http.put<ObraSubpartida>(this.#cc(idCentroCosto, `/subpartidas/${idSubpartida}/metas`), { metas });
  }

  getPresupuestosDisponibles(idCentroCosto: number): Observable<PresupuestoDisponible[]> {
    return this.#http.get<PresupuestoDisponible[]>(this.#cc(idCentroCosto, '/presupuestos-disponibles'));
  }

  importarPresupuesto(idCentroCosto: number, idPresupuesto: number, reemplazar = false): Observable<ResultadoImportacion> {
    return this.#http.post<ResultadoImportacion>(this.#cc(idCentroCosto, '/partidas/importar-presupuesto'), { idPresupuesto, reemplazar });
  }

  // Avance semanal
  getAvance(idCentroCosto: number): Observable<AvanceObra> {
    return this.#http.get<AvanceObra>(this.#cc(idCentroCosto, '/avance'));
  }

  /** Registra lo avanzado SOLO en esa semana (0-100) para varias subpartidas; `avance: null` borra el dato. */
  guardarAvanceSemana(idCentroCosto: number, semana: number, lineas: LineaAvance[]): Observable<ResultadoGuardarAvance> {
    return this.#http.put<ResultadoGuardarAvance>(this.#cc(idCentroCosto, `/avance/semanas/${semana}`), { lineas });
  }

  // Reprogramaciones
  getReprogramaciones(idCentroCosto: number): Observable<ObraReprogramacion[]> {
    return this.#http.get<ObraReprogramacion[]>(this.#cc(idCentroCosto, '/reprogramaciones'));
  }

  createReprogramacion(idCentroCosto: number, payload: ReprogramacionPayload): Observable<ObraReprogramacion> {
    return this.#http.post<ObraReprogramacion>(this.#cc(idCentroCosto, '/reprogramaciones'), payload);
  }

  updateReprogramacion(idCentroCosto: number, id: number, payload: Partial<ReprogramacionPayload>): Observable<ObraReprogramacion> {
    return this.#http.patch<ObraReprogramacion>(this.#cc(idCentroCosto, `/reprogramaciones/${id}`), payload);
  }

  deleteReprogramacion(idCentroCosto: number, id: number): Observable<DeleteResult> {
    return this.#http.delete<DeleteResult>(this.#cc(idCentroCosto, `/reprogramaciones/${id}`));
  }

  // Importación del Excel por proyecto
  /** Lee el archivo y devuelve lo que traería, con errores y avisos; no escribe nada. */
  previsualizarExcel(idCentroCosto: number, archivo: File): Observable<VistaPreviaExcel> {
    const cuerpo = new FormData();
    cuerpo.append('archivo', archivo, archivo.name);
    return this.#http.post<VistaPreviaExcel>(this.#cc(idCentroCosto, '/importar-excel'), cuerpo);
  }

  importarExcel(idCentroCosto: number, archivo: File): Observable<ResultadoImportacionExcel> {
    const cuerpo = new FormData();
    cuerpo.append('archivo', archivo, archivo.name);
    return this.#http.post<ResultadoImportacionExcel>(this.#cc(idCentroCosto, '/importar-excel'), cuerpo, { params: { confirmar: true } });
  }
}

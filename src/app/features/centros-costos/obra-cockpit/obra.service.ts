import { Service, inject } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import {
  ArchivoPlano,
  DeleteResult,
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

  updateDocumento(idCentroCosto: number, idDocumento: number, payload: Partial<DocumentoPayload>): Observable<ObraDocumento> {
    return this.#http.patch<ObraDocumento>(this.#cc(idCentroCosto, `/documentos/${idDocumento}`), payload);
  }

  deleteDocumento(idCentroCosto: number, idDocumento: number): Observable<DeleteResult> {
    return this.#http.delete<DeleteResult>(this.#cc(idCentroCosto, `/documentos/${idDocumento}`));
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
}

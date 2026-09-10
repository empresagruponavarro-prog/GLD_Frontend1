export interface Incidencia {
  id?: number;
  promotor?: string;
  docRegistrador?: string;
  cargoRegistrador?: string;

  solicitante?: string;
  docSolicitante?: string;
  telefonoSolicitante?: string;
  domicilioSolicitante?: string;

  fechaIncidencia?: string;
  horaIncidencia?: string;
  origenIncidencia?: string;
  viaOrigen?: string;
  cuadra?: string;
  urbanizacion?: string;
  sectorVecinal?: string;
  tipificacion?: string;
  direccionExacta?: string;
  incidencia?: string;
  prioridadCategoria?: string;
  latitud?: string;
  longitud?: string;

  gerenciaAsignada?: string;
  representante?: string;
  estado?: string;
  accionPrevia?: string;
  accionTomada?: string;
  aprobacion?: string;
  documentoGestrad?: string;

  fechaInicio?: string;
  fechaFin?: string;
  fechaCreacion?: string;
}

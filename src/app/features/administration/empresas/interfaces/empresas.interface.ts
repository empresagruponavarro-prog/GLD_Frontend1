/** Empresa tal como la devuelve la API (`EmpresaResponseDto` de `GET /administration/empresas`). */
export interface EmpresaApi {
  id_empresa: number;
  ruc: string | null;
  razon_social: string | null;
  domicilio_fiscal: string | null;
  direccion_entrega: string | null;
  correo_compras: string | null;
}

export interface Empresa {
  id?: number;
  id_empresa?: number;
  CodEmpresa?: string;
  RUC?: string;
  ruc?: string;
  RazonSocial?: string;
  razon_social?: string;
  DomicilioFiscal?: string;
  domicilio_fiscal?: string;
  DireccionEntrega?: string;
  direccion_entrega?: string;
  CorreoCompras?: string;
  correo_compras?: string;
}

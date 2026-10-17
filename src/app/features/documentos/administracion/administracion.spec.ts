import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { HttpRequest } from '@angular/common/http';
import { environment } from '@env';
import { misPermisos } from '@app/core/auth/auth.testing';
import { Pantalla, botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { ClaveModulo, Permisos } from '@app/core/auth/permisos.models';
import { DocumentoAdmin, DocumentoDetalle, Paginated } from './administracion.models';
import { DocumentosAdministracionComponent } from './administracion';

const API = `${environment.apiUrl}/administracion/documentos-origen`;

const DOC: DocumentoAdmin = {
  id: 40,
  numero_documento: 'PS-000040',
  numero_oc: null,
  clase_documento: 'PAGO_SERVICIO',
  estado: 'REGISTRADO',
  id_anexo: 4,
  proveedor: 'Luz del Sur',
  ruc: '20100000001',
  id_centro_costo: null,
  centro_costo: null,
  id_centro_costos_principal: null,
  centro_costo_principal: null,
  id_area: null,
  area_nombre: null,
  id_requerimiento: null,
  numero_requerimiento: null,
  fecha_emision: '2026-10-01',
  forma_pago: 'Contado',
  moneda_id: 'PEN',
  moneda_simbolo: 'S/',
  afecto_igv: true,
  monto: '100',
  igv: '18',
  total: '118',
  renta_4ta: '0',
  dscto_compras: '0',
  dscto_intervencion: '0',
  dscto_otros: '0',
  detraccion_porcentaje: null,
  detraccion_monto: null,
  retencion_porcentaje: null,
  retencion_monto: null,
  retencion_manual: false,
  comentarios: null,
  dias_credito: null,
  fecha_vencimiento_manual: null,
  ultima_recepcion: null,
  vencimiento: '2026-10-01',
  pendiente_recepcion: false,
  neto_proveedor: '118',
  pagado_proveedor: '0',
  pagado_detraccion: '0',
  programado_proveedor: '0',
  programado_detraccion: '0',
  saldo_por_pagar_proveedor: '118',
  saldo_por_pagar_detraccion: '0',
  fecha_ultimo_pago: null,
  estado_pago: 'SIN_PROGRAMAR',
};

function detalleDe(doc: DocumentoAdmin): DocumentoDetalle {
  return { ...doc, lineas: [], programaciones: [], pagos: [], retencion_motivo: 'No aplica' };
}

function responder(req: HttpRequest<unknown>) {
  if (req.url === API) {
    const pagina: Paginated<DocumentoAdmin> = { data: [DOC], total: 1, page: 1, pageSize: 20, totalPages: 1 };
    return pagina;
  }
  return [];
}

async function montar(modulos: Partial<Record<ClaveModulo, Partial<Permisos>>>) {
  const p = await montarPantalla(DocumentosAdministracionComponent, misPermisos('Contador', modulos), responder);
  expect(p.el.textContent).toContain('PS-000040');
  return p;
}

/** Abre el detalle del documento ("Ver documento") y responde su GET. */
async function abrirDetalle(p: Pantalla<DocumentosAdministracionComponent>, doc: DocumentoAdmin = DOC): Promise<void> {
  p.el.querySelector<HTMLButtonElement>('button[title="Ver documento"]')?.click();
  await p.render();
  p.http.expectOne(`${API}/${doc.id}`).flush(detalleDe(doc));
  await p.render();
}

function camposDeducciones(el: HTMLElement): (HTMLInputElement | HTMLSelectElement)[] {
  return Array.from(el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.adm-ded input, .adm-ded select'));
}

const BOTONES = {
  registro: 'Registro directo',
  programar: 'Programar pagos',
};

describe('DocumentosAdministracionComponent: botones según permisos (documentos.administracion)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver: sin Registro directo ni Programar pagos (sin acceso a Programación)', async () => {
    const { el } = await montar({ 'documentos.administracion': {} });
    expect(botonesVisibles(el, BOTONES)).toEqual({ registro: false, programar: false });
  });

  it('crear → Registro directo; ver Tesorería → Programación → Programar pagos', async () => {
    expect(botonesVisibles((await montar({ 'documentos.administracion': { crear: true } })).el, BOTONES)).toEqual({ registro: true, programar: false });
    TestBed.resetTestingModule();
    const p = await montar({ 'documentos.administracion': {}, 'tesoreria.programacion': {} });
    expect(botonesVisibles(p.el, BOTONES)).toEqual({ registro: false, programar: true });
    await abrirDetalle(p);
    // También el enlace de "Aún no hay pagos programados".
    expect(p.el.querySelectorAll('a[href="/tesoreria/programacion"]').length).toBe(2);
  });

  it('con solo ver: deducciones en solo lectura y sin guardar; Anular documento (basta ver), Imprimir y Expediente disponibles', async () => {
    const p = await montar({ 'documentos.administracion': {} });
    await abrirDetalle(p);
    const campos = camposDeducciones(p.el);
    expect(campos.length).toBeGreaterThan(0);
    expect(campos.every((c) => c.disabled)).toBe(true);
    expect(p.el.querySelector('[data-testid="deducciones-solo-lectura"]')).not.toBeNull();
    expect(botonesVisibles(p.el, { guardar: 'Guardar cambios', anular: 'Anular documento', imprimir: 'Imprimir', expediente: 'Expediente', programar: 'Programar pagos' })).toEqual({
      guardar: false,
      anular: true,
      imprimir: true,
      expediente: true,
      programar: false,
    });
  });

  it('Anular documento conserva su regla de estado: no aparece si el documento ya está anulado', async () => {
    const p = await montar({ 'documentos.administracion': {} });
    await abrirDetalle(p, { ...DOC, estado: 'ANULADO' });
    expect(botonesVisibles(p.el, { anular: 'Anular documento' })).toEqual({ anular: false });
  });

  it('editar → deducciones editables con su botón de guardar (la retención automática sigue bloqueada)', async () => {
    const p = await montar({ 'documentos.administracion': { editar: true } });
    await abrirDetalle(p);
    const retencion = p.el.querySelector<HTMLInputElement>('#ded-ret');
    expect(retencion?.disabled).toBe(true);
    expect(camposDeducciones(p.el).filter((c) => c !== retencion).every((c) => !c.disabled)).toBe(true);
    expect(botonesVisibles(p.el, { guardar: 'Guardar cambios' })).toEqual({ guardar: true });
    expect(p.el.querySelector('[data-testid="deducciones-solo-lectura"]')).toBeNull();
  });
});

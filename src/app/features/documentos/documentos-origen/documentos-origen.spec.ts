import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { HttpRequest } from '@angular/common/http';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { environment } from '@env';
import { misPermisos } from '@app/core/auth/auth.testing';
import { MSG_SIN_PERMISO } from '@app/core/auth/auth.interceptor';
import { botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { AvisosService } from '@app/core/avisos/avisos.service';
import { lineaRequerimiento, requerimiento } from '../../requerimientos/requerimientos.testing';
import { DocumentoOrigen, DocumentoOrigenPaginated } from './interfaces/documentos-origen.interface';
import { DocumentosOrigenComponent } from './documentos-origen';

const API = `${environment.apiUrl}/documentos/origen`;
const API_FUR = `${environment.apiUrl}/requerimientos`;

const OC: DocumentoOrigen = {
  id: 30,
  id_oc: 'OC-30',
  tipo_costo: 'DIRECTO',
  tipo_oc: 'PRODUCTO',
  numero_oc: 'OC-000030',
  id_centro_costo: 3,
  nombre_centro_costo: 'Obra Norte',
  id_categoria: null,
  id_fase: null,
  nombre_fase: null,
  periodo: '2026',
  mes: 'OCTUBRE',
  id_anexo: 4,
  fecha_emision: '2026-10-01',
  forma_pago: 'Contado',
  moneda_id: 'PEN',
  moneda_simbolo: 'S/',
  monto: '100',
  igv: '18',
  renta_4ta: null,
  dscto_compras: null,
  dscto_intervencion: null,
  dscto_otros: null,
  total: '118',
  comentarios: null,
  oc_pdf: null,
  usuario: 'compras',
  fecha_creacion: null,
  hora_creacion: null,
  cotizacion: null,
  id_requerimiento: null,
  numero_requerimiento: null,
  estado_recepcion: 'PENDIENTE',
};

const FUR = requerimiento({ id: 5, numero: 'FUR-000005', estado: 'APROBADO', tipo: 'COMPRA', lineas: [lineaRequerimiento()] });

function responder(req: HttpRequest<unknown>) {
  if (req.url === API) {
    const pagina: DocumentoOrigenPaginated = { data: [OC], total: 1, page: 1, pageSize: 20, totalPages: 1 };
    return pagina;
  }
  if (req.url === `${API_FUR}/5`) return FUR;
  return [];
}

/** Ruta con o sin `?requerimiento=` (botón "Generar OC" de la lista de requerimientos). */
function ruta(query: Record<string, string> = {}) {
  return { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } };
}

async function montar(acciones: Partial<Permisos>, query: Record<string, string> = {}) {
  const urls: string[] = [];
  const p = await montarPantalla(
    DocumentosOrigenComponent,
    misPermisos('Compras', { 'documentos.origen': acciones }),
    (req) => {
      urls.push(req.url);
      return responder(req);
    },
    [ruta(query)],
  );
  expect(p.el.textContent).toContain('Obra Norte');
  return { ...p, urls };
}

const BOTONES = {
  desdeFur: 'Desde requerimiento',
  nuevo: 'Nuevo documento',
  editar: 'Editar documento',
  eliminar: 'Eliminar documento',
};

describe('DocumentosOrigenComponent: botones según permisos (documentos.origen)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('con solo ver: sin Desde requerimiento, Nuevo, Editar ni Eliminar', async () => {
    const { el } = await montar({});
    expect(botonesVisibles(el, BOTONES)).toEqual({ desdeFur: false, nuevo: false, editar: false, eliminar: false });
  });

  it('crear → Desde requerimiento y Nuevo; editar → Editar; eliminar → Eliminar', async () => {
    expect(botonesVisibles((await montar({ crear: true })).el, BOTONES)).toEqual({ desdeFur: true, nuevo: true, editar: false, eliminar: false });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ editar: true })).el, BOTONES)).toEqual({ desdeFur: false, nuevo: false, editar: true, eliminar: false });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ eliminar: true })).el, BOTONES)).toEqual({ desdeFur: false, nuevo: false, editar: false, eliminar: true });
  });

  it('el filtro de fase envía id_fase (el campo que filtra el backend)', async () => {
    const { el, http, render } = await montar({});
    const input = el.querySelector<HTMLInputElement>('input[placeholder="Fase (ID)"]');
    expect(input).not.toBeNull();
    if (!input) return;
    input.value = '7';
    input.dispatchEvent(new Event('input'));
    await render();
    const req = http.expectOne((r) => r.url === API);
    expect(req.request.params.get('id_fase')).toBe('7');
    expect(req.request.params.has('id_detalle_fase_categoria')).toBe(false);
    req.flush(responder(req.request));
    await render();
  });

  it('el selector de FUR muestra "Usar" con crear', async () => {
    const { el, http, render } = await montar({ crear: true });
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Desde requerimiento'))?.click();
    await render();
    http.expectOne(`${API_FUR}/pendientes-oc`).flush([FUR]);
    await render();
    expect(botonesVisibles(el, { usar: 'Usar' })).toEqual({ usar: true });
  });

  it('?requerimiento= sin crear: no abre el alta, no pide el FUR y muestra el aviso global', async () => {
    const { el, urls } = await montar({}, { requerimiento: '5' });
    expect(urls).not.toContain(`${API_FUR}/5`);
    expect(el.textContent).not.toContain('Orden de compra del requerimiento');
    expect(TestBed.inject(AvisosService).aviso()?.texto).toBe(MSG_SIN_PERMISO);
  });

  it('?requerimiento= con crear: abre el alta precargada con el FUR', async () => {
    const { el, urls } = await montar({ crear: true }, { requerimiento: '5' });
    expect(urls).toContain(`${API_FUR}/5`);
    expect(el.textContent).toContain('Orden de compra del requerimiento');
    expect(TestBed.inject(AvisosService).aviso()).toBeNull();
  });
});

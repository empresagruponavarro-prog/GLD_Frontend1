import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { misPermisos } from '@app/core/auth/auth.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { botonesVisibles, montarPantalla, responderVacio } from '@app/core/auth/pantalla.testing';
import { ObraDocumento, ObraPlano, ObraSemana } from './obra.interface';
import { ObraCockpitComponent } from './obra-cockpit';

const SEMANA: ObraSemana = {
  id: 1,
  numero_semana: 1,
  etiqueta_semana: 'SEM 01',
  fecha_inicio: '2026-01-05',
  fecha_fin: '2026-01-11',
  fase_principal: 'Obras',
  porcentaje_meta: 10,
  porcentaje_real: 5,
  estado: 'Retrasado',
  orden: 1,
};
const PLANO: ObraPlano = {
  id: 9,
  codigo_plano: 'ARQ-01',
  nombre_plano: 'Planta',
  disciplina: 'Arquitectura',
  version: 'v1.0',
  es_vigente: true,
  estado_aprobacion: 'En Revisión',
  archivo_url: 'k/ab12cd34_arq.pdf',
  created_at: '2026-01-01',
};
const DOCUMENTO: ObraDocumento = { id: 2, titulo: 'Acta', categoria: 'Acta', estado: 'Validado', created_at: '2026-01-01' };

const BOTONES = { editarObra: 'Editar Obra', programar: 'Programar semana', exportar: 'Exportar Ficha Técnica' };

const montar = (acciones: Partial<Permisos>) =>
  montarPantalla(ObraCockpitComponent, misPermisos('Usuario', { obra: acciones }), responderVacio);

describe('ObraCockpitComponent: permisos (obra)', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.restoreAllMocks();
  });

  it('con solo ver: sin Editar Obra ni altas; Exportar sigue', async () => {
    const { el } = await montar({});

    expect(botonesVisibles(el, BOTONES)).toEqual({ editarObra: false, programar: false, exportar: true });
  });

  it('editar → Editar Obra; crear → Programar semana', async () => {
    expect(botonesVisibles((await montar({ editar: true })).el, BOTONES)).toEqual({ editarObra: true, programar: false, exportar: true });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ crear: true })).el, BOTONES)).toEqual({ editarObra: false, programar: true, exportar: true });
  });

  it('sin permisos, los manejadores no abren diálogos de escritura ni piden confirmación (defensa)', async () => {
    const { cmp } = await montar({});
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);

    cmp.onEditarObra();
    cmp.onNuevaSemana();
    cmp.onGenerarLoteSemanas();
    cmp.onEditarSemana(SEMANA);
    cmp.onRegistrarAvanceSemana(SEMANA);
    cmp.onEliminarSemana(SEMANA);
    cmp.onNuevoResidente();
    cmp.onSubirPlano();
    cmp.onEditarPlano(PLANO);
    cmp.onNuevaVersionPlano(PLANO);
    cmp.onEliminarPlano(PLANO);
    cmp.onAnexarDocumento();
    cmp.onEliminarDocumento(DOCUMENTO);
    cmp.onReportarIncidencia();

    expect(confirmar).not.toHaveBeenCalled();
    expect(cmp.showGeneralesDialog()).toBe(false);
    expect(cmp.showSemanaDialog()).toBe(false);
    expect(cmp.showGeneradorSemanasDialog()).toBe(false);
    expect(cmp.selectedSemanaParaAvance()).toBeNull();
    expect(cmp.showResidenteDialog()).toBe(false);
    expect(cmp.showPlanoDialog()).toBe(false);
    expect(cmp.documentoEliminar()).toBeNull();
    expect(cmp.showDocumentoDialog()).toBe(false);
    expect(cmp.showIncidenciaDialog()).toBe(false);
  });

  it('las vistas siguen libres con solo ver: ficha del residente y detalle del documento se abren (en solo lectura)', async () => {
    const { cmp, render, el } = await montar({});

    cmp.onVerDetalleDocumento(DOCUMENTO);
    await render();

    expect(cmp.showDocumentoDialog()).toBe(true);
    expect(el.textContent).toContain('Detalle del documento técnico / acta');
    expect(el.querySelector('#btn-documento-guardar')).toBeNull();
  });

  it('con eliminar, Eliminar semana pide confirmación y envía el DELETE', async () => {
    const { cmp, http } = await montar({ eliminar: true });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    cmp.onEliminarSemana(SEMANA);

    expect(http.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/cronograma/1')).request.method).toBe('DELETE');
  });
});

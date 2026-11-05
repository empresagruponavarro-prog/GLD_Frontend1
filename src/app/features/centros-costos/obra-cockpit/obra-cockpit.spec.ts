import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { misPermisos } from '@app/core/auth/auth.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { botonesVisibles, montarPantalla, responderVacio } from '@app/core/auth/pantalla.testing';
import { ObraDocumento, ObraPlano } from './obra.interface';
import { ObraCockpitComponent } from './obra-cockpit';

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

  it('editar → Editar Obra; crear ya no ofrece Programar semana (cronograma solo lectura)', async () => {
    expect(botonesVisibles((await montar({ editar: true })).el, BOTONES)).toEqual({ editarObra: true, programar: false, exportar: true });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ crear: true })).el, BOTONES)).toEqual({ editarObra: false, programar: false, exportar: true });
  });

  it('sin permisos, los manejadores no abren diálogos de escritura ni piden confirmación (defensa)', async () => {
    const { cmp } = await montar({});
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);

    cmp.onEditarObra();
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

  it('ofrece la pestaña Liquidación y pide la liquidación de la obra al abrirla', async () => {
    const { el, cmp, http } = await montar({});
    const boton = el.querySelector<HTMLButtonElement>('#tab-liquidacion-btn')!;

    expect(boton.textContent).toContain('Liquidación');
    boton.click();

    expect(cmp.activeTab()).toBe('tab-liquidacion');
    // Se atiende la petición de la pestaña para que no quede nada abierto.
    http.match((r) => r.url.endsWith('/liquidacion')).forEach((r) => r.flush(null));
  });

  it('el menú Exportar abre el dosier, la ficha técnica y el informe de avance (ya no hay botones sin acción)', async () => {
    const { el, cmp, render } = await montar({});
    cmp.toggleExportMenu();
    await render();

    const href = (id: string) => el.querySelector<HTMLAnchorElement>(`#${id}`)?.getAttribute('href');
    expect(href('imprimir-dosier')).toBe('/imprimir/dosier/0');
    expect(href('imprimir-ficha')).toBe('/imprimir/ficha-obra/0');
    expect(href('imprimir-informe')).toBe('/imprimir/informe-avance/0');
    expect(el.querySelector<HTMLAnchorElement>('#imprimir-dosier')?.target).toBe('_blank');
  });
});

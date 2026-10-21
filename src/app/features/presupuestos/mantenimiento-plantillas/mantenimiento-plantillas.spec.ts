import { TestBed } from '@angular/core/testing';
import { HttpRequest } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { CdkDropList } from '@angular/cdk/drag-drop';
import { environment } from '@env';
import { misPermisos } from '@app/core/auth/auth.testing';
import { CuerpoRespuesta, Pantalla, botonesVisibles, montarPantalla } from '@app/core/auth/pantalla.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { CategoriaSelect } from '../../maestros-generales/categorias/interfaces/categorias.interface';
import { Plantilla, PlantillaCompleta } from '../presupuestos.service';
import { MantenimientoPlantillasComponent } from './mantenimiento-plantillas';

const API = `${environment.apiUrl}/presupuestos`;

const PLANTILLA: Plantilla = {
  id: 1,
  IdPlantilla: 'PLT-001',
  Nombre: 'Plantilla Tambo',
  Descripcion: 'Obra tipo tambo',
  Activo: true,
  FechaCreacion: '2026-10-01',
};

const COMPLETA: PlantillaCompleta = {
  ...PLANTILLA,
  fases: [
    {
      id: 10,
      IdPlantillaFase: 'PF-1',
      IdpptoFase: 'F01',
      NombreFase: 'Obras civiles',
      Orden: 0,
      categorias: [
        { id: 20, IdPlantillaFase: 'PF-1', IdpptoFaseCategoria: 'C01', NombreCategoria: 'Cimentación', CostoReferencial: 50, id_categoria: 1 },
      ],
    },
  ],
};

const CATEGORIAS: CategoriaSelect[] = [{ id: 1, nombre: 'Cemento' }];

function responder(req: HttpRequest<unknown>): CuerpoRespuesta {
  if (req.url === `${API}/plantillas/todas`) return [PLANTILLA];
  if (req.url === `${API}/plantillas/PLT-001/completa`) return COMPLETA;
  if (req.url.endsWith('/maestros/categoria/select')) return CATEGORIAS;
  return [];
}

async function montar(acciones: Partial<Permisos>): Promise<Pantalla<MantenimientoPlantillasComponent>> {
  const permisos = misPermisos('Usuario', { 'presupuestos.plantillas': acciones });
  return montarPantalla(MantenimientoPlantillasComponent, permisos, responder);
}

/** Selecciona la plantilla y responde su detalle (`GET /plantillas/:id/completa`). */
async function abrirEditor(p: Pantalla<MantenimientoPlantillasComponent>): Promise<void> {
  p.cmp.selectPlantilla(PLANTILLA);
  p.http.expectOne(`${API}/plantillas/PLT-001/completa`).flush(COMPLETA);
  await p.render();
}

function listas(p: Pantalla<MantenimientoPlantillasComponent>): CdkDropList[] {
  return p.fixture.debugElement.queryAll(By.directive(CdkDropList)).map((d) => d.injector.get(CdkDropList));
}

/** `true` si el control está deshabilitado (por sí mismo o por un `<fieldset disabled>`). */
function deshabilitado(e: Element | null): boolean {
  return e !== null && (e.matches(':disabled') || e.closest('fieldset:disabled') !== null);
}

const BOTONES_EDITOR = {
  guardar: 'Guardar Cambios',
  anadirFase: 'Añadir Fase',
  insertarFase: 'Insertar Fase Adicional',
  eliminarFase: 'Eliminar fase',
  anadirSubFase: 'Añadir Sub Fase',
  editarSubFase: 'Editar Sub Fase',
  descartar: 'Descartar',
};

describe('MantenimientoPlantillasComponent — permisos (presupuestos.plantillas, etapa D3)', () => {
  it('solo ver: sin "Nueva plantilla"', async () => {
    const { el } = await montar({});
    expect(el.textContent).toContain('Plantilla Tambo');
    expect(botonesVisibles(el, { nueva: 'Nueva Plantilla' })).toEqual({ nueva: false });
  });

  it('solo ver: editor deshabilitado, sin guardar/agregar/quitar y sin arrastrar', async () => {
    const p = await montar({});
    await abrirEditor(p);
    const nombre = p.el.querySelector<HTMLInputElement>('section input[type="text"]');
    expect(nombre?.value).toBe('Plantilla Tambo');
    expect(deshabilitado(nombre)).toBe(true);
    expect(deshabilitado(p.el.querySelector('section textarea'))).toBe(true);
    expect(deshabilitado(p.el.querySelector('section input[type="checkbox"]'))).toBe(true);
    expect(deshabilitado(p.el.querySelector('section input[type="number"]'))).toBe(true);
    // La categoría real ya no se elige en la tabla: se edita en el diálogo de ítems (que recibe soloLectura).
    expect(p.el.querySelector('section tbody select')).toBeNull();
    expect(botonesVisibles(p.el, BOTONES_EDITOR)).toEqual({
      guardar: false, anadirFase: false, insertarFase: false, eliminarFase: false,
      anadirSubFase: false, editarSubFase: false, descartar: true,
    });
    expect(p.el.querySelector('[cdkDragHandle]')).toBeNull();
    const drop = listas(p);
    expect(drop.length).toBeGreaterThan(1);
    expect(drop.every((l) => l.disabled)).toBe(true);

    // Los métodos tampoco escriben ni modifican la plantilla.
    p.cmp.guardarCambios();
    p.cmp.addFase();
    expect(p.cmp.showFaseModal()).toBe(false);
    const fase = p.cmp.selectedPlantilla()?.fases[0];
    if (fase) p.cmp.removeFase(fase);
    expect(p.cmp.selectedPlantilla()?.fases).toHaveLength(1);
    expect(p.http.match((r) => r.method !== 'GET')).toHaveLength(0);
  });

  it('con editar: editor habilitado, con todos sus botones y arrastrar', async () => {
    const p = await montar({ editar: true });
    expect(botonesVisibles(p.el, { nueva: 'Nueva Plantilla' })).toEqual({ nueva: false });
    await abrirEditor(p);
    expect(deshabilitado(p.el.querySelector('section input[type="text"]'))).toBe(false);
    expect(deshabilitado(p.el.querySelector('section input[type="number"]'))).toBe(false);
    expect(botonesVisibles(p.el, BOTONES_EDITOR)).toEqual({
      guardar: true, anadirFase: true, insertarFase: true, eliminarFase: true,
      anadirSubFase: true, editarSubFase: true, descartar: true,
    });
    expect(p.el.querySelector('[cdkDragHandle]')).not.toBeNull();
    expect(listas(p).every((l) => !l.disabled)).toBe(true);

    p.cmp.guardarCambios();
    const put = p.http.expectOne(`${API}/plantillas/PLT-001`);
    expect(put.request.method).toBe('PUT');
  });

  it('con crear: "Nueva plantilla"; sin editar, el alta no ofrece copiar ni crearla inactiva (requieren PUT)', async () => {
    const p = await montar({ crear: true });
    expect(botonesVisibles(p.el, { nueva: 'Nueva Plantilla' })).toEqual({ nueva: true });
    p.cmp.nuevaPlantilla();
    await p.render();
    expect(p.el.querySelector('#np-nombre')).not.toBeNull();
    expect(p.el.querySelector('#np-origen-copiar')).toBeNull();
    expect(p.el.querySelector('#np-activo')).toBeNull();
    TestBed.resetTestingModule();

    const ambos = await montar({ crear: true, editar: true });
    ambos.cmp.nuevaPlantilla();
    await ambos.render();
    expect(ambos.el.querySelector('#np-origen-copiar')).not.toBeNull();
    expect(ambos.el.querySelector('#np-activo')).not.toBeNull();
  });

  it('sin crear, nuevaPlantilla() no abre el pop-up', async () => {
    const p = await montar({ editar: true });
    p.cmp.nuevaPlantilla();
    expect(p.cmp.showNuevaPlantillaModal()).toBe(false);
  });

  it('permite colapsar y expandir fases como un acordeón en el editor', async () => {
    const p = await montar({});
    await abrirEditor(p);

    const fase = COMPLETA.fases[0];
    // Por defecto inicia expandida
    expect(p.cmp.isFaseColapsada(fase, 0)).toBe(false);
    expect(p.el.querySelector('.partida-row, tbody tr')).not.toBeNull();

    // Colapsar fase
    p.cmp.toggleFase(fase, 0);
    expect(p.cmp.isFaseColapsada(fase, 0)).toBe(true);
    await p.render();
    expect(p.el.querySelector('tbody')).toBeNull();

    // Expandir nuevamente
    p.cmp.toggleFase(fase, 0);
    expect(p.cmp.isFaseColapsada(fase, 0)).toBe(false);
    await p.render();
    expect(p.el.querySelector('tbody')).not.toBeNull();

    // Colapsar todas
    p.cmp.colapsarTodasFases();
    expect(p.cmp.isFaseColapsada(fase, 0)).toBe(true);

    // Expandir todas
    p.cmp.expandirTodasFases();
    expect(p.cmp.isFaseColapsada(fase, 0)).toBe(false);
  });
});

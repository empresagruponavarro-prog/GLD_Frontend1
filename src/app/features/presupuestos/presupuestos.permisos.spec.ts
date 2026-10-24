import { TestBed } from '@angular/core/testing';
import { HttpRequest } from '@angular/common/http';
import { environment } from '@env';
import { HttpTestingController } from '@angular/common/http/testing';
import { MemoryStorage, cargarPermisos, guardarSesion, misPermisos, providersPantalla } from '@app/core/auth/auth.testing';
import { MSG_SIN_PERMISO } from '@app/core/auth/auth.interceptor';
import { CuerpoRespuesta, Pantalla, botonesVisibles, hayBoton } from '@app/core/auth/pantalla.testing';
import { Permisos } from '@app/core/auth/permisos.models';
import { AvisosService } from '@app/core/avisos/avisos.service';
import { CentroCosto, MetricasPresupuestosCC, PaginatedCentrosCostos } from '../centros-costos/interfaces/centros-costos.interface';
import { PaginatedResponse, PresupuestoCompleto, PresupuestoPrincipal } from './interfaces';
import { PresupuestosComponent } from './presupuestos';

const API = environment.apiUrl;

const CC: CentroCosto = { id: 3, CentroCosto: 'Obra Norte', CodCentroCto: 'CC-3', id_empresa: 1 };

const PPTO: PresupuestoPrincipal = {
  id: 7,
  IdPresupuesto: 'PP-7',
  id_centro_costo: 3,
  TipoPpto: 'Principal',
  Concepto: 'PPTO CONTRACTUAL',
  Estado: 'PENDIENTE',
  CostoDirecto: 100,
  Total: 118,
};

const COMPLETO: PresupuestoCompleto = {
  ...PPTO,
  fases: [
    {
      id: 11,
      IdPresupuestoDetalle: 'DF-1',
      IdPresupuesto: 'PP-7',
      IdpptoFase: 'F01',
      NombreFase: 'Obras civiles',
      CostoDirecto: 100,
      id_fase: 5,
      categorias: [
        { id: 21, IdPresupuestoDetalle: 'DF-1', IdpptoFaseCategoria: 'C01', CategoriaInsumo: 'Cemento', CostoDirecto: 100 },
      ],
    },
  ],
};

function responder(req: HttpRequest<unknown>): CuerpoRespuesta {
  const url = req.url;
  if (url === `${API}/centros-costos`) {
    const pagina: PaginatedCentrosCostos = { data: [CC], total: 1, page: 1, pageSize: 50, totalPages: 1 };
    return pagina;
  }
  if (url === `${API}/centros-costos/metricas/presupuestos`) {
    const metricas: MetricasPresupuestosCC = { total: 1, abiertos: 1, enCierre: 0, cerrados: 0, totalPortafolio: 118 };
    return metricas;
  }
  if (url === `${API}/centros-costos/catalogos-filtros`) {
    return { empresas: [], periodos: [], clientes: [], estados: [], pptoEstados: [] };
  }
  if (url === `${API}/presupuestos`) {
    const pagina: PaginatedResponse = { data: [PPTO], total: 1, page: 1, pageSize: 100, totalPages: 1 };
    return pagina;
  }
  if (url === `${API}/presupuestos/PP-7/completo`) return COMPLETO;
  return [];
}

/** Responde (también las encadenadas) todas las peticiones GET pendientes; deja las de escritura. */
async function atender({ http, render }: Pantalla<PresupuestosComponent>): Promise<void> {
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    await render();
    const pendientes = http.match((r) => r.method === 'GET');
    if (pendientes.length === 0) break;
    for (const req of pendientes) req.flush(responder(req.request));
  }
  await render();
}

/**
 * Monta la pantalla como `montarPantalla`, pero pintando con `detectChanges`: sus `rxResource`
 * (métricas y lista paginada) cuentan como tareas pendientes y `whenStable()` no se resolvería
 * hasta responder sus peticiones.
 */
async function montar(acciones: Partial<Permisos>): Promise<Pantalla<PresupuestosComponent>> {
  const storage = new MemoryStorage();
  guardarSesion(storage, 'Usuario');
  TestBed.configureTestingModule({ imports: [PresupuestosComponent], providers: providersPantalla(storage) });
  const fixture = TestBed.createComponent(PresupuestosComponent);
  await cargarPermisos(misPermisos('Usuario', { presupuestos: acciones }));
  const render = async (): Promise<void> => {
    fixture.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  };
  const p: Pantalla<PresupuestosComponent> = {
    fixture,
    cmp: fixture.componentInstance,
    el: fixture.nativeElement,
    http: TestBed.inject(HttpTestingController),
    render,
  };
  await atender(p);
  p.cmp.onSelectCC(CC);
  await atender(p);
  return p;
}

const TODO: Partial<Permisos> = { crear: true, editar: true, eliminar: true };

const BOTONES_TABLA = {
  nuevo: 'Nuevo Presupuesto',
  verFases: 'Ver Fases y Categorías',
  plantilla: 'Cargar Plantilla',
  editar: 'Editar Presupuesto',
  eliminar: 'Eliminar Presupuesto',
};

const BOTONES_FASES = {
  aplicar: 'Aplicar Plantilla',
  nuevaFase: 'Nueva Fase',
  editarFase: 'Editar Fase',
  eliminarFase: 'Eliminar Fase',
  nuevaCategoria: 'Nueva Categoría',
  editarPartida: 'Editar Partida',
  eliminarPartida: 'Eliminar Partida',
  editarPpto: 'Editar Presupuesto',
};

/** `true` si el control está deshabilitado (por sí mismo o por un `<fieldset disabled>`). */
function deshabilitado(e: Element | null): boolean {
  return e !== null && (e.matches(':disabled') || e.closest('fieldset:disabled') !== null);
}

function cambiar(input: HTMLInputElement, valor: string): void {
  input.value = valor;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('change'));
}

describe('PresupuestosComponent — permisos (plan 05, etapa D3)', () => {
  afterEach(() => history.replaceState(null, ''));

  it('solo ver: sin "Nuevo", sin cargar plantilla, editar ni eliminar en la tabla; "Ver fases" libre', async () => {
    const { el } = await montar({});
    expect(botonesVisibles(el, BOTONES_TABLA)).toEqual({
      nuevo: false, verFases: true, plantilla: false, editar: false, eliminar: false,
    });
  });

  it('con crear, editar y eliminar: todos los botones de la tabla', async () => {
    const { el } = await montar(TODO);
    expect(botonesVisibles(el, BOTONES_TABLA)).toEqual({
      nuevo: true, verFases: true, plantilla: true, editar: true, eliminar: true,
    });
  });

  it('cada acción muestra solo sus botones: crear → Nuevo; editar → plantilla/editar; eliminar → eliminar', async () => {
    expect(botonesVisibles((await montar({ crear: true })).el, BOTONES_TABLA)).toEqual({
      nuevo: true, verFases: true, plantilla: false, editar: false, eliminar: false,
    });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ editar: true })).el, BOTONES_TABLA)).toEqual({
      nuevo: false, verFases: true, plantilla: true, editar: true, eliminar: false,
    });
    TestBed.resetTestingModule();
    expect(botonesVisibles((await montar({ eliminar: true })).el, BOTONES_TABLA)).toEqual({
      nuevo: false, verFases: true, plantilla: false, editar: false, eliminar: true,
    });
  });

  it('modal "Fases y costos" con solo ver: consulta sin altas, ediciones ni eliminaciones', async () => {
    const p = await montar({});
    p.cmp.abrirFasesModal(PPTO);
    await atender(p);
    expect(p.el.textContent).toContain('Obras civiles');
    expect(p.el.textContent).toContain('Cemento');
    expect(botonesVisibles(p.el, BOTONES_FASES)).toEqual({
      aplicar: false, nuevaFase: false, editarFase: false, eliminarFase: false,
      nuevaCategoria: false, editarPartida: false, eliminarPartida: false, editarPpto: false,
    });
  });

  it('modal "Fases y costos" con permisos: todos sus botones', async () => {
    const p = await montar(TODO);
    p.cmp.abrirFasesModal(PPTO);
    await atender(p);
    expect(botonesVisibles(p.el, BOTONES_FASES)).toEqual({
      aplicar: true, nuevaFase: true, editarFase: true, eliminarFase: true,
      nuevaCategoria: true, editarPartida: true, eliminarPartida: true, editarPpto: true,
    });
  });

  it('los métodos no hacen nada sin permiso (abrir edición, alta y modales)', async () => {
    const p = await montar({});
    p.cmp.openEditPresupuesto(PPTO);
    p.cmp.openNewPresupuestoForm(CC);
    await atender(p);
    expect(p.cmp.showForm()).toBe(false);
    p.cmp.abrirNuevaFase();
    expect(p.cmp.modalFaseOpen()).toBe(false);
    p.cmp.eliminarPresupuestoDeCC(PPTO);
    p.cmp.delete('PP-7');
    expect(p.http.match((r) => r.method === 'DELETE')).toHaveLength(0);
  });

  it('paso 2 con solo ver: inputs en línea deshabilitados, sin acciones y un cambio no dispara PATCH', async () => {
    const p = await montar({});
    p.cmp.abrirPresupuestoEnForm(PPTO, 2);
    await atender(p);
    expect(p.cmp.soloLectura()).toBe(true);
    const monto = p.el.querySelector<HTMLInputElement>('input[type="number"][step="0.01"]');
    expect(monto).not.toBeNull();
    expect(deshabilitado(monto)).toBe(true);
    expect(botonesVisibles(p.el, {
      usar: 'Usar Plantilla', agregar: '+ Agregar', editarFila: 'Editar categoría / monto',
      quitar: 'Eliminar fila', guardar: 'GUARDAR PRESUPUESTO',
    })).toEqual({ usar: false, agregar: false, editarFila: false, quitar: false, guardar: false });

    // Aunque llegue el evento (o se llame al método), no se escribe nada.
    if (monto) cambiar(monto, '250');
    p.cmp.onCategoriaRealChange(0, 'Otra');
    p.cmp.updateFormFaseSubtotal(0, 999);
    p.cmp.persistirSubtotalFila(0);
    await p.render();
    expect(p.http.match((r) => r.method !== 'GET')).toHaveLength(0);
    expect(p.cmp.formFases()[0].subtotal).toBe(100);
  });

  it('paso 2 con editar: inputs habilitados y el cambio de monto guarda al momento (PATCH)', async () => {
    const p = await montar(TODO);
    p.cmp.abrirPresupuestoEnForm(PPTO, 2);
    await atender(p);
    expect(p.cmp.soloLectura()).toBe(false);
    const monto = p.el.querySelector<HTMLInputElement>('input[type="number"][step="0.01"]');
    expect(deshabilitado(monto)).toBe(false);
    expect(hayBoton(p.el, 'GUARDAR PRESUPUESTO')).toBe(true);
    expect(hayBoton(p.el, 'Eliminar fila')).toBe(true);
    if (monto) cambiar(monto, '250');
    await p.render();
    const patch = p.http.expectOne((r) => r.method === 'PATCH');
    expect(patch.request.url).toBe(`${API}/presupuestos/categorias-asignadas/21`);
    expect(patch.request.body).toEqual({ CostoDirecto: 250 });
  });

  it('paso 2 con editar pero sin crear ni eliminar: edita en línea, pero no agrega ni quita filas guardadas', async () => {
    const p = await montar({ editar: true });
    p.cmp.abrirPresupuestoEnForm(PPTO, 2);
    await atender(p);
    expect(botonesVisibles(p.el, { agregar: '+ Agregar', editarFila: 'Editar categoría / monto', quitar: 'Eliminar fila' }))
      .toEqual({ agregar: false, editarFila: true, quitar: false });
  });

  it('pasos 3 y 5 en solo lectura sin editar (estado "Aprobado" incluido)', async () => {
    const p = await montar({});
    p.cmp.abrirPresupuestoEnForm(PPTO, 3);
    await atender(p);
    expect(deshabilitado(p.el.querySelector('input[aria-label="Porcentaje de gastos generales"]'))).toBe(true);
    p.cmp.switchStep(5);
    await p.render();
    expect(deshabilitado(p.el.querySelector('#comentarios-input'))).toBe(true);
    const aprobado = Array.from(p.el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Aprobado') ?? null;
    expect(deshabilitado(aprobado)).toBe(true);
    p.cmp.savePresupuestoCompleto();
    expect(p.http.match((r) => r.method !== 'GET')).toHaveLength(0);
  });

  it('"Ppto" desde centros de costo sin crear: no abre el alta y muestra el aviso global', async () => {
    history.replaceState({ fromCC: CC }, '');
    const p = await montar({ editar: true });
    expect(p.cmp.showForm()).toBe(false);
    expect(TestBed.inject(AvisosService).aviso()?.texto).toBe(MSG_SIN_PERMISO);
  });

  it('"Ppto" desde centros de costo con crear: abre el alta precargada y sin aviso', async () => {
    history.replaceState({ fromCC: CC }, '');
    const p = await montar({ crear: true });
    expect(p.cmp.showForm()).toBe(true);
    expect(p.cmp.selectedCC()?.CentroCosto).toBe('Obra Norte');
    expect(p.cmp.soloLectura()).toBe(false);
    expect(TestBed.inject(AvisosService).aviso()).toBeNull();
  });
});

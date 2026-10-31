import { TODOS_PERMISOS_OBRA, camposEditables, montar, permisosObra } from '../obra-cockpit.testing';
import { ObraSubpartida } from '../obra-control.interface';
import { ImportarExcelDialogComponent } from './importar-excel-dialog/importar-excel-dialog';
import { ImportarPresupuestoDialogComponent } from './importar-presupuesto-dialog/importar-presupuesto-dialog';
import { MetasDialogComponent } from './metas-dialog/metas-dialog';
import { ReprogramacionDialogComponent } from './reprogramacion-dialog/reprogramacion-dialog';

const poner = (el: HTMLElement, selector: string, valor: string) => {
  const c = el.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
  c.value = valor;
  c.dispatchEvent(new Event(c instanceof HTMLSelectElement ? 'change' : 'input'));
};

describe('ReprogramacionDialogComponent', () => {
  const abrir = (permisos = TODOS_PERMISOS_OBRA) => montar(ReprogramacionDialogComponent, { isOpen: true, idCentroCosto: 10, permisos });

  it('solo ver: campos bloqueados, sin botón y sin envío', async () => {
    const { el, http } = await abrir(permisosObra());

    expect(camposEditables(el)).toHaveLength(0);
    expect(el.querySelector('button[type="submit"]')).toBeNull();
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    http.expectNone(() => true);
  });

  it('exige de 1 a 60 días antes de enviar', async () => {
    const { el, http, render } = await abrir();
    poner(el, '#rep-desde', '2026-10-05');
    poner(el, '#rep-dias', '90');
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    await render();

    http.expectNone(() => true);
    expect(el.textContent).toContain('de 1 a 60 días');
  });

  it('envía fecha, días, motivo y detalle', async () => {
    const { el, http } = await abrir();
    poner(el, '#rep-desde', '2026-10-05');
    poner(el, '#rep-dias', '7');
    poner(el, '#rep-motivo', 'PERMISO_LICENCIA');
    poner(el, '#rep-detalle', 'Licencia municipal');
    el.querySelector('form')?.dispatchEvent(new Event('submit'));

    const req = http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/reprogramaciones'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ desde: '2026-10-05', dias: 7, motivo: 'PERMISO_LICENCIA', detalle: 'Licencia municipal' });
  });
});

/**
 * El diálogo pide los presupuestos al abrirse: `montar` esperaría esa petición para siempre, así que se
 * monta cerrado, se abre y se responde antes de volver a esperar.
 */
async function abrirImportar(respuesta: unknown[], inputs: Record<string, unknown> = {}) {
  const m = await montar(ImportarPresupuestoDialogComponent, { isOpen: false, idCentroCosto: 10, permisos: TODOS_PERMISOS_OBRA, ...inputs });
  m.fixture.componentRef.setInput('isOpen', true);
  m.fixture.detectChanges();
  m.http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/presupuestos-disponibles')).flush(respuesta);
  await m.render();
  return m;
}

describe('ImportarPresupuestoDialogComponent', () => {
  const lista = [{ id: 3, id_presupuesto: 'P-001', version: '2', tipo: 'Obra', estado: 'Aprobado', proyecto: 'Tienda Norte', fases: 4, categorias: 12 }];

  it('con un solo presupuesto lo deja elegido e importa sin reemplazar', async () => {
    const { el, http } = await abrirImportar(lista);

    expect(el.textContent).toContain('P-001');
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Importar'))?.click();
    const req = http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/partidas/importar-presupuesto'));
    expect(req.request.body).toEqual({ idPresupuesto: 3, reemplazar: false });
  });

  it('con estructura previa avisa que reemplaza y lo pide al servidor', async () => {
    const { el, http } = await abrirImportar(lista, { hayEstructura: true });

    expect(el.textContent).toContain('reemplaza');
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Reemplazar estructura'))?.click();
    expect(http.expectOne((r) => r.url.endsWith('/partidas/importar-presupuesto')).request.body).toEqual({ idPresupuesto: 3, reemplazar: true });
  });

  it('sin presupuestos aprobados lo dice y no ofrece importar', async () => {
    const { el } = await abrirImportar([]);

    expect(el.textContent).toContain('no tiene presupuestos aprobados');
    const importar = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Importar');
    expect(importar?.disabled).toBe(true);
  });
});

describe('MetasDialogComponent', () => {
  const sub: ObraSubpartida = {
    id: 5,
    id_partida: 1,
    item: '01.01',
    nombre: 'Desmontaje',
    tipo: 'CONTRACTUAL',
    tipo_propio: null,
    fecha_inicio: '2026-09-19',
    fecha_fin: '2026-09-22',
    orden: 1,
    observacion: null,
    id_ppto_detalle_categoria: null,
    metas_manuales: Array<number | null>(10).fill(null),
    tiene_avance: false,
  };
  const abrir = (permisos = TODOS_PERMISOS_OBRA) => montar(MetasDialogComponent, { isOpen: true, idCentroCosto: 10, subpartida: sub, inicioObra: '2026-09-14', permisos });

  it('muestra el reparto automático por días laborables como referencia y suma 100', async () => {
    const { el } = await abrir();

    expect(el.querySelector<HTMLInputElement>('#meta-1')?.placeholder).toBe('33.3');
    expect(el.querySelector<HTMLInputElement>('#meta-2')?.placeholder).toBe('66.7');
    expect(el.querySelector('[data-testid="suma-metas"]')?.textContent).toContain('100');
  });

  it('avisa si lo escrito no suma 100 y envía null en las semanas vacías', async () => {
    const { el, http, render } = await abrir();
    poner(el, '#meta-1', '20');
    await render();
    expect(el.querySelector('[data-testid="suma-metas"]')?.textContent).toContain('no suma 100');

    poner(el, '#meta-1', '50');
    poner(el, '#meta-2', '50');
    await render();
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Guardar metas'))?.click();
    const req = http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/subpartidas/5/metas'));
    expect((req.request.body as { metas: (number | null)[] }).metas.slice(0, 3)).toEqual([50, 50, null]);
  });

  it('solo ver: campos bloqueados y sin guardar', async () => {
    const { el } = await abrir(permisosObra());

    expect(Array.from(el.querySelectorAll('input')).every((i) => i.disabled)).toBe(true);
    expect(Array.from(el.querySelectorAll('button')).some((b) => b.textContent?.includes('Guardar metas'))).toBe(false);
  });
});

/** El entorno de pruebas no trae `DataTransfer`: se fija la lista de archivos del input a mano. */
function ponerArchivo(input: HTMLInputElement, nombre: string): void {
  Object.defineProperty(input, 'files', { value: [new File(['x'], nombre)], configurable: true });
  input.dispatchEvent(new Event('change'));
}

describe('ImportarExcelDialogComponent', () => {
  const vista = (extra: Record<string, unknown> = {}) => ({
    archivo: 'p.xlsx',
    importable: true,
    ficha: { codigo: 'OP-26-017', cliente: 'Tambo', tienda: 'Pacasmayo Callao', departamento: 'Callao', estado: 'EN_EJECUCION', inicio: '2026-09-17', fin: '2026-10-26' },
    resumen: { partidas: 11, subpartidas: 40, subpartidas_con_avance: 12, metas_manuales: 0, reprogramaciones: 1 },
    equipo: [
      { rol: 'jefe_proyecto', texto: 'Melissa G.', persona: { id: 7, nombre: 'Melissa García' } },
      { rol: 'residente', texto: 'Yudith Peña', persona: null },
    ],
    obra_actual: { codigo_obra: null, estado_obra: null, partidas: 0, subpartidas: 0, con_avance: false, reprogramaciones: 0 },
    reemplaza_estructura: false,
    errores: [],
    avisos: [{ fila: 'Ficha', mensaje: 'residente «Yudith Peña»: no está en el maestro de Trabajadores' }],
    ...extra,
  });

  async function abrir(permisos = TODOS_PERMISOS_OBRA) {
    const m = await montar(ImportarExcelDialogComponent, { isOpen: true, idCentroCosto: 10, permisos });
    const elegir = async () => {
      const input = m.el.querySelector<HTMLInputElement>('#imp-excel')!;
      ponerArchivo(input, 'proyecto.xlsx');
    };
    const boton = (texto: string) => Array.from(m.el.querySelectorAll('button')).find((b) => b.textContent?.trim() === texto);
    return { ...m, elegir, boton };
  }

  it('al elegir el archivo muestra la vista previa con el equipo, los avisos y el resumen', async () => {
    const { el, http, render, elegir } = await abrir();
    await elegir();
    const req = http.expectOne((r) => r.url.endsWith('/operaciones/obra/10/importar-excel'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect(req.request.params.has('confirmar')).toBe(false);
    req.flush(vista());
    await render();

    expect(el.querySelector('[data-testid="resumen-excel"]')?.textContent).toContain('11 partida(s)');
    expect(el.textContent).toContain('Melissa García');
    expect(el.textContent).toContain('sin asignar');
    expect(el.querySelector('[data-testid="avisos-excel"]')?.textContent).toContain('1 aviso(s)');
    expect(el.querySelector('[data-testid="errores-excel"]')).toBeNull();
  });

  it('con errores no deja importar', async () => {
    const { el, http, render, elegir, boton } = await abrir();
    await elegir();
    http.expectOne((r) => r.url.endsWith('/importar-excel')).flush(vista({ importable: false, errores: [{ fila: 'Partidas f. 9', nombre: 'Cerco', mensaje: 'el fin es anterior al inicio' }] }));
    await render();

    expect(el.querySelector('[data-testid="errores-excel"]')?.textContent).toContain('el fin es anterior al inicio');
    expect(boton('Importar')?.disabled).toBe(true);
  });

  it('confirmar envía el archivo con confirmar=true y avisa que se guardó', async () => {
    const { http, render, elegir, boton, fixture } = await abrir();
    const guardado = vi.fn();
    fixture.componentInstance.saved.subscribe(guardado);
    await elegir();
    http.expectOne((r) => r.url.endsWith('/importar-excel')).flush(vista());
    await render();
    boton('Importar')?.click();

    const req = http.expectOne((r) => r.url.endsWith('/importar-excel') && r.params.get('confirmar') === 'true');
    req.flush({ importado: true, resumen: vista().resumen, avisos: [] });
    expect(guardado).toHaveBeenCalledOnce();
  });

  it('un archivo que no es .xlsx se rechaza sin llamar al servidor', async () => {
    const { el, http, render } = await abrir();
    const input = el.querySelector<HTMLInputElement>('#imp-excel')!;
    ponerArchivo(input, 'notas.txt');
    await render();

    http.expectNone(() => true);
    expect(el.textContent).toContain('Solo se aceptan archivos .xlsx');
  });

  it('solo ver: no hay botón Importar ni se puede elegir archivo', async () => {
    const { el, boton } = await abrir(permisosObra());

    expect(boton('Importar')).toBeUndefined();
    expect(el.querySelector<HTMLInputElement>('#imp-excel')?.disabled).toBe(true);
  });
});

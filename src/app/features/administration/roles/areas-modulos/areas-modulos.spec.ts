import { TestBed } from '@angular/core/testing';
import { HttpRequest } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { environment } from '@env';
import { misPermisos } from '@app/core/auth/auth.testing';
import { MisPermisos } from '@app/core/auth/permisos.models';
import { CuerpoRespuesta, montarPantalla } from '@app/core/auth/pantalla.testing';
import { AreaMatriz, MatrizAreas } from '../interfaces';
import { rolesPendientesGuard } from '../roles.guard';
import { AreasModulosComponent } from './areas-modulos';

const API = `${environment.apiUrl}/administration/permisos/areas`;

const MODULOS = [
  { id: 1, clave: 'modulos', nombre: 'Menú de módulos', grupo: 'Navegación', configurable: false },
  { id: 2, clave: 'requerimientos', nombre: 'Requerimientos', grupo: 'Documentos', configurable: true },
  { id: 3, clave: 'tesoreria.pagos', nombre: 'Ejecución de pagos', grupo: 'Tesorería', configurable: true },
  { id: 4, clave: 'almacen.stock', nombre: 'Stock actual', grupo: 'Almacén', configurable: true },
];

const area = (id: number, nombre: string, usuarios: number, modulos: AreaMatriz['modulos'] = [], estado = true): AreaMatriz => ({
  id,
  codigo: nombre.toUpperCase(),
  nombre,
  estado,
  usuarios,
  configurada: modulos.length > 0,
  modulos,
});

function matriz(over: Partial<MatrizAreas> = {}): MatrizAreas {
  const areas = over.areas ?? [
    area(1, 'Procura', 10, [{ clave: 'requerimientos', nivel: 'completo' }]),
    area(2, 'Almacén', 5),
    area(3, 'Antigua', 0, [], false),
  ];
  return { modulos: MODULOS, areas, sin_area: ['tesoreria.pagos', 'almacen.stock'], ...over };
}

const ADMIN = misPermisos('Administrador', {}, true);
const SOLO_VER = misPermisos('Consulta', { 'admin.roles': {} });

async function montar(inicial: MatrizAreas = matriz(), permisos: MisPermisos = ADMIN) {
  const responder = (req: HttpRequest<unknown>): CuerpoRespuesta => (req.url === API ? inicial : null);
  const p = await montarPantalla(AreasModulosComponent, permisos, responder);
  const q = <T extends Element>(sel: string) => p.el.querySelector<T>(sel);
  const celda = (idArea: number, clave: string) => q<HTMLButtonElement>(`[data-testid="celda-${idArea}-${clave}"]`);
  const nivel = (idArea: number, clave: string) => celda(idArea, clave)?.textContent?.trim();
  const clic = async (sel: string) => {
    const boton = q<HTMLButtonElement>(sel);
    if (!boton) throw new Error(`no existe ${sel}`);
    boton.click();
    await p.render();
  };
  const ciclar = async (idArea: number, clave: string) => clic(`[data-testid="celda-${idArea}-${clave}"]`);
  return { ...p, q, celda, nivel, clic, ciclar };
}

describe('AreasModulosComponent (módulos por área, plan 08)', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.restoreAllMocks();
  });

  it('muestra una columna por área activa y el nivel de cada módulo configurable', async () => {
    const { el, nivel, q } = await montar();
    expect(q('[data-testid="area-1"]')?.textContent).toContain('Procura');
    expect(q('[data-testid="area-2"]')?.textContent).toContain('Almacén');
    expect(q('[data-testid="area-3"]')).toBeNull(); // inactiva
    expect(nivel(1, 'requerimientos')).toBe('Completo');
    expect(nivel(1, 'tesoreria.pagos')).toBe('No');
    expect(nivel(2, 'requerimientos')).toBe('No');
    // El menú de módulos no depende del área: no tiene celdas.
    expect(el.querySelector('[data-testid="celda-1-modulos"]')).toBeNull();
    expect(el.textContent).toContain('Solo por rol');
    expect(el.textContent).toContain('Navegación');
  });

  it('avisa de las áreas sin configurar y de los módulos que ninguna área tiene', async () => {
    const { q } = await montar();
    expect(q('[data-testid="areas-sin-configurar"]')?.textContent).toContain('Almacén');
    expect(q('[data-testid="areas-sin-configurar"]')?.textContent).toContain('5 usuario(s)');
    expect(q('[data-testid="areas-sin-area"]')?.textContent).toContain('Ejecución de pagos');
    expect(q('[data-testid="areas-sin-area"]')?.textContent).toContain('Stock actual');
  });

  it('cada clic cambia la celda: No → Solo ver → Completo → No', async () => {
    const { nivel, ciclar } = await montar();
    expect(nivel(2, 'tesoreria.pagos')).toBe('No');
    await ciclar(2, 'tesoreria.pagos');
    expect(nivel(2, 'tesoreria.pagos')).toBe('Solo ver');
    await ciclar(2, 'tesoreria.pagos');
    expect(nivel(2, 'tesoreria.pagos')).toBe('Completo');
    await ciclar(2, 'tesoreria.pagos');
    expect(nivel(2, 'tesoreria.pagos')).toBe('No');
  });

  it('Guardar aparece solo en el área con cambios y envía todos sus módulos con su nivel', async () => {
    const { q, http, ciclar, clic, render, nivel } = await montar(matriz({ areas: [area(1, 'Procura', 0, [{ clave: 'requerimientos', nivel: 'completo' }]), area(2, 'Almacén', 0)] }));
    expect(q('[data-testid="area-guardar-1"]')).toBeNull();
    await ciclar(1, 'tesoreria.pagos'); // No → Solo ver
    expect(q('[data-testid="area-guardar-1"]')).not.toBeNull();
    expect(q('[data-testid="area-guardar-2"]')).toBeNull();

    await clic('[data-testid="area-guardar-1"]');
    const put = http.expectOne((r) => r.method === 'PUT' && r.url === `${API}/1`);
    expect(put.request.body).toEqual({
      modulos: [
        { clave: 'requerimientos', nivel: 'completo' },
        { clave: 'tesoreria.pagos', nivel: 'solo_ver' },
      ],
    });
    put.flush(area(1, 'Procura', 0, [{ clave: 'requerimientos', nivel: 'completo' }, { clave: 'tesoreria.pagos', nivel: 'solo_ver' }]));
    await render();
    // Tras guardar se vuelve a leer la matriz del servidor.
    http
      .expectOne((r) => r.method === 'GET' && r.url === API)
      .flush(
        matriz({
          areas: [area(1, 'Procura', 0, [{ clave: 'requerimientos', nivel: 'completo' }, { clave: 'tesoreria.pagos', nivel: 'solo_ver' }]), area(2, 'Almacén', 0)],
          sin_area: ['almacen.stock'],
        }),
      );
    await render();
    expect(q('[data-testid="areas-aviso"]')?.textContent).toContain('Procura');
    expect(q('[data-testid="area-guardar-1"]')).toBeNull();
    expect(nivel(1, 'tesoreria.pagos')).toBe('Solo ver');
  });

  it('con usuarios en el área, quitar un módulo pide confirmar y si se cancela no guarda', async () => {
    const { http, ciclar, clic } = await montar();
    // Procura (10 usuarios) tiene requerimientos completo: Completo → No lo quita.
    await ciclar(1, 'requerimientos');
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await clic('[data-testid="area-guardar-1"]');
    expect(confirmar).toHaveBeenCalledOnce();
    expect(confirmar.mock.calls[0][0]).toContain('10 usuario(s)');
    http.expectNone((r) => r.method === 'PUT');
  });

  it('configurar por primera vez un área con usuarios avisa que solo verán los módulos marcados', async () => {
    const { http, ciclar, clic } = await montar();
    await ciclar(2, 'almacen.stock');
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await clic('[data-testid="area-guardar-2"]');
    expect(confirmar.mock.calls[0][0]).toContain('hoy no está restringida');
    http.expectNone((r) => r.method === 'PUT');
  });

  it('Descartar vuelve a lo guardado', async () => {
    const { ciclar, clic, nivel, q } = await montar();
    await ciclar(2, 'tesoreria.pagos');
    expect(nivel(2, 'tesoreria.pagos')).toBe('Solo ver');
    await clic('[data-testid="area-descartar-2"]');
    expect(nivel(2, 'tesoreria.pagos')).toBe('No');
    expect(q('[data-testid="area-guardar-2"]')).toBeNull();
  });

  it('las acciones rápidas llenan o limpian un área (todo completo, solo ver, quitar todo, copiar de otra)', async () => {
    const { el, nivel, render } = await montar();
    const rapida = async (idArea: number, valor: string) => {
      const select = el.querySelector<HTMLSelectElement>(`[data-testid="area-${idArea}"] select`);
      if (!select) throw new Error('falta la acción rápida');
      select.value = valor;
      select.dispatchEvent(new Event('change'));
      await render();
    };
    await rapida(2, 'completo');
    expect(nivel(2, 'requerimientos')).toBe('Completo');
    expect(nivel(2, 'almacen.stock')).toBe('Completo');
    await rapida(2, 'solo_ver');
    expect(nivel(2, 'tesoreria.pagos')).toBe('Solo ver');
    await rapida(2, 'limpiar');
    expect(nivel(2, 'requerimientos')).toBe('No');
    await rapida(2, 'copiar:1'); // copia lo que hoy tiene Procura
    expect(nivel(2, 'requerimientos')).toBe('Completo');
    expect(nivel(2, 'tesoreria.pagos')).toBe('No');
  });

  it('un error al guardar se muestra y deja lo editado', async () => {
    const { http, q, ciclar, clic, render, nivel } = await montar(matriz({ areas: [area(1, 'Procura', 0), area(2, 'Almacén', 0)] }));
    await ciclar(1, 'tesoreria.pagos');
    await clic('[data-testid="area-guardar-1"]');
    http.expectOne((r) => r.method === 'PUT').flush({ message: ['Módulo desconocido'] }, { status: 400, statusText: 'Bad Request' });
    await render();
    expect(q('[data-testid="areas-error"]')?.textContent).toContain('No se pudieron guardar');
    expect(nivel(1, 'tesoreria.pagos')).toBe('Solo ver');
  });

  it('sin permiso de editar la matriz es de solo lectura', async () => {
    const { q, celda, nivel } = await montar(matriz(), SOLO_VER);
    expect(celda(1, 'requerimientos')?.disabled).toBe(true);
    expect(nivel(1, 'requerimientos')).toBe('Completo');
    expect(q('[data-testid="area-guardar-1"]')).toBeNull();
    expect(q('[data-testid="area-1"] select')).toBeNull();
  });

  it('la ruta pide confirmar al salir con cambios sin guardar', async () => {
    const { cmp, ciclar } = await montar();
    expect(rolesPendientesGuard(cmp, null as never, null as never, null as never)).toBe(true);
    await ciclar(2, 'tesoreria.pagos');
    expect(cmp.tieneCambiosPendientes()).toBe(true);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await expect(cmp.confirmarSalida()).resolves.toBe(false);
  });

  it('sin áreas activas lo explica', async () => {
    const { q } = await montar(matriz({ areas: [area(3, 'Antigua', 0, [], false)] }));
    expect(q('[data-testid="areas-vacio"]')).not.toBeNull();
    expect(q('[data-testid="areas-tabla"]')).toBeNull();
  });
});

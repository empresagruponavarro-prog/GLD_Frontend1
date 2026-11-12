import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { MIS_PERMISOS_URL, MemoryStorage, guardarSesion, misPermisos, provideSesionStorage } from '../auth/auth.testing';
import { MisPermisos } from '../auth/permisos.models';
import { PermisosService } from '../auth/permisos.service';
import { SidebarComponent } from './sidebar';
import { MENU_LATERAL } from './sidebar.menu';

const storage = new MemoryStorage();

/** Todas las rutas del menú, en orden. */
const TODAS = MENU_LATERAL.flatMap((s) =>
  s.entradas.flatMap((e) => (e.tipo === 'enlace' ? [e.enlace.ruta] : e.submenu.enlaces.map((x) => x.ruta))),
);

async function setup(rol: string, respuesta: MisPermisos | null) {
  guardarSesion(storage, rol);
  TestBed.configureTestingModule({
    imports: [SidebarComponent],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideSesionStorage(storage)],
  });
  const fixture = TestBed.createComponent(SidebarComponent);
  if (respuesta) {
    const carga = TestBed.inject(PermisosService).recargar();
    TestBed.inject(HttpTestingController).expectOne(MIS_PERMISOS_URL).flush(respuesta);
    await carga;
  }
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const enlaces = () =>
    Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href]')).map((a) => ({
      href: a.getAttribute('href'),
      texto: a.textContent?.trim(),
      clase: a.className,
      icono: Array.from(a.querySelector('i')?.classList ?? []).sort().join(' '),
    }));
  const textos = (sel: string) => Array.from(el.querySelectorAll(sel)).map((x) => x.textContent?.trim());
  const desplegarTodos = async () => {
    el.querySelectorAll<HTMLElement>('.sidebar-item.has-sub').forEach((h) => {
      if (h.getAttribute('aria-expanded') !== 'true') h.click();
    });
    await fixture.whenStable();
  };
  return { fixture, el, enlaces, textos, desplegarTodos };
}

describe('SidebarComponent', () => {
  beforeEach(() => storage.clear());
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    storage.clear();
  });

  it('Administrador ve todos los enlaces, en el mismo orden, con sus clases e iconos al desplegar', async () => {
    const { enlaces, textos, desplegarTodos } = await setup('Administrador', misPermisos('Administrador', {}, true));
    await desplegarTodos();
    const lista = enlaces();
    expect(lista.map((e) => e.href)).toEqual(TODAS);
    expect(lista).toHaveLength(40);
    expect(textos('.menu-category')).toEqual(['Navegación', 'Operaciones', 'Módulos del Sistema', 'Inv. Tecnología', 'RR.HH.', 'Administración']);
    expect(textos('.sidebar-item.has-sub > span')).toEqual(['Proyectos', 'Documentos', 'Tesorería', 'Control de Almacén', 'Maestros Generales', 'Activo Fijo']);
    expect(lista[0]).toEqual({
      href: '/operaciones',
      texto: 'Dashboard de Operaciones',
      clase: expect.stringContaining('sidebar-item'),
      icono: 'fa-gauge-high fa-solid',
    });
    expect(lista.find((e) => e.href === '/anexos')?.clase).toContain('sidebar-subitem');

    // "Roles y permisos" va justo debajo de "Usuarios", con el mismo estilo.
    const i = lista.findIndex((e) => e.href === '/admin/usuarios');
    expect(lista[i].texto).toBe('Usuarios');
    expect(lista[i + 1]).toMatchObject({ href: '/admin/roles', texto: 'Roles y permisos' });
    expect(lista[i + 1].clase).toContain('sidebar-item');

    // Especialidades y Tipo Documento de Identidad van justo debajo de "Registro de Incidencias".
    const j = lista.findIndex((e) => e.href === '/incidencias');
    expect(lista.slice(j, j + 3).map((e) => e.href)).toEqual(['/incidencias', '/maestros-generales/especialidades', '/maestros-generales/tipo-doc-identidad']);
  });

  it('un usuario con permisos parciales ve solo sus enlaces y grupos', async () => {
    const { enlaces, textos, desplegarTodos } = await setup(
      'Jefe de Área',
      misPermisos('Jefe de Área', { incidencias: {}, 'tesoreria.pagos': {}, 'tesoreria.cuentas': {}, 'maestros.anexos': {}, 'tecnologia.dashboard': {}, 'tecnologia.mantenimiento': {}, 'tecnologia.ambientes': {}, 'rrhh.trabajadores': {} }),
    );
    await desplegarTodos();
    expect(enlaces().map((e) => e.href)).toEqual(['/incidencias', '/tesoreria/pagos', '/tesoreria/cuentas', '/anexos', '/equipos-tecnologicos', '/equipos-mantenimiento', '/maestros-generales/locales', '/rrhh/trabajadores']);
    expect(textos('.menu-category')).toEqual(['Operaciones', 'Módulos del Sistema', 'Inv. Tecnología', 'RR.HH.']);
    expect(textos('.sidebar-item.has-sub > span')).toEqual(['Tesorería', 'Maestros Generales', 'Activo Fijo']);
  });

  it('Administración se muestra a cualquier rol con ver (la decide la matriz, no el rol)', async () => {
    const { enlaces, desplegarTodos } = await setup('Gerente', misPermisos('Gerente', { 'admin.usuarios': {}, 'admin.empresas': {}, operaciones: {} }));
    await desplegarTodos();
    expect(enlaces().map((e) => e.href)).toEqual(['/operaciones', '/admin/empresas', '/admin/usuarios']);
  });

  it('sin ver en Administración no ve esa sección', async () => {
    const { enlaces, textos } = await setup('Gerente', misPermisos('Gerente', { operaciones: {} }));
    expect(enlaces().map((e) => e.href)).toEqual(['/operaciones']);
    expect(textos('.menu-category')).toEqual(['Navegación']);
  });

  it('el logo/marca lleva al inicio (/), el menú de módulos principal', async () => {
    const { el, fixture } = await setup('Usuario', misPermisos('Usuario', {}));
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const marca = el.querySelector<HTMLElement>('.sidebar-header');
    expect(marca).not.toBeNull();
    marca?.click();
    await fixture.whenStable();
    expect(navegar).toHaveBeenCalledTimes(1);
    const destino = navegar.mock.calls[0][0];
    expect(typeof destino === 'string' ? destino : router.serializeUrl(destino)).toBe('/');
  });

  it('mientras no hay permisos cargados no muestra enlaces', async () => {
    const { enlaces } = await setup('Usuario', null);
    expect(enlaces()).toEqual([]);
  });

  it('los submenús inician cerrados y se pliegan y despliegan con clic y teclado', async () => {
    const { el, fixture, enlaces } = await setup('Usuario', misPermisos('Usuario', { 'almacen.stock': {}, 'almacen.kardex': {} }));
    const cabecera = el.querySelector<HTMLElement>('.sidebar-item.has-sub');
    expect(cabecera?.getAttribute('aria-expanded')).toBe('false');
    expect(enlaces()).toEqual([]);

    cabecera?.click();
    await fixture.whenStable();
    expect(enlaces().map((e) => e.href)).toEqual(['/almacen/stock', '/almacen/kardex']);
    expect(cabecera?.getAttribute('aria-expanded')).toBe('true');

    cabecera?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    expect(enlaces()).toEqual([]);
    expect(cabecera?.getAttribute('aria-expanded')).toBe('false');
  });

  it('el grupo «Proyectos» reúne Centros de Costos, Presupuestos, Plantillas y Catálogos, en ese orden', async () => {
    const { enlaces, textos, desplegarTodos } = await setup(
      'Promotor',
      misPermisos('Promotor', { 'centros-costos': {}, presupuestos: {}, 'presupuestos.plantillas': {}, 'proyectos.catalogos': {} }),
    );
    await desplegarTodos();

    expect(textos('.sidebar-item.has-sub > span')).toEqual(['Proyectos']);
    expect(enlaces().map((e) => e.href)).toEqual(['/centros-costos', '/presupuestos', '/presupuestos/plantillas', '/proyectos/catalogos']);
  });
});

describe('MENU_LATERAL (GRP T70)', () => {
  it('Maestros Generales ya no incluye Centros de Costos, Presupuestos ni Plantillas', () => {
    const maestros = MENU_LATERAL.flatMap((s) => s.entradas).find((e) => e.tipo === 'submenu' && e.submenu.id === 'maestros');
    const rutas = maestros?.tipo === 'submenu' ? maestros.submenu.enlaces.map((x) => x.ruta) : [];

    expect(rutas.length).toBeGreaterThan(0);
    for (const r of ['/centros-costos', '/presupuestos', '/presupuestos/plantillas']) expect(rutas).not.toContain(r);
  });

  it('el menú ya no tiene el Dashboard Situacional ni usa el módulo dashboard', () => {
    expect(TODAS).not.toContain('/dashboard-situacional');
    const modulos = MENU_LATERAL.flatMap((s) => s.entradas.flatMap((e) => (e.tipo === 'enlace' ? [e.enlace.modulo] : e.submenu.enlaces.map((x) => x.modulo))));
    expect(modulos).not.toContain('dashboard');
  });

  it('el Dashboard de Operaciones está en Navegación', () => {
    const navegacion = MENU_LATERAL.find((s) => s.categoria === 'Navegación');
    expect(navegacion?.entradas.some((e) => e.tipo === 'enlace' && e.enlace.ruta === '/operaciones')).toBe(true);
  });
});

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
  return { fixture, el, enlaces, textos };
}

describe('SidebarComponent', () => {
  beforeEach(() => storage.clear());
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    storage.clear();
  });

  it('Administrador ve todos los enlaces, en el mismo orden, con sus clases e iconos', async () => {
    const { enlaces, textos } = await setup('Administrador', misPermisos('Administrador', {}, true));
    const lista = enlaces();
    expect(lista.map((e) => e.href)).toEqual(TODAS);
    expect(lista).toHaveLength(32);
    expect(textos('.menu-category')).toEqual(['Navegación', 'Operaciones', 'Módulos del Sistema', 'Administración']);
    expect(textos('.sidebar-item.has-sub > span')).toEqual(['Documentos', 'Tesorería', 'Control de Almacén', 'Maestros Generales']);
    expect(lista[0]).toEqual({
      href: '/dashboard-situacional',
      texto: 'Dashboard Situacional',
      clase: expect.stringContaining('sidebar-item'),
      icono: 'fa-chart-line fa-solid',
    });
    expect(lista.find((e) => e.href === '/anexos')?.clase).toContain('sidebar-subitem');

    // "Roles y permisos" va justo debajo de "Usuarios", con el mismo estilo.
    const i = lista.findIndex((e) => e.href === '/admin/usuarios');
    expect(lista[i].texto).toBe('Usuarios');
    expect(lista[i + 1]).toMatchObject({ href: '/admin/roles', texto: 'Roles y permisos' });
    expect(lista[i + 1].clase).toContain('sidebar-item');
  });

  it('un usuario con permisos parciales ve solo sus enlaces y grupos', async () => {
    const { enlaces, textos } = await setup(
      'Jefe de Área',
      misPermisos('Jefe de Área', { incidencias: {}, 'tesoreria.pagos': {}, 'tesoreria.cuentas': {}, 'maestros.anexos': {} }),
    );
    expect(enlaces().map((e) => e.href)).toEqual(['/incidencias', '/tesoreria/pagos', '/tesoreria/cuentas', '/anexos']);
    expect(textos('.menu-category')).toEqual(['Operaciones', 'Módulos del Sistema']);
    expect(textos('.sidebar-item.has-sub > span')).toEqual(['Tesorería', 'Maestros Generales']);
  });

  it('Administración se muestra a cualquier rol con ver (la decide la matriz, no el rol)', async () => {
    const { enlaces } = await setup('Gerente', misPermisos('Gerente', { 'admin.usuarios': {}, 'admin.empresas': {}, dashboard: {} }));
    expect(enlaces().map((e) => e.href)).toEqual(['/dashboard-situacional', '/admin/empresas', '/admin/usuarios']);
  });

  it('sin ver en Administración no ve esa sección', async () => {
    const { enlaces, textos } = await setup('Gerente', misPermisos('Gerente', { dashboard: {} }));
    expect(enlaces().map((e) => e.href)).toEqual(['/dashboard-situacional']);
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

  it('los submenús se pliegan y despliegan con clic y teclado', async () => {
    const { el, fixture, enlaces } = await setup('Usuario', misPermisos('Usuario', { 'almacen.stock': {}, 'almacen.kardex': {} }));
    const cabecera = el.querySelector<HTMLElement>('.sidebar-item.has-sub');
    expect(cabecera?.getAttribute('aria-expanded')).toBe('true');
    cabecera?.click();
    await fixture.whenStable();
    expect(enlaces()).toEqual([]);
    expect(cabecera?.getAttribute('aria-expanded')).toBe('false');
    cabecera?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    expect(enlaces().map((e) => e.href)).toEqual(['/almacen/stock', '/almacen/kardex']);
  });
});

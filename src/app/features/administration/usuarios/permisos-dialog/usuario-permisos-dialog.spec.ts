import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { throwError } from 'rxjs';
import { environment } from '@env';
import { misPermisos } from '@app/core/auth/auth.testing';
import { MisPermisos, Permisos } from '@app/core/auth/permisos.models';
import { CuerpoRespuesta, montarPantalla } from '@app/core/auth/pantalla.testing';
import { PermisoUsuarioModulo, PermisosUsuario, Usuario } from '../interfaces';
import { UsuariosService } from '../usuarios.service';
import { UsuarioPermisosDialogComponent } from './usuario-permisos-dialog';

const API = `${environment.apiUrl}/administration/usuarios/USR001/permisos`;
const USUARIO: Usuario = { IdUsuario: 'USR001', Nombres: 'Ana Pérez', Usuario: 'aperez', Rol: 'Promotor', activo: true };

const NADA: Permisos = { ver: false, crear: false, editar: false, eliminar: false, aprobar: false, anular: false };
const BASICO: Permisos = { ...NADA, ver: true, crear: true, editar: true };
const SOLO_VER: Permisos = { ...NADA, ver: true };

const modulo = (clave: string, over: Partial<PermisoUsuarioModulo> = {}): PermisoUsuarioModulo => ({
  id: 1,
  clave,
  nombre: `Módulo ${clave}`,
  grupo: 'Grupo A',
  admite_aprobar: false,
  admite_anular: false,
  area: 'sin_restriccion',
  rol: BASICO,
  tras_area: BASICO,
  excepcion: null,
  efectivo: BASICO,
  origen: 'rol',
  ...over,
});

const datos = (over: Partial<PermisosUsuario> = {}, modulos: PermisoUsuarioModulo[] = []): PermisosUsuario => ({
  id_usuario: 'USR001',
  nombres: 'Ana Pérez',
  usuario: 'aperez',
  rol: 'Promotor',
  area: { id: 7, codigo: 'ALMACEN', nombre: 'Almacén' },
  area_configurada: true,
  es_administrador: false,
  personalizado: false,
  modulos,
  ...over,
});

const ADMIN = misPermisos('Administrador', {}, true);
const SOLO_LECTURA = misPermisos('Usuario', { 'admin.usuarios': {} });

async function montar(respuesta: PermisosUsuario, permisos: MisPermisos = ADMIN) {
  const responder = (req: HttpRequest<unknown>): CuerpoRespuesta => (req.url === API ? respuesta : null);
  const p = await montarPantalla(UsuarioPermisosDialogComponent, permisos, responder, [], { usuario: USUARIO });
  const q = <T extends Element>(sel: string) => p.el.querySelector<T>(sel);
  /** Marca o desmarca una casilla y notifica el cambio. */
  const marcar = async (sel: string, valor: boolean) => {
    const caja = q<HTMLInputElement>(sel);
    if (!caja) throw new Error(`no existe ${sel}`);
    caja.checked = valor;
    caja.dispatchEvent(new Event('change'));
    await p.render();
  };
  const clic = async (sel: string) => {
    const boton = q<HTMLButtonElement>(sel);
    if (!boton) throw new Error(`no existe ${sel}`);
    boton.click();
    await p.render();
  };
  return { ...p, q, marcar, clic };
}

describe('UsuarioPermisosDialogComponent (plan 08)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('muestra el rol, el área y, por módulo, lo que da el rol, el área, lo efectivo y su origen', async () => {
    const { el, q } = await montar(
      datos({}, [
        modulo('requerimientos'),
        modulo('tesoreria.pagos', { id: 2, area: 'no', tras_area: NADA, efectivo: NADA, origen: 'area' }),
        modulo('almacen.consulta', { id: 3, area: 'solo_ver', tras_area: SOLO_VER, efectivo: SOLO_VER, origen: 'area' }),
      ]),
    );
    expect(el.textContent).toContain('Promotor');
    expect(el.textContent).toContain('Almacén');
    const fila = (clave: string) => q<HTMLTableRowElement>(`[data-testid="permiso-${clave}"]`)?.textContent ?? '';
    expect(fila('requerimientos')).toContain('Ver, Crear, Editar');
    expect(fila('tesoreria.pagos')).toContain('No lo tiene');
    expect(fila('tesoreria.pagos')).toContain('Sin acceso');
    expect(fila('tesoreria.pagos')).toContain('Recortado por el área');
    expect(fila('almacen.consulta')).toContain('Solo ver');
  });

  it('avisa si el área no está configurada y si el usuario ya tiene permisos personalizados', async () => {
    const { el } = await montar(datos({ area_configurada: false, personalizado: true }, [modulo('requerimientos')]));
    expect(el.textContent).toContain('Área sin configurar');
    expect(el.querySelector('[data-testid="permisos-personalizado"]')).not.toBeNull();
  });

  it('el Administrador puede personalizar un módulo: parte de lo que la persona puede hoy y Guardar envía solo las excepciones', async () => {
    const { http, q, marcar, clic, render } = await montar(datos({}, [modulo('requerimientos'), modulo('tesoreria.pagos', { id: 2 })]));
    expect(q<HTMLButtonElement>('[data-testid="permisos-guardar"]')?.disabled).toBe(true); // nada que guardar

    await marcar('[data-testid="excepcion-requerimientos"]', true);
    expect(q<HTMLInputElement>('[data-testid="accion-requerimientos-crear"]')?.checked).toBe(true); // parte de lo efectivo
    expect(q<HTMLInputElement>('[data-testid="accion-requerimientos-eliminar"]')?.checked).toBe(false);
    await marcar('[data-testid="accion-requerimientos-eliminar"]', true);
    expect(q<HTMLButtonElement>('[data-testid="permisos-guardar"]')?.disabled).toBe(false);

    await clic('[data-testid="permisos-guardar"]');
    const put = http.expectOne((r) => r.method === 'PUT' && r.url === API);
    expect(put.request.body).toEqual({ excepciones: [{ clave: 'requerimientos', ...BASICO, eliminar: true }] });
    put.flush(
      datos({ personalizado: true }, [
        modulo('requerimientos', { excepcion: { ...BASICO, eliminar: true }, efectivo: { ...BASICO, eliminar: true }, origen: 'excepcion' }),
        modulo('tesoreria.pagos', { id: 2 }),
      ]),
    );
    await render();
    expect(q('[data-testid="permisos-aviso"]')?.textContent).toContain('guardados');
    expect(q<HTMLButtonElement>('[data-testid="permisos-guardar"]')?.disabled).toBe(true);
    expect(q('[data-testid="permiso-requerimientos"]')?.textContent).toContain('Excepción');
  });

  it('quitar Ver desmarca el resto y marcar otra acción exige Ver', async () => {
    const { q, marcar } = await montar(datos({}, [modulo('requerimientos')]));
    await marcar('[data-testid="excepcion-requerimientos"]', true);
    await marcar('[data-testid="accion-requerimientos-ver"]', false);
    for (const accion of ['crear', 'editar', 'eliminar']) {
      expect(q<HTMLInputElement>(`[data-testid="accion-requerimientos-${accion}"]`)?.checked).toBe(false);
    }
    await marcar('[data-testid="accion-requerimientos-editar"]', true);
    expect(q<HTMLInputElement>('[data-testid="accion-requerimientos-ver"]')?.checked).toBe(true);
  });

  it('aprobar y anular solo aparecen donde el módulo los admite', async () => {
    const { q, marcar } = await montar(
      datos({}, [modulo('documentos.administracion', { admite_aprobar: true, admite_anular: true }), modulo('requerimientos', { id: 2 })]),
    );
    await marcar('[data-testid="excepcion-documentos.administracion"]', true);
    await marcar('[data-testid="excepcion-requerimientos"]', true);
    expect(q('[data-testid="accion-documentos.administracion-aprobar"]')).not.toBeNull();
    expect(q('[data-testid="accion-documentos.administracion-anular"]')).not.toBeNull();
    expect(q('[data-testid="accion-requerimientos-aprobar"]')).toBeNull();
    expect(q('[data-testid="accion-requerimientos-anular"]')).toBeNull();
  });

  it('los módulos de Administración no se pueden personalizar (solo por rol)', async () => {
    const { q } = await montar(datos({}, [modulo('admin.usuarios'), modulo('requerimientos', { id: 2 })]));
    expect(q('[data-testid="excepcion-admin.usuarios"]')).toBeNull();
    expect(q('[data-testid="permiso-admin.usuarios"]')?.textContent).toContain('Solo por rol');
    expect(q('[data-testid="excepcion-requerimientos"]')).not.toBeNull();
  });

  it('una excepción que quita todo el acceso se guarda con todo en false', async () => {
    const { http, q, marcar, clic } = await montar(datos({}, [modulo('requerimientos')]));
    await marcar('[data-testid="excepcion-requerimientos"]', true);
    await marcar('[data-testid="accion-requerimientos-ver"]', false);
    await clic('[data-testid="permisos-guardar"]');
    const put = http.expectOne((r) => r.method === 'PUT' && r.url === API);
    expect(put.request.body).toEqual({ excepciones: [{ clave: 'requerimientos', ...NADA }] });
    put.flush(datos({}, [modulo('requerimientos')]));
    expect(q('[data-testid="permisos-dialog"]')).not.toBeNull();
  });

  it('con excepciones guardadas se pueden quitar todas (Restablecer)', async () => {
    const { http, q, clic, render } = await montar(
      datos({ personalizado: true }, [modulo('requerimientos', { excepcion: SOLO_VER, efectivo: SOLO_VER, origen: 'excepcion' })]),
    );
    expect(q<HTMLInputElement>('[data-testid="excepcion-requerimientos"]')?.checked).toBe(true);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await clic('[data-testid="permisos-restablecer"]');
    http.expectOne((r) => r.method === 'DELETE' && r.url === API).flush(datos({}, [modulo('requerimientos')]));
    await render();
    expect(q('[data-testid="permisos-aviso"]')?.textContent).toContain('restablecidos');
    expect(q('[data-testid="permisos-restablecer"]')).toBeNull();
  });

  it('un error al guardar se muestra y no borra lo editado', async () => {
    const { http, q, marcar, clic, render } = await montar(datos({}, [modulo('requerimientos')]));
    await marcar('[data-testid="excepcion-requerimientos"]', true);
    await clic('[data-testid="permisos-guardar"]');
    http.expectOne((r) => r.method === 'PUT').flush({ message: 'Solo el Administrador' }, { status: 403, statusText: 'Forbidden' });
    await render();
    expect(q('[data-testid="permisos-error"]')?.textContent).toContain('No se pudieron guardar');
    expect(q<HTMLInputElement>('[data-testid="excepcion-requerimientos"]')?.checked).toBe(true);
  });

  it('quien no es Administrador ve la tabla en solo lectura, sin guardar ni restablecer', async () => {
    const { q } = await montar(datos({ personalizado: true }, [modulo('requerimientos', { excepcion: SOLO_VER })]), SOLO_LECTURA);
    expect(q<HTMLInputElement>('[data-testid="excepcion-requerimientos"]')?.disabled).toBe(true);
    expect(q('[data-testid="permisos-guardar"]')).toBeNull();
    expect(q('[data-testid="permisos-restablecer"]')).toBeNull();
  });

  it('un usuario Administrador no admite excepciones', async () => {
    const { q, el } = await montar(datos({ es_administrador: true }, [modulo('requerimientos')]));
    expect(q('[data-testid="excepcion-requerimientos"]')).toBeNull();
    expect(el.textContent).toContain('Es Administrador');
  });

  it('el buscador filtra los módulos por nombre o clave', async () => {
    const { q, p } = await montar(datos({}, [modulo('requerimientos'), modulo('tesoreria.pagos', { id: 2, grupo: 'Tesorería' })])).then(
      (x) => ({ ...x, p: x }),
    );
    const buscador = q<HTMLInputElement>('input[type="search"]');
    if (!buscador) throw new Error('falta el buscador');
    buscador.value = 'pagos';
    buscador.dispatchEvent(new Event('input'));
    await p.render();
    expect(q('[data-testid="permiso-tesoreria.pagos"]')).not.toBeNull();
    expect(q('[data-testid="permiso-requerimientos"]')).toBeNull();
  });

  it('si no se pueden cargar los permisos lo dice y no muestra la tabla', async () => {
    const servicio = { getPermisos: () => throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Fallo del servidor' } })) };
    const p = await montarPantalla(UsuarioPermisosDialogComponent, ADMIN, () => null, [{ provide: UsuariosService, useValue: servicio }], {
      usuario: USUARIO,
    });
    expect(p.el.querySelector('[data-testid="permisos-error"]')?.textContent).toContain('No se pudieron cargar los permisos');
    expect(p.el.querySelector('[data-testid="permisos-tabla"]')).toBeNull();
  });
});

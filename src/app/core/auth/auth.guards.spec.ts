import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { SESION_STORAGE_KEY, Sesion } from './auth.models';
import { authGuard, invitadoGuard, rolGuard } from './auth.guards';
import { AuthService } from './auth.service';
import { MemoryStorage, provideSesionStorage } from './auth.testing';

const storage = new MemoryStorage();

function guardar(rol: string, expiraEnMs = 3600_000): void {
  const s: Sesion = {
    token: 'tok',
    expiraEn: new Date(Date.now() + expiraEnMs).toISOString(),
    usuario: { id: 'U1', usuario: 'u1', nombres: 'Uno', rol },
  };
  storage.setItem(SESION_STORAGE_KEY, JSON.stringify(s));
}

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideSesionStorage(storage)],
  });
  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);
  return { router, auth: TestBed.inject(AuthService) };
}

function route(queryParams: Record<string, string> = {}): ActivatedRouteSnapshot {
  return { queryParamMap: convertToParamMap(queryParams) } as ActivatedRouteSnapshot;
}

const state = (url: string) => ({ url }) as RouterStateSnapshot;

function ejecutar<T>(fn: () => T): T {
  return TestBed.runInInjectionContext(fn);
}

function url(router: Router, resultado: unknown): string {
  expect(resultado).toBeInstanceOf(UrlTree);
  return router.serializeUrl(resultado as UrlTree);
}

describe('auth guards', () => {
  beforeEach(() => storage.clear());
  afterEach(() => storage.clear());

  describe('authGuard', () => {
    it('deja pasar con sesión vigente', () => {
      guardar('Usuario');
      setup();
      expect(ejecutar(() => authGuard(route(), state('/centros-costos')))).toBe(true);
    });

    it('sin sesión redirige a /login con returnUrl', () => {
      const { router } = setup();
      const r = ejecutar(() => authGuard(route(), state('/centros-costos/5/datos?tab=1')));
      expect(url(router, r)).toBe('/login?returnUrl=%2Fcentros-costos%2F5%2Fdatos%3Ftab%3D1');
    });

    it('sin sesión en la raíz redirige a /login sin returnUrl', () => {
      const { router } = setup();
      expect(url(router, ejecutar(() => authGuard(route(), state('/'))))).toBe('/login');
    });

    it('como guard de hijos protege igual', () => {
      const { router } = setup();
      const r = ejecutar(() => authGuard(route(), state('/imprimir/fur/3')));
      expect(url(router, r)).toBe('/login?returnUrl=%2Fimprimir%2Ffur%2F3');
    });

    it('si la sesión venció la borra y añade motivo=expirada', () => {
      guardar('Usuario', 1000);
      const { router, auth } = setup();
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        vi.setSystemTime(Date.now() + 5000);
        const r = ejecutar(() => authGuard(route(), state('/presupuestos')));
        expect(url(router, r)).toBe('/login?returnUrl=%2Fpresupuestos&motivo=expirada');
        expect(auth.autenticado()).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('authGuard al abrir la app con una sesión guardada ya vencida', () => {
    it('añade motivo=expirada la primera vez y no las siguientes', () => {
      guardar('Usuario', -1000);
      const { router } = setup();

      const primera = ejecutar(() => authGuard(route(), state('/presupuestos')));
      expect(url(router, primera)).toBe('/login?returnUrl=%2Fpresupuestos&motivo=expirada');

      const segunda = ejecutar(() => authGuard(route(), state('/presupuestos')));
      expect(url(router, segunda)).toBe('/login?returnUrl=%2Fpresupuestos');
    });
  });

  describe('invitadoGuard', () => {
    it('sin sesión muestra el login', () => {
      setup();
      expect(ejecutar(() => invitadoGuard(route(), state('/login')))).toBe(true);
    });

    it('con sesión redirige a / o al returnUrl interno', () => {
      guardar('Usuario');
      const { router } = setup();
      expect(url(router, ejecutar(() => invitadoGuard(route(), state('/login'))))).toBe('/');
      expect(url(router, ejecutar(() => invitadoGuard(route({ returnUrl: '/presupuestos' }), state('/login'))))).toBe(
        '/presupuestos',
      );
    });

    it.each(['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)'])(
      'con sesión ignora el returnUrl malicioso %s',
      (malicioso) => {
        guardar('Usuario');
        const { router } = setup();
        const r = ejecutar(() => invitadoGuard(route({ returnUrl: malicioso }), state('/login')));
        expect(url(router, r)).toBe('/');
      },
    );
  });

  describe('rolGuard', () => {
    it('deja pasar al rol requerido', () => {
      guardar('Administrador');
      setup();
      expect(ejecutar(() => rolGuard('Administrador')(route(), state('/admin/usuarios')))).toBe(true);
    });

    it('acepta cualquiera de varios roles', () => {
      guardar('Supervisor');
      setup();
      expect(ejecutar(() => rolGuard('Administrador', 'Supervisor')(route(), state('/x')))).toBe(true);
    });

    it('sin el rol redirige a /', () => {
      guardar('Promotor');
      const { router } = setup();
      const r = ejecutar(() => rolGuard('Administrador')(route(), state('/admin/usuarios')));
      expect(url(router, r)).toBe('/');
    });

    it('sin sesión redirige a /', () => {
      const { router } = setup();
      expect(url(router, ejecutar(() => rolGuard('Administrador')(route(), state('/admin/empresas'))))).toBe('/');
    });
  });
});

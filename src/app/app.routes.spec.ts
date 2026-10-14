import { Route } from '@angular/router';
import { routes } from './app.routes';
import { authGuard, invitadoGuard } from './core/auth/auth.guards';
import { LoginComponent } from './features/auth/login/login';

describe('app.routes', () => {
  const login = routes.find((r) => r.path === 'login');
  const protegida = routes.find((r) => r.path === '' && r.children);
  const hijos: Route[] = protegida?.children ?? [];

  it('expone /login solo para invitados', () => {
    expect(login?.component).toBe(LoginComponent);
    expect(login?.canActivate).toEqual([invitadoGuard]);
  });

  it('protege todas las demás rutas (incluidas /imprimir) con authGuard', () => {
    expect(protegida?.canActivateChild).toEqual([authGuard]);
    const sueltas = routes.filter((r) => r !== login && r !== protegida && r.path !== '**');
    expect(sueltas).toEqual([]);
    expect(hijos.some((r) => r.path?.startsWith('imprimir/'))).toBe(true);
    expect(routes.at(-1)?.path).toBe('**');
  });

  it('admin/usuarios, admin/roles y admin/empresas requieren un guard de rol', () => {
    for (const path of ['admin/usuarios', 'admin/roles', 'admin/empresas']) {
      expect(hijos.find((r) => r.path === path)?.canActivate?.length).toBe(1);
    }
  });
});

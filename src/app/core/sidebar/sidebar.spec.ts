import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { SidebarComponent } from './sidebar';

async function setup(esAdministrador: boolean) {
  TestBed.configureTestingModule({
    imports: [SidebarComponent],
    providers: [provideRouter([]), { provide: AuthService, useValue: { esAdministrador: signal(esAdministrador) } }],
  });
  const fixture = TestBed.createComponent(SidebarComponent);
  await fixture.whenStable();
  const el: HTMLElement = fixture.nativeElement;
  const enlaces = Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href]')).map((a) => ({
    href: a.getAttribute('href'),
    texto: a.textContent?.trim(),
    clase: a.className,
  }));
  return { enlaces };
}

describe('SidebarComponent', () => {
  it('Administrador: "Roles" va justo debajo de "Usuarios", con el mismo estilo', async () => {
    const { enlaces } = await setup(true);
    const i = enlaces.findIndex((e) => e.href === '/admin/usuarios');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(enlaces[i].texto).toBe('Usuarios');
    expect(enlaces[i + 1]).toMatchObject({ href: '/admin/roles', texto: 'Roles' });
    expect(enlaces[i + 1].clase).toContain('sidebar-item');
    expect(enlaces[i].clase).toContain('sidebar-item');
  });

  it('otros roles no ven Usuarios ni Roles', async () => {
    const { enlaces } = await setup(false);
    expect(enlaces.some((e) => e.href === '/admin/usuarios' || e.href === '/admin/roles')).toBe(false);
  });
});

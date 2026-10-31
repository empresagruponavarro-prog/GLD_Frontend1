import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet, RouterModule } from '@angular/router';
import { SidebarComponent } from './core/sidebar/sidebar';
import { AuthService } from './core/auth/auth.service';
import { AvisosService } from './core/avisos/avisos.service';
import { PermisosService } from './core/auth/permisos.service';

/** Rutas que se muestran sin cabecera ni menú lateral (impresión/PDF y login). */
const RUTAS_SIN_LAYOUT = ['/imprimir', '/login', '/operaciones/tv'];

function empiezaPor(url: string, r: string): boolean {
  return url === r || url.startsWith(`${r}/`) || url.startsWith(`${r}?`);
}

function esRutaSinLayout(url: string): boolean {
  return RUTAS_SIN_LAYOUT.some((r) => empiezaPor(url, r));
}

/* Componente Principal de la Aplicación con Menú Hamburguesa Integrado */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterModule, SidebarComponent],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeUserMenu(true)',
  },
})
export class AppComponent {
  readonly #auth = inject(AuthService);
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly #avisos = inject(AvisosService);

  title = 'Sistema GLD';
  /** Las vistas /imprimir/* y /login se muestran sin cabecera ni menú lateral. */
  readonly isBareView = signal(false);
  /** Controla si el menú lateral está visible u oculto. */
  readonly isSidebarCollapsed = signal(false);
  readonly isUserMenuOpen = signal(false);
  /** En /login no se muestra el aviso global (la pantalla tiene sus propios mensajes). */
  readonly #isLogin = signal(false);
  /** Aviso global (acceso denegado, falta de permiso): fijo arriba a la derecha, con cierre automático. */
  readonly aviso = computed(() => (this.#isLogin() ? null : this.#avisos.aviso()));

  readonly usuario = this.#auth.usuario;
  readonly nombreUsuario = computed(() => {
    const u = this.usuario();
    return u ? (u.nombres?.trim() || u.usuario) : '';
  });

  private readonly userMenuButton = viewChild<ElementRef<HTMLButtonElement>>('userMenuButton');

  constructor() {
    // Permisos de la sesión: se cargan al arrancar con sesión guardada (o al adoptar la de otra
    // pestaña) y se vacían al cerrar sesión. El login y el permisoGuard esperan la misma carga.
    const permisos = inject(PermisosService);
    effect(() => {
      const conSesion = this.usuario() !== null;
      untracked(() => {
        if (conSesion) void permisos.listo();
        else permisos.vaciar();
      });
    });

    const router = inject(Router);
    this.isBareView.set(esRutaSinLayout(router.url));
    this.#isLogin.set(empiezaPor(router.url, '/login'));
    router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.isBareView.set(esRutaSinLayout(e.urlAfterRedirects));
        this.#isLogin.set(empiezaPor(e.urlAfterRedirects, '/login'));
        this.isUserMenuOpen.set(false);
      }
    });
  }

  /* Alterna la visibilidad del menú lateral (Menú Hamburguesa) */
  toggleSidebar(): void {
    this.isSidebarCollapsed.update((v) => !v);
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen.update((v) => !v);
  }

  closeUserMenu(devolverFoco = false): void {
    if (!this.isUserMenuOpen()) return;
    this.isUserMenuOpen.set(false);
    if (devolverFoco) this.userMenuButton()?.nativeElement.focus();
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.isUserMenuOpen()) return;
    const menu = this.#host.nativeElement.querySelector('.app-user-menu');
    if (menu && event.target instanceof Node && !menu.contains(event.target)) this.closeUserMenu();
  }

  cerrarAviso(): void {
    this.#avisos.cerrar();
  }

  logout(): void {
    this.isUserMenuOpen.set(false);
    this.#auth.logout({ redirigir: true, motivo: 'manual' });
  }
}

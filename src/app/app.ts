import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet, RouterModule } from '@angular/router';
import { SidebarComponent } from './core/sidebar/sidebar';
import { AuthService } from './core/auth/auth.service';

/** Rutas que se muestran sin cabecera ni menú lateral (impresión/PDF y login). */
const RUTAS_SIN_LAYOUT = ['/imprimir', '/login'];

function esRutaSinLayout(url: string): boolean {
  return RUTAS_SIN_LAYOUT.some((r) => url === r || url.startsWith(`${r}/`) || url.startsWith(`${r}?`));
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

  title = 'Sistema GLD';
  /** Las vistas /imprimir/* y /login se muestran sin cabecera ni menú lateral. */
  readonly isBareView = signal(false);
  /** Controla si el menú lateral está visible u oculto. */
  readonly isSidebarCollapsed = signal(false);
  readonly isUserMenuOpen = signal(false);

  readonly usuario = this.#auth.usuario;
  readonly nombreUsuario = computed(() => {
    const u = this.usuario();
    return u ? (u.nombres?.trim() || u.usuario) : '';
  });

  private readonly userMenuButton = viewChild<ElementRef<HTMLButtonElement>>('userMenuButton');

  constructor() {
    const router = inject(Router);
    this.isBareView.set(esRutaSinLayout(router.url));
    router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.isBareView.set(esRutaSinLayout(e.urlAfterRedirects));
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

  logout(): void {
    this.isUserMenuOpen.set(false);
    this.#auth.logout({ redirigir: true, motivo: 'manual' });
  }
}

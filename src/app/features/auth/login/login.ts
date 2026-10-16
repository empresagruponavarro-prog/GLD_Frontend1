import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@app/core/auth/auth.service';
import { MSG_USUARIO_INACTIVO, returnUrlSeguro } from '@app/core/auth/auth.models';
import { esUsuarioInactivo } from '@app/core/auth/auth.interceptor';
import { moduloDeUrl } from '@app/core/auth/permiso.guard';
import { PermisosService } from '@app/core/auth/permisos.service';
import { mensajeDelBackend } from '@shared/utils/errores-http';

const MSG_CREDENCIALES = 'Usuario o contraseña incorrectos';
const MSG_DEMASIADOS = 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.';
const MSG_RED = 'No se pudo conectar con el servidor';
const MSG_GENERICO = 'No se pudo iniciar sesión. Inténtalo de nuevo.';

interface LoginForm {
  usuario: FormControl<string>;
  clave: FormControl<string>;
}

/** Mensaje para el usuario según la respuesta del backend a `POST /auth/login`. */
export function mensajeErrorLogin(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return MSG_GENERICO;
  if (esUsuarioInactivo(error)) return MSG_USUARIO_INACTIVO;
  const delBackend = mensajeDelBackend(error);
  switch (error.status) {
    case 0:
      return MSG_RED;
    case 401:
      return delBackend ?? MSG_CREDENCIALES;
    case 429:
      return delBackend ?? MSG_DEMASIADOS;
    default:
      return MSG_GENERICO;
  }
}

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #permisos = inject(PermisosService);

  protected readonly anio = new Date().getFullYear();

  protected readonly form = new FormGroup<LoginForm>({
    usuario: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    clave: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly isLoading = signal(false);
  protected readonly isClaveVisible = signal(false);
  protected readonly isSubmitted = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isSesionExpirada =
    this.#route.snapshot.queryParamMap.get('motivo') === 'expirada';
  /** El interceptor cerró la sesión porque el usuario fue desactivado (`?motivo=inactivo`). */
  protected readonly isUsuarioInactivo =
    this.#route.snapshot.queryParamMap.get('motivo') === 'inactivo';
  protected readonly mensajeInactivo = MSG_USUARIO_INACTIVO;

  private readonly usuarioInput = viewChild.required<ElementRef<HTMLInputElement>>('usuarioInput');
  private readonly claveInput = viewChild.required<ElementRef<HTMLInputElement>>('claveInput');

  constructor() {
    afterNextRender(() => this.usuarioInput().nativeElement.focus());
  }

  /**
   * Tras el login espera los permisos y va al `returnUrl` validado; si esa pantalla exige un
   * módulo que el usuario no puede ver, va al inicio (sin pasar por la redirección del guard).
   */
  async #irAlDestino(): Promise<void> {
    let destino = returnUrlSeguro(this.#route.snapshot.queryParamMap.get('returnUrl'));
    await this.#permisos.listo();
    this.isLoading.set(false);
    const modulo = moduloDeUrl(this.#router.config, destino);
    if (modulo && !this.#permisos.puedeVer(modulo)) destino = '/';
    void this.#router.navigateByUrl(destino, { replaceUrl: true });
  }

  protected toggleClave(): void {
    this.isClaveVisible.update((v) => !v);
  }

  protected campoInvalido(campo: keyof LoginForm): boolean {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || this.isSubmitted());
  }

  protected onSubmit(): void {
    if (this.isLoading()) return;
    this.isSubmitted.set(true);
    this.errorMessage.set(null);

    const usuario = this.form.controls.usuario.value.trim();
    if (!usuario) this.form.controls.usuario.setValue('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      (this.form.controls.usuario.invalid ? this.usuarioInput() : this.claveInput()).nativeElement.focus();
      return;
    }

    this.isLoading.set(true);
    this.#auth.login(usuario, this.form.controls.clave.value).subscribe({
      next: () => {
        void this.#irAlDestino();
      },
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.errorMessage.set(mensajeErrorLogin(error));
        this.form.controls.clave.reset();
        this.isSubmitted.set(false);
        this.claveInput().nativeElement.focus();
      },
    });
  }
}

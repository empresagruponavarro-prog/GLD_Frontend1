import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import { mensajeError } from '@shared/utils/errores-http';
import { valorDeEvento } from '@shared/utils/eventos';
import { AreaMatriz, MatrizAreas, ModuloMatrizArea, NivelCelda, NivelGuardable } from '../interfaces';
import { PermisosAdminService } from '../permisos-admin.service';
import { PestanasPermisosComponent } from '../pestanas-permisos/pestanas-permisos';
import { PantallaConCambiosPendientes } from '../roles.guard';

/** Niveles de un módulo en un área por clave de módulo; sin entrada = el área no lo tiene. */
type MapaNiveles = ReadonlyMap<string, NivelGuardable>;

interface GrupoVista {
  nombre: string;
  modulos: ModuloMatrizArea[];
}

/** Orden en que cada clic cambia una celda: No → Solo ver → Completo → No. */
const SIGUIENTE: Readonly<Record<NivelCelda, NivelCelda>> = { no: 'solo_ver', solo_ver: 'completo', completo: 'no' };
const ETIQUETA: Readonly<Record<NivelCelda, string>> = { no: 'No', solo_ver: 'Solo ver', completo: 'Completo' };

function mapaDeArea(area: AreaMatriz): MapaNiveles {
  return new Map(area.modulos.map((m) => [m.clave, m.nivel]));
}

function mismosNiveles(a: MapaNiveles, b: MapaNiveles): boolean {
  if (a.size !== b.size) return false;
  for (const [clave, nivel] of a) if (b.get(clave) !== nivel) return false;
  return true;
}

/**
 * Módulos por área (`/admin/roles/areas`, plan 08): el Administrador marca, por cada área, qué módulos
 * tiene habilitados (No / Solo ver / Completo). El ROL de cada persona sigue dando lo que puede hacer
 * dentro de esos módulos. Un área sin módulos configurados no restringe a sus usuarios.
 */
@Component({
  selector: 'app-areas-modulos',
  imports: [PestanasPermisosComponent],
  templateUrl: './areas-modulos.html',
  styleUrl: './areas-modulos.css',
  // La matriz es larga: el scroll va dentro de .content-body (ver .page-scroll en styles.css).
  host: { class: 'page-scroll' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AreasModulosComponent implements PantallaConCambiosPendientes {
  readonly #api = inject(PermisosAdminService);
  /** Guardar requiere `editar` en Roles y permisos; sin él la matriz queda en solo lectura. */
  protected readonly permisos = permisosDePantalla('admin.roles');

  protected readonly matriz = signal<MatrizAreas | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  /** Id del área que se está guardando (solo una a la vez). */
  protected readonly guardando = signal<number | null>(null);
  /** Copia de trabajo de cada área (lo que se ve en pantalla, guardado o no). */
  readonly #edicion = signal<ReadonlyMap<number, MapaNiveles>>(new Map());

  /** Solo las áreas activas: las inactivas no se pueden asignar a usuarios. */
  protected readonly areas = computed(() => this.matriz()?.areas.filter((a) => a.estado) ?? []);

  /** Módulos agrupados como el menú, en el orden del catálogo. */
  protected readonly grupos = computed<GrupoVista[]>(() => {
    const grupos = new Map<string, ModuloMatrizArea[]>();
    for (const modulo of this.matriz()?.modulos ?? []) {
      const lista = grupos.get(modulo.grupo) ?? [];
      lista.push(modulo);
      grupos.set(modulo.grupo, lista);
    }
    return [...grupos].map(([nombre, modulos]) => ({ nombre, modulos }));
  });

  /** Nombres de los módulos configurables que ninguna área tiene (según lo guardado). */
  protected readonly sinArea = computed(() => {
    const m = this.matriz();
    if (!m) return [];
    const nombres = new Map(m.modulos.map((x) => [x.clave, x.nombre]));
    return m.sin_area.map((clave) => nombres.get(clave) ?? clave);
  });

  /** Áreas activas sin ningún módulo (sus usuarios hoy no tienen restricción). */
  protected readonly sinConfigurar = computed(() => this.areas().filter((a) => !a.configurada));

  protected readonly sucias = computed(() => this.areas().filter((a) => this.esSucia(a)));

  constructor() {
    this.cargar();
  }

  // ---- Salida de la ruta con cambios sin guardar (canDeactivate) ----

  tieneCambiosPendientes(): boolean {
    return this.sucias().length > 0;
  }

  confirmarSalida(): Promise<boolean> {
    return Promise.resolve(confirm('Hay cambios sin guardar en Módulos por área. ¿Salir y descartarlos?'));
  }

  // ---- Carga ----

  protected cargar(): void {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.error.set(null);
    this.#api.areasModulos().subscribe({
      next: (m) => {
        this.sincronizar(m, new Set());
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        this.error.set(`No se pudo cargar la matriz: ${mensajeError(err)}`);
      },
    });
  }

  /** Aplica la matriz del servidor y deja la copia de trabajo igual, salvo en las áreas de `conservar`. */
  private sincronizar(m: MatrizAreas, conservar: ReadonlySet<number>): void {
    const actual = this.#edicion();
    this.matriz.set(m);
    this.#edicion.set(
      new Map(m.areas.map((a): [number, MapaNiveles] => [a.id, conservar.has(a.id) ? (actual.get(a.id) ?? mapaDeArea(a)) : mapaDeArea(a)])),
    );
  }

  // ---- Lectura de la copia de trabajo ----

  protected nivel(idArea: number, clave: string): NivelCelda {
    return this.#edicion().get(idArea)?.get(clave) ?? 'no';
  }

  protected etiqueta(nivel: NivelCelda): string {
    return ETIQUETA[nivel];
  }

  protected esSucia(area: AreaMatriz): boolean {
    const trabajo = this.#edicion().get(area.id);
    return trabajo !== undefined && !mismosNiveles(trabajo, mapaDeArea(area));
  }

  protected cuantosModulos(idArea: number): number {
    return this.#edicion().get(idArea)?.size ?? 0;
  }

  // ---- Edición ----

  protected ciclar(area: AreaMatriz, modulo: ModuloMatrizArea): void {
    if (!this.permisos.editar() || this.guardando() !== null || !modulo.configurable) return;
    const siguiente = SIGUIENTE[this.nivel(area.id, modulo.clave)];
    const trabajo = new Map(this.#edicion().get(area.id));
    if (siguiente === 'no') trabajo.delete(modulo.clave);
    else trabajo.set(modulo.clave, siguiente);
    this.poner(area.id, trabajo);
  }

  /** Acciones rápidas de la columna: limpiar, todo solo ver / completo, o copiar otra área. */
  protected aplicarRapida(area: AreaMatriz, event: Event): void {
    const destino = event.target;
    const valor = valorDeEvento(event);
    if (destino instanceof HTMLSelectElement) destino.value = '';
    if (!this.permisos.editar() || this.guardando() !== null || valor === '') return;
    const m = this.matriz();
    if (!m) return;
    const configurables = m.modulos.filter((x) => x.configurable);
    if (valor === 'limpiar') {
      this.poner(area.id, new Map());
    } else if (valor === 'completo' || valor === 'solo_ver') {
      this.poner(area.id, new Map(configurables.map((x): [string, NivelGuardable] => [x.clave, valor])));
    } else if (valor.startsWith('copiar:')) {
      const origen = this.#edicion().get(Number(valor.slice('copiar:'.length)));
      if (origen) this.poner(area.id, new Map(origen));
    }
  }

  protected descartar(area: AreaMatriz): void {
    this.poner(area.id, new Map(mapaDeArea(area)));
  }

  private poner(idArea: number, trabajo: MapaNiveles): void {
    this.aviso.set(null);
    this.#edicion.update((todas) => new Map(todas).set(idArea, trabajo));
  }

  // ---- Guardado ----

  protected guardar(area: AreaMatriz): void {
    const m = this.matriz();
    const trabajo = this.#edicion().get(area.id);
    if (!m || !trabajo || !this.permisos.editar() || this.guardando() !== null) return;

    const guardado = mapaDeArea(area);
    const perdidos = [...guardado].filter(([clave, nivel]) => {
      const nuevo = trabajo.get(clave);
      return nuevo === undefined || (nivel === 'completo' && nuevo === 'solo_ver');
    }).length;
    if (area.usuarios > 0 && !this.confirmarImpacto(area, perdidos, trabajo.size)) return;

    const modulos = m.modulos.flatMap((x) => {
      const nivel = trabajo.get(x.clave);
      return nivel ? [{ clave: x.clave, nivel }] : [];
    });
    this.guardando.set(area.id);
    this.error.set(null);
    this.aviso.set(null);
    this.#api.guardarModulosArea(area.id, { modulos }).subscribe({
      next: (guardada) => {
        // Se refresca todo (cambia también "módulos sin área") sin perder lo que se editó en otras áreas.
        const otrasSucias = new Set(this.sucias().filter((a) => a.id !== area.id).map((a) => a.id));
        this.#api.areasModulos().subscribe({
          next: (nueva) => {
            this.sincronizar(nueva, otrasSucias);
            this.guardando.set(null);
            this.aviso.set(`Módulos del área «${guardada.nombre}» guardados.`);
          },
          error: (err: unknown) => {
            this.guardando.set(null);
            this.error.set(`Se guardó, pero no se pudo recargar la matriz: ${mensajeError(err)}`);
          },
        });
      },
      error: (err: unknown) => {
        this.guardando.set(null);
        this.error.set(`No se pudieron guardar los módulos de «${area.nombre}»: ${mensajeError(err)}`);
      },
    });
  }

  /** Avisa a quién afecta el cambio cuando el área ya tiene usuarios. */
  private confirmarImpacto(area: AreaMatriz, perdidos: number, totalNuevo: number): boolean {
    const usuarios = `${area.usuarios} usuario(s) activo(s)`;
    if (!area.configurada) {
      return confirm(
        `El área «${area.nombre}» tiene ${usuarios} y hoy no está restringida. Al guardar solo verán los ${totalNuevo} módulo(s) marcados. ¿Guardar?`,
      );
    }
    if (perdidos === 0) return true;
    return confirm(
      `El área «${area.nombre}» tiene ${usuarios}. Quitar o limitar ${perdidos} módulo(s) hará que dejen de verlos o de poder modificarlos. ¿Guardar?`,
    );
  }
}

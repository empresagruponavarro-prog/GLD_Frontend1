import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { permisosDePantalla } from '@app/core/auth/permisos-pantalla';
import { valorDeEvento } from '@shared/utils/eventos';
import { errorMessage } from '../../almacen/almacen.utils';
import { PeriodoFiscal, PlanoDeTipoPayload, TipoPlano, TipoProyecto } from './catalogos.models';
import { CatalogosProyectoService } from './catalogos.service';

export type PestanaCatalogo = 'tipos-proyecto' | 'tipos-plano' | 'periodos';
/** Cómo entra un plano en la lista de un tipo de proyecto. */
export type InclusionPlano = 'NO' | 'SI' | 'OBLIGATORIO';

/**
 * Catálogos de proyecto (GRP T76): tipos de proyecto con los planos que exige cada uno, tipos de plano y años fiscales.
 * Alta y activación exigen `crear`/`editar`; eliminar, `eliminar` del módulo `proyectos.catalogos`.
 */
@Component({
  selector: 'app-catalogos-proyecto',
  standalone: true,
  templateUrl: './catalogos.html',
  host: { class: 'page-scroll' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogosProyectoComponent {
  readonly #service = inject(CatalogosProyectoService);

  protected readonly permisos = permisosDePantalla('proyectos.catalogos');
  protected readonly valorDe = valorDeEvento;

  protected readonly pestana = signal<PestanaCatalogo>('tipos-proyecto');
  protected readonly tiposProyecto = signal<TipoProyecto[]>([]);
  protected readonly tiposPlano = signal<TipoPlano[]>([]);
  protected readonly periodos = signal<PeriodoFiscal[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal('');

  // Altas
  protected readonly nuevoTipoProyecto = signal('');
  protected readonly nuevoPlanoCodigo = signal('');
  protected readonly nuevoPlanoNombre = signal('');
  protected readonly nuevoPlanoDisciplina = signal('');
  protected readonly nuevoAnio = signal('');

  // Editor de la lista de planos de un tipo de proyecto
  protected readonly editando = signal<TipoProyecto | null>(null);
  protected readonly inclusion = signal<Readonly<Record<number, InclusionPlano>>>({});
  protected readonly guardandoPlanos = signal(false);
  protected readonly planosActivos = computed(() => this.tiposPlano().filter((p) => p.activo));

  constructor() {
    this.cargar();
  }

  protected cambiarPestana(p: PestanaCatalogo): void {
    this.pestana.set(p);
    this.error.set('');
  }

  private cargar(): void {
    this.cargando.set(true);
    let pendientes = 3;
    const listo = () => {
      pendientes -= 1;
      if (pendientes === 0) this.cargando.set(false);
    };
    const fallo = (err: unknown) => {
      this.error.set(errorMessage(err));
      listo();
    };
    this.#service.getTiposProyecto().subscribe({ next: (r) => { this.tiposProyecto.set(r); listo(); }, error: fallo });
    this.#service.getTiposPlano().subscribe({ next: (r) => { this.tiposPlano.set(r); listo(); }, error: fallo });
    this.#service.getPeriodos().subscribe({ next: (r) => { this.periodos.set(r); listo(); }, error: fallo });
  }

  /** Ejecuta una acción de escritura y recarga los catálogos; el error del servidor se muestra tal cual. */
  private escribir(accion: { subscribe: (o: { next: () => void; error: (e: unknown) => void }) => unknown }, despues?: () => void): void {
    this.error.set('');
    accion.subscribe({
      next: () => {
        despues?.();
        this.cargar();
      },
      error: (err: unknown) => this.error.set(errorMessage(err)),
    });
  }

  // ─── Tipos de proyecto ─────────────────────────────────────────────────────
  protected crearTipoProyecto(): void {
    const nombre = this.nuevoTipoProyecto().trim();
    if (!this.permisos.crear() || !nombre) return;
    this.escribir(this.#service.createTipoProyecto({ nombre }), () => this.nuevoTipoProyecto.set(''));
  }

  protected alternarTipoProyecto(t: TipoProyecto): void {
    if (!this.permisos.editar()) return;
    this.escribir(this.#service.updateTipoProyecto(t.id, { activo: !t.activo }));
  }

  protected eliminarTipoProyecto(t: TipoProyecto): void {
    if (!this.permisos.eliminar() || !confirm(`¿Eliminar el tipo de proyecto «${t.nombre}»?`)) return;
    this.escribir(this.#service.deleteTipoProyecto(t.id), () => {
      if (this.editando()?.id === t.id) this.editando.set(null);
    });
  }

  protected editarPlanos(t: TipoProyecto): void {
    this.editando.set(t);
    const estado: Record<number, InclusionPlano> = {};
    for (const p of t.planos) estado[p.id_tipo_plano] = p.obligatorio ? 'OBLIGATORIO' : 'SI';
    this.inclusion.set(estado);
  }

  protected cerrarEditor(): void {
    this.editando.set(null);
  }

  protected inclusionDe(idTipoPlano: number): InclusionPlano {
    return this.inclusion()[idTipoPlano] ?? 'NO';
  }

  protected fijarInclusion(idTipoPlano: number, valor: string): void {
    if (valor !== 'NO' && valor !== 'SI' && valor !== 'OBLIGATORIO') return;
    this.inclusion.update((i) => ({ ...i, [idTipoPlano]: valor }));
  }

  protected guardarPlanos(): void {
    const tipo = this.editando();
    if (!tipo || !this.permisos.editar() || this.guardandoPlanos()) return;
    const planos: PlanoDeTipoPayload[] = Object.entries(this.inclusion())
      .filter(([, v]) => v !== 'NO')
      .map(([id, v]) => ({ id_tipo_plano: Number(id), obligatorio: v === 'OBLIGATORIO' }));
    this.guardandoPlanos.set(true);
    this.error.set('');
    this.#service.setPlanosTipoProyecto(tipo.id, planos).subscribe({
      next: () => {
        this.guardandoPlanos.set(false);
        this.editando.set(null);
        this.cargar();
      },
      error: (err: unknown) => {
        this.guardandoPlanos.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  protected resumenPlanos(t: TipoProyecto): string {
    const obligatorios = t.planos.filter((p) => p.obligatorio).length;
    return t.planos.length === 0 ? 'Sin planos' : `${t.planos.length} plano(s), ${obligatorios} obligatorio(s)`;
  }

  // ─── Tipos de plano ────────────────────────────────────────────────────────
  protected crearTipoPlano(): void {
    const codigo = this.nuevoPlanoCodigo().trim();
    const nombre = this.nuevoPlanoNombre().trim();
    if (!this.permisos.crear() || !codigo || !nombre) return;
    const disciplina = this.nuevoPlanoDisciplina().trim();
    this.escribir(this.#service.createTipoPlano({ codigo, nombre, ...(disciplina ? { disciplina } : {}) }), () => {
      this.nuevoPlanoCodigo.set('');
      this.nuevoPlanoNombre.set('');
      this.nuevoPlanoDisciplina.set('');
    });
  }

  protected alternarTipoPlano(p: TipoPlano): void {
    if (!this.permisos.editar()) return;
    this.escribir(this.#service.updateTipoPlano(p.id, { activo: !p.activo }));
  }

  protected eliminarTipoPlano(p: TipoPlano): void {
    if (!this.permisos.eliminar() || !confirm(`¿Eliminar el tipo de plano «${p.nombre}»?`)) return;
    this.escribir(this.#service.deleteTipoPlano(p.id));
  }

  // ─── Años fiscales ─────────────────────────────────────────────────────────
  protected alternarPeriodo(p: PeriodoFiscal): void {
    if (!this.permisos.editar()) return;
    this.escribir(this.#service.setPeriodo(p.anio, !p.activo));
  }

  protected agregarAnio(): void {
    const anio = Number(this.nuevoAnio().trim());
    // El alta de un año es un PUT en la API: exige `editar`, no `crear`.
    if (!this.permisos.editar()) return;
    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
      this.error.set('Indique un año entre 2000 y 2100.');
      return;
    }
    if (this.periodos().some((p) => p.anio === anio)) {
      this.error.set(`El año ${anio} ya está en la lista.`);
      return;
    }
    this.escribir(this.#service.setPeriodo(anio, true), () => this.nuevoAnio.set(''));
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { errorMessage } from '@app/features/almacen/almacen.utils';
import { ObraService } from '../../obra.service';
import { PlanoRequerido, PlanosRequeridosObra } from '../../obra-liquidacion.interface';

/** Una cabecera plegable de la lista: los planos de una disciplina y cuántos ya se completaron. */
export interface GrupoPlanos {
  clave: string;
  titulo: string;
  items: PlanoRequerido[];
  completados: number;
}

const SIN_DISCIPLINA = 'OTROS';

/** Agrupa la lista por disciplina, en el orden en que llega (el backend la ordena por el catálogo). Puro. */
export function agruparPorDisciplina(items: readonly PlanoRequerido[]): GrupoPlanos[] {
  const grupos = new Map<string, PlanoRequerido[]>();
  for (const item of items) {
    const clave = item.disciplina?.trim().toUpperCase() || SIN_DISCIPLINA;
    grupos.set(clave, [...(grupos.get(clave) ?? []), item]);
  }
  return [...grupos].map(([clave, lista]) => ({
    clave,
    titulo: clave === SIN_DISCIPLINA ? 'OTROS PLANOS' : `PLANOS DE ${clave}`,
    items: lista,
    completados: lista.filter((i) => i.entregado).length,
  }));
}

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/** Color de la cabecera de cada disciplina (como en la lista de TIENDAS TAMBO). */
export function colorGrupo(clave: string): string {
  const d = sinTildes(clave);
  if (d.includes('ARQUITEC')) return 'bg-orange-50 text-orange-900';
  if (d.includes('SANITAR')) return 'bg-sky-50 text-sky-900';
  if (d.includes('ELECTRIC')) return 'bg-emerald-50 text-emerald-900';
  if (d.includes('ESTRUCT')) return 'bg-slate-100 text-slate-800';
  return 'bg-surface-container text-on-surface';
}

/**
 * Lista de verificación de planos de la obra (copiada del tipo de proyecto, GRP T58 · versión K): cabeceras plegables por
 * disciplina, cada plano con su check, su archivo y la etiqueta de obligatorio. El check exige que el plano ya tenga archivo;
 * «Subir» y «Nueva versión» los resuelve la pantalla con el diálogo de planos. El contador «n de m» cuenta los obligatorios.
 */
@Component({
  selector: 'app-planos-requeridos',
  standalone: true,
  templateUrl: './planos-requeridos.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanosRequeridosComponent {
  readonly #service = inject(ObraService);

  readonly idCentroCosto = input<number | null>(null);
  /** Marcar o quitar el check exige la acción `editar` del módulo `obra`. */
  readonly puedeEditar = input(false);
  /** Subir el archivo de un plano exige la acción `crear` del módulo `obra`. */
  readonly puedeSubir = input(false);
  /** Cambia cuando se guarda o elimina un plano de la obra: vuelve a pedir la lista (el archivo de cada plano). */
  readonly recarga = input(0);

  /** Plano de la lista sin archivo: hay que subirlo. */
  readonly subir = output<PlanoRequerido>();
  /** Plano de la lista con archivo: se reemplaza con una nueva versión. */
  readonly nuevaVersion = output<PlanoRequerido>();

  protected readonly guardando = signal<number | null>(null);
  protected readonly error = signal('');
  /** Disciplinas desplegadas (al entrar todas están recogidas). */
  protected readonly abiertos = signal<ReadonlySet<string>>(new Set());
  protected readonly colorGrupo = colorGrupo;

  protected readonly cargada = rxResource({
    params: () => {
      const id = this.idCentroCosto();
      return id === null ? undefined : { id, recarga: this.recarga() };
    },
    stream: ({ params }) => this.#service.getPlanosRequeridos(params.id),
  });

  /** Lista vigente: la última carga o la respuesta de un check; durante una recarga se conserva la anterior. */
  protected readonly datos = linkedSignal<PlanosRequeridosObra | null, PlanosRequeridosObra | null>({
    source: () => (this.cargada.hasValue() ? this.cargada.value() : null),
    computation: (nueva, anterior) => nueva ?? anterior?.value ?? null,
  });

  protected readonly grupos = computed(() => agruparPorDisciplina(this.datos()?.items ?? []));

  protected alternarGrupo(clave: string): void {
    this.abiertos.update((actual) => {
      const nuevo = new Set(actual);
      if (!nuevo.delete(clave)) nuevo.add(clave);
      return nuevo;
    });
  }

  protected alternar(item: PlanoRequerido): void {
    const id = this.idCentroCosto();
    if (id === null || !this.puedeEditar() || this.guardando() !== null) return;
    if (!item.entregado && !item.archivo) {
      this.error.set(`Sube primero el archivo del plano ${item.codigo} para marcarlo como entregado.`);
      return;
    }
    this.error.set('');
    this.guardando.set(item.id_tipo_plano);
    this.#service.marcarPlanoRequerido(id, item.id_tipo_plano, !item.entregado).subscribe({
      next: (resp) => {
        this.datos.set(resp);
        this.guardando.set(null);
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.guardando.set(null);
      },
    });
  }
}

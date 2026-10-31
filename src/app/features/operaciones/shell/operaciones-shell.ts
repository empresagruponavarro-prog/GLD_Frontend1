import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { ETIQUETAS_ESTADO_OBRA, ESTADOS_OBRA } from '../../centros-costos/obra-cockpit/obra-control.interface';
import { valorDeEvento, marcadoDeEvento, opcionValida } from '@shared/utils/eventos';
import { OperacionesStore } from '../operaciones.store';
import { CampanaComponent } from '../ui/campana/campana';

export interface PestanaOperaciones {
  ruta: string;
  etiqueta: string;
}

/** Vistas del Dashboard, en el orden de «Anterior / Siguiente» (RF-OP-47). */
export const PESTANAS_OPERACIONES: readonly PestanaOperaciones[] = [
  { ruta: 'en-vivo', etiqueta: 'En vivo' },
  { ruta: 'indicadores', etiqueta: 'Indicadores' },
  { ruta: 'por-cliente', etiqueta: 'Por cliente' },
  { ruta: 'por-departamento', etiqueta: 'Por departamento' },
  { ruta: 'culminados', etiqueta: 'Culminados' },
  { ruta: 'partidas', etiqueta: 'Partidas' },
  { ruta: 'curva-s', etiqueta: 'Curva S' },
  { ruta: 'cronograma', etiqueta: 'Cronograma' },
  { ruta: 'jefes', etiqueta: 'Jefes de proyecto' },
  { ruta: 'coordinadores', etiqueta: 'Coordinadores' },
  { ruta: 'equipo', etiqueta: 'Equipo por proyecto' },
];

/** Marco del Dashboard de Operaciones: pestañas, filtros globales y salida de la vista activa. */
@Component({
  selector: 'app-operaciones-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CampanaComponent],
  templateUrl: './operaciones-shell.html',
  styleUrl: '../operaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperacionesShellComponent {
  readonly #router = inject(Router);
  protected readonly store = inject(OperacionesStore);

  protected readonly pestanas = PESTANAS_OPERACIONES;
  protected readonly estados = ESTADOS_OBRA.map((e) => ({ valor: e, etiqueta: ETIQUETAS_ESTADO_OBRA[e] }));
  protected readonly valorDe = valorDeEvento;
  protected readonly marcadoDe = marcadoDeEvento;

  readonly #url = toSignal(
    this.#router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.#router.url),
    ),
    { initialValue: this.#router.url },
  );
  /** Índice de la pestaña activa (−1 si ninguna). */
  protected readonly indice = computed(() => this.pestanas.findIndex((p) => this.#url().includes(`/operaciones/${p.ruta}`)));
  protected readonly anterior = computed(() => (this.indice() > 0 ? this.pestanas[this.indice() - 1] : null));
  protected readonly siguiente = computed(() => (this.indice() >= 0 && this.indice() < this.pestanas.length - 1 ? this.pestanas[this.indice() + 1] : null));

  /** Chips de los filtros activos, con su nombre legible (RF-OP-46). */
  protected readonly chips = computed(() => {
    const f = this.store.filtros();
    const c = this.store.catalogos();
    const out: { clave: 'anio' | 'cliente' | 'jefe' | 'coordinador' | 'departamento' | 'estado' | 'q'; texto: string }[] = [];
    if (f.anio !== null) out.push({ clave: 'anio', texto: `Año ${f.anio}` });
    if (f.cliente !== null) out.push({ clave: 'cliente', texto: `Cliente: ${c.clientes.find((x) => x.id === f.cliente)?.nombre ?? f.cliente}` });
    if (f.jefe !== null) out.push({ clave: 'jefe', texto: `Jefe: ${c.jefes.find((x) => x.id === f.jefe)?.nombre ?? f.jefe}` });
    if (f.coordinador !== null) out.push({ clave: 'coordinador', texto: `Coordinador: ${c.coordinadores.find((x) => x.id === f.coordinador)?.nombre ?? f.coordinador}` });
    if (f.departamento !== null) out.push({ clave: 'departamento', texto: `Departamento: ${f.departamento}` });
    if (f.estado !== null) out.push({ clave: 'estado', texto: `Estado: ${ETIQUETAS_ESTADO_OBRA[f.estado]}` });
    if (f.q.trim()) out.push({ clave: 'q', texto: `Búsqueda: ${f.q.trim()}` });
    return out;
  });

  protected numero(v: string): number | null {
    const n = Number(v);
    return v !== '' && Number.isFinite(n) ? n : null;
  }

  protected texto(v: string): string | null {
    return v === '' ? null : v;
  }

  protected estado(v: string) {
    return opcionValida(ESTADOS_OBRA, v);
  }

  protected quitar(clave: 'anio' | 'cliente' | 'jefe' | 'coordinador' | 'departamento' | 'estado' | 'q'): void {
    this.store.actualizar(clave === 'q' ? { q: '' } : { [clave]: null });
  }

  protected irA(p: PestanaOperaciones | null): void {
    if (p) void this.#router.navigate(['/operaciones', p.ruta]);
  }
}

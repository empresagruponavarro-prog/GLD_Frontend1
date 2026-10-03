# Convenciones de código — GLD Frontend

Este documento fija el estilo y las reglas de nomenclatura para que el código sea consistente entre agentes y fases.

## Idioma de identificadores

- **Módulos, clases, interfaces:** español en dominio, inglés en técnico.
  - ✅ `presupuestos.component.ts` (dominio en español)
  - ✅ `CentrosCostosComponent` (clase en PascalCase)
  - ✅ `CreateCentroCostoDialog` (componente de diálogo explícito)
  - ❌ `presupuesto_componente.ts` (mezcla con underscore)

- **Variables, funciones, propiedades:** camelCase en inglés o español, según contexto técnico:
  - ✅ `selectedPresupuesto` / `presupuestoSeleccionado` (ambas válidas si es consistente en la feature)
  - ✅ `loadIncidencias()` / `cargarIncidencias()` (función pública)
  - ✅ `#modalOpen` (campo privado con #)

- **Constantes:** UPPER_SNAKE_CASE para valores inmutables globales.
  - ✅ `const API_BASE_URL = 'http://...'`
  - ✅ `const NAV_ITEMS = [ ... ] as const`

- **Enums y tipos:** PascalCase, preferir `as const` para uniones literales.
  - ✅ `type EstadoCC = 'activo' | 'inactivo' | 'eliminado' as const`
  - ✅ `interface Presupuesto { ... }`

## Prefijos de booleans

- **`is`** para estado: `isLoading`, `isActive`, `isVisible`
- **`has`** para posesión: `hasErrors`, `hasChildren`
- **`can`** para permiso/capacidad: `canEdit`, `canDelete`
- **`should`** para lógica condicional: `shouldRefresh`

Ejemplo:
```typescript
readonly isLoading = signal(false);
readonly hasItems = computed(() => this.items().length > 0);
readonly canDelete = computed(() => this.user().role === 'admin');
```

## Nombres de outputs

- **Pattern:** `(action)="handler()"` con verbos en infinitivo.
  - ✅ `(save)="onSave()"`
  - ✅ `(delete)="onDelete()"`
  - ✅ `(edit)="onEdit($event)"`
  - ❌ `(onSave)` (redundante con paréntesis)

- **Handlers en el componente:** `on<Acción>()` en camelCase.
  ```typescript
  @Output() save = new EventEmitter<Presupuesto>();
  onSave() { this.save.emit(...); }
  ```

## BEM (Block Element Modifier) con prefijo de componente

Evitar CSS global excepto reset y utilidades. Cada componente tiene su namespace:

- **Block:** `.presupuestos-` (prefijo de feature)
- **Element:** `.presupuestos-form`
- **Modifier:** `.presupuestos-form--readonly`

Ejemplo:
```css
.presupuestos-form { ... }
.presupuestos-form__field { ... }
.presupuestos-form__field--error { ... }
.presupuestos-form__button { ... }
.presupuestos-form__button--primary { ... }
```

No usar:
- ❌ `.form` (demasiado global)
- ❌ `.presupuestos_form` (mezclar guion y underscore)
- ❌ `::ng-deep` (quebranta encapsulación)

## Nombres de archivos

- **Sin sufijo `.component`:** el tipo se infiere del contenido.
  - ✅ `presupuestos.ts` → componente
  - ✅ `presupuestos.service.ts` → servicio
  - ✅ `presupuestos.html` → plantilla
  - ❌ `presupuestos.component.ts` (redundante)

- **Servicios y stores:** `<dominio>.service.ts` o `<dominio>.store.ts`
  - ✅ `presupuestos.service.ts` (HTTP/cálculos)
  - ✅ `presupuestos.store.ts` (estado/signals, Fase 3+)

- **Diálogos:** `<nombre>-dialog/` (carpeta) con `<nombre>-dialog.ts` + `.html`
  - ✅ `create-presupuesto-dialog/`
  - ✅ `presupuesto-detalle-dialog/`

- **Modelos y tipos:** `<dominio>.models.ts`
  - ✅ `presupuesto.models.ts` → `Presupuesto`, `PresupuestoDto`, `PresupuestoFormModel`

- **Validadores:** `<dominio>.validators.ts`
  - ✅ `presupuesto.validators.ts` → `presupuestoAmountValidator()`, `faseValidator()`

- **Cálculos puros:** `<dominio>.calc.ts` (sin Angular, testeables)
  - ✅ `presupuesto.calc.ts` → `calculateTotal()`, `calculateIGV()`

## Change detection: OnPush por defecto

Todos los componentes nuevos usan `ChangeDetectionStrategy.OnPush`:

```typescript
@Component({
  selector: 'app-presupuestos',
  templateUrl: './presupuestos.html',
  styleUrls: ['./presupuestos.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,  // ← SIEMPRE
})
export class PresupuestosComponent { ... }
```

Razón: `zoneless` requiere cambio detection explícito. `OnPush` es más eficiente y obliga a usar signals.

## Decoradores: @Service() vs @Injectable()

Angular 22 proporciona `@Service()` como alias para `@Injectable()` con DI automático:

```typescript
// ✅ Nuevo (Fase 0+)
@Service()
export class PresupuestosService {
  #http = inject(HttpClient);
  // ...
}

// ❌ Antiguo
@Injectable({ providedIn: 'root' })
export class PresupuestosService {
  // ...
}
```

Usar `@Service()` siempre que sea posible. Se requiere `providedIn: 'route'` o `providedIn: <feature>.routes` para stores de feature en Fase 3.

## Inyección de dependencias

Usar `inject()` en lugar de constructores parametrizados:

```typescript
// ✅
readonly #http = inject(HttpClient);
readonly #router = inject(Router);

// ❌ (antiguo patrón)
constructor(private http: HttpClient, private router: Router) {}
```

Ventaja: más legible con `#` (privado).

## Template control flow

Usar `@if`, `@for`, `@switch` en lugar de `*ngIf`, `*ngFor`, etc.:

```html
<!-- ✅ Angular 17+ -->
@if (loading()) {
  <app-loading-state />
} @else if (items().length > 0) {
  @for (item of items(); track item.id) {
    <app-item [item]="item" />
  }
} @else {
  <app-empty-state />
}

<!-- ❌ Angular 16 style -->
<div *ngIf="loading"> ... </div>
<div *ngFor="let item of items; trackBy: trackByFn"> ... </div>
```

## Signals en plantillas

Invocar siempre el signal:

```html
<!-- ✅ -->
{{ count() }}
@if (showDetail() && selectedItem()) { ... }

<!-- ❌ -->
{{ count }}  (referencia, no valor)
*ngIf="showDetailModal && selectedItem"  (mismo error)
```

## Testing (Fase 0+)

- Archivos: `<dominio>.spec.ts` colocado con el código fuente.
- Estructura: AAA (Arrange, Act, Assert).
- Evitar: spies sobre métodos privados, snapshots de plantillas.
- Probar: comportamiento, no implementación interna.

Ejemplo:
```typescript
it('calcula el total correcto', () => {
  // Arrange
  const fases = [{ costo: 100 }, { costo: 50 }];
  
  // Act
  const total = calculateTotal(fases);
  
  // Assert
  expect(total).toBe(150);
});
```

## Commits y PRs

- **Commit:** pequeño, atómico, con mensaje en inglés o español consistente.
  - ✅ `fix(presupuestos): corregir cálculo de IGV`
  - ✅ `feat(incidencias): mostrar modal de detalle con @if`

- **PR:** enlazar a la tarea, incluir cambios visuales, verificar lint/test/build.

## Referencias

- [Angular Style Guide](https://angular.io/guide/styleguide)
- ADR-001 (Estilos)
- ADR-002 (Formularios)
- ADR-003 (Iconografía)
- ADR-004 (Estado)
- ADR-005 (Capas)

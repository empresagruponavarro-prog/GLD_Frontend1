# ADR-005: Capas y fronteras

**Estado:** Propuesto  
**Decisión:** Arquitectura en capas explícitas con fronteras verificables: `layouts` + `core` + `shared/{ui,data-access,models,utils}` + `features`.

## Contexto

La arquitectura actual es plana: features con componente+servicio+HTML, sin data-access compartido, sin core, sin separación de capas de UI.

Esto genera:
- Acoplamiento entre features (imports cruzados).
- Duplicación de cálculos HTTP y normalización.
- Imposibilidad de verificar dependencias con lint.
- Modelos DTO iguales a modelos de UI.

## Decisión

```
src/
├── styles/
│   ├── tokens.css              (primitivos + semánticos)
│   ├── base.css                (reset, tipografía, scrollbar)
│   └── utilities.css           (mínimas: .sr-only, .stack, .cluster)
├── app/
│   ├── app.config.ts           (zoneless explícito, router, http)
│   ├── app.routes.ts           (solo loadChildren/loadComponent)
│   ├── layouts/
│   │   ├── main-layout/        (header + sidebar + <router-outlet>)
│   │   └── navigation.config.ts (NAV_ITEMS tipado)
│   ├── core/                   (singletons: root)
│   │   ├── auth/               (AuthService, authGuard, authInterceptor)
│   │   ├── http/               (API_BASE_URL, errorInterceptor)
│   │   ├── notifications/      (NotificationService, ToastHost)
│   │   └── dialogs/            (ConfirmDialogService)
│   ├── shared/
│   │   ├── ui/                 (componentes presentacionales, SIN servicios)
│   │   │   ├── button, icon-button, modal, data-table
│   │   │   ├── pagination, page-header, filter-toolbar
│   │   │   ├── search-field, select-filter, status-badge
│   │   │   ├── form-field, form-grid, detail-grid
│   │   │   ├── empty-state, loading-state, segmented-control
│   │   │   ├── file-upload, kpi-card
│   │   ├── data-access/
│   │   │   ├── http/           (toHttpParams, normalizePaginated)
│   │   │   └── catalogos/      (CatalogosService: cache root)
│   │   ├── models/             (Paginated<T>, SelectOption, ApiError)
│   │   └── utils/              (csv, dates, money, debouncedSignal, createPaginatedQuery)
│   └── features/
│       └── <feature>/
│           ├── <feature>.routes.ts
│           ├── index.ts                (API pública)
│           ├── data-access/
│           │   ├── <x>.api.ts          (HTTP + DTO→Model)
│           │   └── <x>.store.ts        (@Service() scope ruta)
│           ├── models/                 (tipos de dominio + DTO)
│           ├── pages/<x>-page/         (contenedor: inyecta store)
│           ├── ui/                     (presentacionales de feature)
│           └── dialogs/
```

## Fronteras (reglas verificables con lint)

| Capa | Puede importar | NO puede importar |
|------|----------------|-------------------|
| `shared/ui` | `shared/models`, `shared/utils` | `core`, `features`, servicios HTTP |
| `shared/data-access` | `core/http`, `shared/models` | `features` |
| `features/X/ui` | `shared/ui`, `features/X/models` | `features/X/data-access`, otras features |
| `features/X/pages` | lo propio de X, `shared/*`, `core/*`, `features/Y/index.ts` | internos de Y |
| `core` | `shared/models` | `features` |

## Mapa de features objetivo

```
features/
├── maestros/          (anexos, productos, especialidades, tipo-doc)
├── administracion/    (empresas, usuarios, [menus])
├── centros-costos/    (listado, form, dashboard, cockpit)
├── presupuestos/      (workspace, wizard, plantillas, detalle)
├── documentos/        (origen)
└── incidencias/
```

## Implementación

**STAB (Fase 0):** Solo documentación. No se refactoriza código.

**Fase 1–4:** Implementación incremental:
1. Crear estructura `layouts/`, `core/`, `shared/{ui,data-access,models,utils}`.
2. Migrar componentes de UI a `shared/ui`.
3. Crear servicios datos-access en `shared/data-access`.
4. Añadir `index.ts` público por feature.
5. Lint de fronteras (opcional: `eslint-plugin-boundaries`).

## Limitaciones actuales (STAB)

- `core/` y `shared/data-access/` no existen.
- Features siguen siendo monolíticas.
- Imports cruzados sin validación.
- Se refactorizan en Fase 4 (ARCH).

## Referencias

- §14 de `03-auditoria-frontend-angular.md`
- §5 (componentización) para ver cómo dividir features.
- Fase 4 (ARCH) para implementación de fronteras.

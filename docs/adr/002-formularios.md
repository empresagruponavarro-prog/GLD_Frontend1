# ADR-002: Formularios

**Estado:** Aceptado  
**Decisión:** Reactive Forms **tipados** con `nonNullable`. Signal Forms solo si son estables en la versión instalada **y** se adoptan para todo el proyecto. No mezclar enfoques.

## Contexto

El proyecto aún no usa un patrón de formularios consistente. Angular 22 ofrece:
1. Reactive Forms (estable, tipado con `FormControl<T>`).
2. Signal Forms (experimental en Angular 22; basadas en signals en lugar de observables).

Mezclar ambas aumenta la complejidad mantenimiento y confunde a los equipos.

## Decisión

**Reactive Forms tipados** como estándar actual:
- Usar `FormGroup<T>` y `FormControl<T, V>` con tipos genéricos.
- Activar `nonNullable: true` en los controles para evitar `| null`.
- Crear cada `FormGroup` localmente en el componente o diálogo, no globalmente.
- Validadores personalizados como funciones puras en `*.validators.ts`.

**Signal Forms**:
- Solo si se confirma estabilidad en la versión instalada (Angular 22).
- Si se adopta, migrar **todo el proyecto** (no adoptarla a medias).
- Esto se evalúa y decide al iniciar Fase 3 (STATE).

## Implementación

1. Cada formulario (modal, página) declara su `FormGroup<Dto>` local.
2. En Fase 4 (ARCH), separar `Dto` (del servidor) de `FormModel` (de la UI tipada).
3. No crear un "form builder por configuración"; cada formulario es específico.

## Referencias

- §11 de `03-auditoria-frontend-angular.md`
- Fase 3 (STATE) para revisión de Signal Forms

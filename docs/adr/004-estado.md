# ADR-004: Estado y Signals

**Estado:** Aceptado  
**Decisión:** Tabla "Necesito… → uso" para elegir entre signal, computed, linkedSignal, rxResource, effect y model.

## Contexto

Angular 22 standalone con zoneless ofrece varias herramientas para estado:
- `signal()` para estado mutable.
- `computed()` para valores derivados.
- `linkedSignal()` para sincronización selectiva.
- `rxResource()` / `httpResource()` para datos remotos.
- `effect()` para sincronización con APIs no-Angular.
- `model()` para bidireccional padre-hijo.

Usarlas arbitrariamente genera inconsistencia. Esta tabla fija el criterio para el equipo.

## Decisión

| Necesito… | Uso | Razón |
|-----------|-----|-------|
| Estado que el usuario o el servidor cambian | `signal()` | Cambios reactivos simples. |
| Un valor calculado de otros signals | `computed()` | Memorizados automáticamente, se recalculan solo si sus dependencias cambian. |
| Estado editable que se reinicia cuando cambia una fuente (ej: forma que cambia al seleccionar un CC) | `linkedSignal()` | Mantiene sincronía sin código manual. |
| Datos remotos que dependen de parámetros (ej: listado filtrado) | `rxResource()` / `httpResource()` | Cancelación, loading, error y reload gratis. Evita races. |
| Sincronizar con algo que no es Angular (DOM externo, localStorage, Leaflet) | `effect()` | Puentes controlados. Combinado con `DestroyRef` para limpieza. |
| Comunicación bidireccional padre ↔ hijo | `model()` | Reemplaza el patrón `@Input() + @Output()` tradicional. |

## Implementación

1. **Signals en componentes:** estado local con `signal()`, derivados con `computed()`.
2. **Stores por feature:** servicios con `@Service()` scope de ruta, con signals/computed/rxResource.
3. **No usar fields mutables junto con signals:** elegir uno u otro (SIG-001 de auditoría).
4. **Datos remotos:** siempre `rxResource()` en stores, jamás `loading` y `subscribe` manual.
5. **Validación manual:** no mezclar formularios Reactive con `model()`; decidir en ADR-002.

## Limitaciones actuales (STAB-01–03)

- `linkedSignal`, `rxResource`, `model` y `effect` no están en uso. Se introducen en **Fase 3 (STATE)**.
- Hasta entonces, usar `signal()` + `computed()` + setters manuales.

## Referencias

- §7 de `03-auditoria-frontend-angular.md`
- Fase 3 (STATE) para introducción de linkedSignal/rxResource
- `app.config.ts` para validar `provideZonelessChangeDetection()`

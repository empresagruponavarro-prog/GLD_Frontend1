# ADR-003: Iconografía

**Estado:** Aceptado  
**Decisión:** Font Awesome Free 6 como único set de iconos. Lucide y Material Symbols se retiran al migrar sus pantallas. Prohibido usar emojis como iconos.

## Contexto

La aplicación usa tres sets de iconos simultáneamente:
- Font Awesome 6 (19 archivos).
- Lucide Angular (pocas instancias).
- Material Symbols (Google Fonts).

Además, hay emojis literales usados como iconos (baja accesibilidad).

Esto genera: redundancia, mayor peso de bundle y fragmentación visual.

## Decisión

**Font Awesome Free 6** como estándar único:
- Cubre la mayoría de necesidades con 2.000+ iconos.
- Ya está cargado vía CDN en `index.html` (línea 13).
- En Fase 5 (PERF), subsetting para optimizar.

**Lucide y Material Symbols**:
- Retirarse al migrar la pantalla que los usa.
- Si una pantalla nueva necesita un icono que Font Awesome no tiene, proponer en reunión antes de añadir un nuevo set.

**Emojis**:
- Prohibidos. Usar siempre iconos semánticos.
- Si se usa un emoji en CSS, reemplazarlo con Font Awesome.

## Implementación

1. Nuevos componentes de UI usan Font Awesome vía directiva `<i class="fa fa-...">` o Angular `<fa-icon>` si está disponible.
2. En Fase 2 (COMP), al refactorizar Presupuestos y Cockpit, migrar a Font Awesome.
3. Audit: buscar `🚀` y emojis literales; reemplazarlos.

## Referencias

- §5.3 y §9 de `03-auditoria-frontend-angular.md`
- Fase 2 (COMP) para migración
- Fase 5 (PERF) para subsetting

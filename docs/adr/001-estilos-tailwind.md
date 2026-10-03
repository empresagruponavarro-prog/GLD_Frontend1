# ADR-001: Estilos y Tailwind

**Estado:** Propuesto  
**Decisión:** Opción A — Tailwind v4 compilado en build con `@theme` alimentado por tokens CSS.

## Contexto

La aplicación tiene tres sistemas de estilos superpuestos:
1. Variables CSS en `styles.css` con clases semánticas.
2. Tailwind v3 por CDN con una paleta Material 3.
3. CSS por componente que redefine `.btn`, `.badge`, `.card` y `.modal-*`.

Esto genera inconsistencia: 138 colores hex literales y dos paletas.

## Decisión

**Opción A: Tailwind v4 compilado vía PostCSS** (recomendada):
- Los componentes de `shared/ui` usan CSS propio con tokens CSS, sin utilidades de Tailwind.
- Las pantallas que ya usan utilidades Tailwind (Presupuestos, Obra Cockpit, Plantillas) pueden seguir usándolas en esta fase.
- En Fase 1 (DS-02), migrar a compilación estática y consolidar en componentes.
- Ventaja: no requiere reescribir 4.500 líneas de plantilla para cambiar de Tailwind.

**Opción B descartada (por ahora):**
- Retirar Tailwind y migrar Presupuestos, Cockpit y Plantillas a componentes de UI con CSS basado en tokens.
- Requeriría reescritura masiva; aplazado a Fase 1 si el equipo lo elige.

## Implementación

1. En Fase 1 (DS-02): Crear `styles/tokens.css` con tokens primitivos y semánticos.
2. Configurar Tailwind v4 para compilación en build con `@theme` generado desde tokens.
3. En Fase 2 (COMP): migrar pantallas a componentes de UI.

## Referencias

- §9 de `03-auditoria-frontend-angular.md`
- Fase 1 (DS-01, DS-02) en `00-plan.md`

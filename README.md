# Compás

App móvil de finanzas para el hogar, basada en el **Método Compás**: automatiza el ahorro, haz consciente el gasto y decide en familia.

Proyecto en cuatro fases: (1) investigación, (2) análisis y diseño con Spec-Driven Development, (3) desarrollo con Claude Code y (4) implementación real en el hogar Durán Damann. Este repositorio es el **kit de la Fase 2** y el punto de partida de la Fase 3.

## Estado

| Pieza | Estado |
| --- | --- |
| Método v2 consolidado | Listo · `docs/metodo/metodo-compas-v2.md` |
| Decisiones del hogar piloto | Listas · `docs/decisiones-hogar.md` |
| ADR 01–10 | Revisadas 24-10-2026: 01–05, 07, 09 y 10 aceptadas; 06 y 08 postergadas · `docs/adr/` |
| Base de datos (migraciones 0001–0016) | Probada en PostgreSQL 16 y Supabase local · `db/` |
| Specs 001–011 | 001 implementada; 002–011 aprobadas por delegación (D29) e implementadas en la Beta · `specs/` |
| Plan y tareas | Spec 001 y Beta 002–011 · `specs/beta-mvp-plan.md` y `specs/NNN-*/tasks.md` |
| Código de la app | Beta completa del MVP en web (Expo); IA con respaldo por reglas (D31) |

## Cómo empezar con Claude Code

1. Crea un repositorio privado en GitHub (por ejemplo `compas`) y sube este contenido.
2. Ábrelo con Claude Code (terminal, escritorio o web).
3. Revisa y aprueba las ADR: cambia `Estado: Propuesta` por `Aceptada` en las que estés de acuerdo.
4. Responde las preguntas `[POR ACLARAR]` de las specs 001 a 004.
5. Cambia la spec 001 a `Estado: aprobada` y ejecuta:

```
/implementar 001
```

6. Para cada spec siguiente: `/planificar NNN` → `/tareas NNN` → `/implementar NNN` → `/verificar NNN`. Si no sabes qué sigue: `/siguiente`.
7. En marcha blanca, todo lo que veas al usar la app entra con `/ajustar <lo que pasó>`.

Requisitos locales: Node 22, pnpm, Docker (para `supabase start`), Supabase CLI y PostgreSQL client (`psql`).

## Hoja de ruta

| Período | Specs | Resultado |
| --- | --- | --- |
| 13–18 oct | 001 Base de la plataforma · 002 Cuentas y categorías | Hogar, acceso, cuentas y sobres |
| 19–30 oct | 003 Importación de cartolas · 004 Perfil inicial · 005 Captura | **Marcha blanca v0**: línea base de octubre y uso diario |
| 2–20 nov | 006 Plan mensual · 007 Ingresos y distribución · 008 Tarjeta de crédito | Ciclo mensual completo |
| 21–30 nov | 009 Control y alertas · 010 Cierres y KPI · 011 Privacidad | Listo para el primer plan |
| 1 dic | — | Primer presupuesto real; entra en vigencia la Ley 21.719 |

Octubre y noviembre de 2026 son **línea base**: se cargan desde cartolas y se clasifican sin presupuesto (D21).

## Estructura

```
.specify/
  memory/constitution.md       principios del método y de ingeniería (manda sobre todo)
  templates/                   plantillas de spec, plan y tareas
.claude/skills/                comandos SDD para Claude Code (/especificar, /implementar…)
CLAUDE.md                      instrucciones permanentes para Claude Code
docs/
  metodo/metodo-compas-v2.md   fuente única del negocio: glosario, procesos, reglas R01–R45, eventos
  decisiones-hogar.md          respuestas del piloto y calendario
  adr/                         decisiones de arquitectura
  trazabilidad.csv             regla → spec → implementación → prueba
db/
  migrations/                  0001 esquema v2 · 0002 piloto · 0003 identidad Supabase
  seed/                        catálogos del método
  tests/                       pruebas de invariantes y salidas esperadas
  run_tests.sh                 aplica migraciones en una base nueva y compara salidas
specs/NNN-*/spec.md            especificaciones del MVP
.github/                       CI, @claude, revisión automática y plantillas de issues (ver docs/github-integracion.md)
```

## Pruebas de la base de datos

```bash
PGHOST=localhost PGUSER=postgres ./db/run_tests.sh
```

Cubren: R01 (no asignar más de lo recibido), R25 (menores), R27 y R44 (tarjeta de crédito), R36 (la IA no imputa a Futuro), R37 (doble firma), R41–R43 (cartolas y corte del piloto), base cero, período cerrado, libro inmutable, aislamiento entre hogares y acceso por JWT.

## Fuentes de diseño (Fase 1 y 2)

Artifacts en claude.ai del proyecto "Proyecto sistema de finanzas hogar": Estado del arte, Marco metodológico, Método Compás, Análisis de procesos, Diseño del proceso ajustado v2, Wireframes Compás v2, Un mes con Compás, Modelo de base de datos v2 y Estado de brechas de diseño.

---
name: planificar
description: Genera el plan técnico de una spec aprobada
argument-hint: "<número de spec, p. ej. 003>"
disable-model-invocation: true
---
Genera `specs/$ARGUMENTS-*/plan.md` para la spec indicada.

1. Verifica que la spec esté en estado `aprobada` y sin `[POR ACLARAR]`. Si no, detente y dilo.
2. Lee la constitución, las ADR en `docs/adr/`, las migraciones de `db/migrations` y el código existente relacionado.
3. Completa `.specify/templates/plan-template.md`: verificación contra la constitución, diseño, cambios de base (migración nueva, nunca editar una aplicada), contratos, estrategia de pruebas que mapea cada criterio de aceptación a una prueba, y riesgos.
4. Si una decisión merece ADR (cambia arquitectura o agrega un proveedor), redáctala en `docs/adr/` como Propuesta y avísalo.
5. Muestra el plan resumido y espera la confirmación de Rodrigo antes de crear tareas.

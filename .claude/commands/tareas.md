---
description: Divide el plan de una spec en tareas pequeñas y verificables
argument-hint: "<número de spec>"
---
Crea `specs/$ARGUMENTS-*/tasks.md` desde su `plan.md` con `.specify/templates/tasks-template.md`.

- Una tarea = un cambio probado y commiteable en menos de ~1 hora.
- Primero la prueba que falla, después la implementación.
- Orden: base de datos → dominio → contratos → funciones del servidor → app → integración.
- Cada tarea nombra los archivos y la prueba que la cierra. Marca `[P]` las paralelizables.

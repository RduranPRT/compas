---
description: Implementa las tareas pendientes de una spec, una a una, con pruebas
argument-hint: "<número de spec> [ID de tarea]"
---
Implementa la spec $ARGUMENTS siguiendo su `tasks.md`.

Para cada tarea pendiente (o solo la indicada):
1. Escribe primero la prueba y confirma que falla.
2. Implementa lo mínimo para que pase. Respeta CLAUDE.md: dinero en enteros, migraciones nuevas, la IA nunca aprueba ni mueve dinero, minimización antes de la IA.
3. Ejecuta las pruebas afectadas (`pnpm test`, `./db/run_tests.sh` si tocaste la base).
4. Marca la tarea como hecha en `tasks.md` y haz commit con mensaje en español: `feat(NNN): <tarea> [Rxx]`.
5. Si algo de la spec resulta ambiguo o equivocado, detente, explícalo y propone el cambio a la spec antes de seguir.
Al terminar todas: ejecuta `/verificar $ARGUMENTS`.

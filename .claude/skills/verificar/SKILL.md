---
name: verificar
description: Verifica que una spec esté completa y trazada antes de darla por implementada
argument-hint: "<número de spec>"
disable-model-invocation: true
---
Verifica la spec $ARGUMENTS:

1. Cada escenario Gherkin de `spec.md` tiene una prueba automática que lo cubre; lista los que no.
2. Todas las pruebas pasan: `pnpm -r test`, `pnpm -r typecheck`, `./db/run_tests.sh`.
3. Cada regla citada en la spec tiene fila en `docs/trazabilidad.csv` con la ruta de implementación y de prueba; complétalas.
4. Revisión de seguridad: RLS de tablas nuevas, ninguna llamada a la IA sin minimizar, ninguna clave en la app.
5. Si todo está bien, cambia el estado de la spec a `implementada` y resume en 5 líneas qué quedó funcionando y cómo probarlo en el teléfono.

---
name: especificar
description: Crea o actualiza la spec de una funcionalidad a partir de una descripción
argument-hint: "<número o descripción de la funcionalidad>"
disable-model-invocation: true
---
Vas a escribir o actualizar una especificación del kit Compás. Entrada: $ARGUMENTS

1. Lee `.specify/memory/constitution.md`, `docs/metodo/metodo-compas-v2.md` y `docs/decisiones-hogar.md`.
2. Si existe `specs/NNN-*/spec.md` para lo pedido, actualízala; si no, crea la carpeta con el siguiente número libre usando `.specify/templates/spec-template.md`.
3. Escribe solo el QUÉ y el POR QUÉ: historias, criterios de aceptación en Gherkin (cada escenario cita su regla Rxx), reglas y cálculos, datos, interfaz, IA, eventos y fuera de alcance. Nada de elección de librerías.
4. Todo lo que no puedas deducir del método o de las decisiones márcalo `[POR ACLARAR]` y pregúntalo al final; no inventes reglas de negocio.
5. Deja el estado en `borrador` y muestra a Rodrigo un resumen de 5 líneas y las preguntas abiertas.

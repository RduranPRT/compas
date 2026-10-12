---
name: ajustar
description: Convierte una observación de uso en la marcha blanca en un ajuste trazado
argument-hint: "<lo que pasó al usar la app>"
disable-model-invocation: true
---
Rodrigo reporta desde el uso real: $ARGUMENTS

1. Clasifica: (a) error de implementación respecto de la spec, (b) la spec está bien pero la regla o el parámetro no sirve para el hogar, (c) funcionalidad nueva.
2. (a) Escribe una prueba que reproduzca el error, corrígelo y commitea `fix(NNN): ...`.
   (b) Si es un parámetro del Acuerdo, propone el nuevo valor (no cambies código). Si es una regla, propone el cambio en la spec y en `docs/metodo/metodo-compas-v2.md` y espera aprobación.
   (c) Ejecuta `/especificar` con la idea y agrégala al final de la hoja de ruta en README.
3. Registra el caso en `docs/bitacora-marcha-blanca.md` con fecha, observación, clasificación y resultado.

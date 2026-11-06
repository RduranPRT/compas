# Bitácora de la marcha blanca

Cada observación del uso real entra con `/ajustar` y se registra aquí.

| Fecha | Observación | Clasificación | Resultado | Spec / regla |
| --- | --- | --- | --- | --- |
| 25-10-2026 | Al publicar, el código de ingreso no llega: Supabase exige SMTP propio para editar la plantilla (la estándar manda un enlace) y su correo por defecto solo llega al equipo del proyecto. Rodrigo decide correo y contraseña para el MVP, con cuentas creadas por el ORG y registro público cerrado. | (b) la spec está bien en su intención, pero el método de ingreso no sirve para el hogar con el plan gratuito | Spec 001 ajustada (HU-001-3, escenario de ingreso, interfaz) y D28 en el método; tarea T018. Pendiente: modelo de autenticación definitivo para la etapa comercial. | 001 · D28 · R16 |
| 06-11-2026 | Analizar cartolas para identificar patrones de gasto desgasta mucho en la primera etapa y es poco práctico: no hay claridad sobre las glosas del banco. | (b) la spec está bien implementada, pero la funcionalidad no sirve para el hogar | Perfil inicial eliminado (spec 004 retirada); cartolas opcionales y solo desde el inicio del piloto; etapa inicial E1; cambio de etapa en el cierre mensual. Migración 0017. Tablas conservadas sin uso. | 003 · 004 · 006 · 010 · D35 · R23 · R41 |

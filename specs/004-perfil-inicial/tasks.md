# Tareas · Spec 004 Perfil inicial y retroalimentación

| ID | Tarea | Archivos | Prueba que la cierra | Estado |
| --- | --- | --- | --- | --- |
| T401 | `guardar_perfil`, `proponer_etapa`, `resolver_solicitud` con suplencia y firma doble | db/migrations/0009_perfil_etapa.sql | db/tests/0009_test_perfil_etapa.sql | hecha |
| T402 | Dominio: métricas del perfil, etapa sugerida y hallazgos por reglas | packages/dominio/src/perfil/index.ts | perfil.test.ts | hecha |
| T403 | Función `ia-texto` (redacta a partir de cifras) | supabase/functions/ia-texto | prueba manual al configurar la clave | hecha (sin clave aún) |
| T404 | Pantalla "Tu punto de partida" con precarga y propuesta de etapa | apps/movil/src/pantallas/PerfilInicial.tsx | test/integracion/beta.test.ts (spec 004) | hecha |

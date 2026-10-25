# Tareas · Spec 009 Control, alertas y reasignación N1

| ID | Tarea | Archivos | Prueba que la cierra | Estado |
| --- | --- | --- | --- | --- |
| T901 | Alertas con tope diario, sobre negativo → N1, `reasignar`, `control_diario` con pg_cron | db/migrations/0013_control.sql | db/tests/0013_test_control.sql | hecha |
| T902 | El aviso se da por leído al cubrir el sobre | db/migrations/0016_avisos_resueltos.sql | db/tests/0016_test_avisos_resueltos.sql | hecha |
| T903 | Pantallas Sobres, detalle con "Cubrir", Aprobaciones y Avisos | apps/movil/src/pantallas/{Sobres,SobreDetalle,Aprobaciones,Avisos}.tsx | test/beta.test.tsx | hecha |

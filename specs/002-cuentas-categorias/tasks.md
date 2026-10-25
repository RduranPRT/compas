# Tareas · Spec 002 Cuentas, tarjetas, categorías y sobres del período

Plan común: `specs/beta-mvp-plan.md`. Una tarea = un cambio probado y commiteado.

| ID | Tarea | Archivos | Prueba que la cierra | Estado |
| --- | --- | --- | --- | --- |
| T201 | Plantilla de 15 categorías, sobres del período idempotentes, `asegurar_mes`, configuración solo para administradores | db/migrations/0006_cuentas_sobres.sql | db/tests/0006_test_cuentas_sobres.sql | hecha |
| T202 | Datos de configuración: cuentas, categorías, fondos, ingresos esperados y pagos fijos | apps/movil/src/datos/configuracion.ts | test/integracion/beta.test.ts (spec 002) | hecha |
| T203 | Pantallas Cuentas, Categorías e Ingresos y pagos fijos; lista "Configura tu hogar" en la portada | apps/movil/src/pantallas/{Cuentas,Categorias,IngresosFijos,Portada}.tsx | test/portada.test.tsx | hecha |

## Definición de terminado

- [x] Criterios de aceptación con prueba en verde (SQL e integración).
- [ ] CI en verde en GitHub.

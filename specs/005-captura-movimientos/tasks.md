# Tareas · Spec 005 Captura y clasificación de movimientos

| ID | Tarea | Archivos | Prueba que la cierra | Estado |
| --- | --- | --- | --- | --- |
| T501 | `registrar_gasto` (cuotas D32, duplicados R35, sobre cerrado R11), `registrar_ingreso`, `registrar_reembolso`, bandeja | db/migrations/0007_captura.sql | db/tests/0007_test_captura.sql | hecha |
| T502 | Intérprete de frases y montos coloquiales | packages/dominio/src/frase.ts, dinero.ts | varios.test.ts | hecha |
| T503 | Cola sin conexión idempotente (D11) | apps/movil/src/lib/cola.ts | test/beta.test.tsx | hecha |
| T504 | Pantallas Registrar (monto y sobre, o frase), Bandeja, Movimientos y detalle | apps/movil/src/pantallas/{Registrar,Bandeja,Movimientos,MovimientoDetalle}.tsx | test/beta.test.tsx | hecha |
| T505 | Función `ia-chat` | supabase/functions/ia-chat | prueba manual al configurar la clave | hecha (sin clave aún) |

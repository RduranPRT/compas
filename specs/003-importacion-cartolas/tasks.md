# Tareas · Spec 003 Importación de cartolas

| ID | Tarea | Archivos | Prueba que la cierra | Estado |
| --- | --- | --- | --- | --- |
| T301 | Movimiento tipo transferencia, regla de comercio, `importar_cartola`, `clasificar_comercio`, `guardar_sugerencias` | db/migrations/0008_importacion.sql | db/tests/0008_test_importacion.sql | hecha |
| T302 | Dominio: mapeo de columnas, fechas y montos chilenos, huella de línea, clase por reglas, comercio, minimización | packages/dominio/src/cartola/*, minimizar.ts | cartola.test.ts | hecha |
| T303 | Lectura de Excel y CSV en el dispositivo (SheetJS) sin subir el archivo (D30) | apps/movil/src/datos/cartolas.ts, src/lib/archivo.ts | test/integracion/beta.test.ts (spec 003) | hecha |
| T304 | Funciones `ia-extraer-cartola` e `ia-clasificar` con respuesta 503 sin clave (D31) | supabase/functions/ia-* | prueba manual al configurar la clave | hecha (sin clave aún) |
| T305 | Pantallas Cargar cartola, Cartolas y Revisar por comercio | apps/movil/src/pantallas/{CargarCartola,Cartolas,Revisar}.tsx | test/beta.test.tsx | hecha |

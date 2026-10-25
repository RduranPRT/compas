# Tareas · Spec 001 Base de la plataforma, hogar y acceso

Reglas: una tarea = un cambio que se puede probar y commitear. Las pruebas van antes que la implementación. `[P]` = puede hacerse en paralelo con la anterior.

| ID | Tarea | Archivos | Prueba que la cierra | Estado |
| --- | --- | --- | --- | --- |
| T001 | Crear el monorepo pnpm con `apps/movil`, `packages/dominio`, `packages/contratos`; TypeScript estricto, Vitest y ESLint | package.json, pnpm-workspace.yaml, tsconfig.base.json | `pnpm -r test` corre (0 pruebas) | hecha |
| T002 | Inicializar Supabase local (`supabase init`) y script `scripts/sync-migraciones.sh` que copia `db/migrations/*.sql` a `supabase/migrations/` con prefijo de fecha | supabase/config.toml, scripts/sync-migraciones.sh | `supabase db reset` aplica 0001–0003 sin errores | hecha |
| T003 | Aplicar el seed de catálogos como migración tras 0001 (0002 depende de él y `db push` no ejecuta `seed.sql`) | scripts/sync-migraciones.sh | `select count(*) from ref.regla_metodo` = 45 | hecha (45 reglas) |
| T004 | Ajustar `db/run_tests.sh` para aceptar `DATABASE_URL` y correrlo contra la base de `supabase start` | db/run_tests.sh | 3 pruebas OK contra Supabase local | hecha (corre en contenedor con `scripts/db-tests.sh`; 0001 y 0002 fallan por SET ROLE, ver T005) |
| T005 | Verificar funciones `SECURITY DEFINER` y RLS con el rol `postgres` de Supabase (no superusuario); corregir con migración si hace falta | db/migrations/0004_seguridad_supabase.sql | `db/run_tests.sh` OK en Supabase local | hecha |
| T006 | Escribir `db/tests/0005_test_alta_hogar.sql` con los escenarios de la spec (deben fallar) | db/tests/0005_test_alta_hogar.sql | Falla por funciones inexistentes | hecha |
| T007 | Migración `0005_alta_hogar.sql`: `gob.invitacion` + RPC de alta, invitación, períodos y activación del Acuerdo + parámetro `modalidad_sin_culpa` (ADR-10) | db/migrations/0005_alta_hogar.sql | T006 en verde; salida esperada revisada y guardada | hecha |
| T008 [P] | `packages/dominio/src/parametros.ts`: valores por defecto del Acuerdo con esquema zod y prueba, incluida `modalidad_sin_culpa` | packages/dominio/src/parametros.ts | parametros.test.ts | hecha |
| T009 [P] | Generar tipos de la base en `packages/contratos` (`supabase gen types`) y script `pnpm gen:tipos` | packages/contratos/src/db.ts | typecheck | pendiente |
| T010 | App Expo: proyecto base con Expo Router, cliente Supabase con sesión en `expo-secure-store` (web: localStorage) | apps/movil/* | La app abre en web (prioridad del MVP, ADR-03); Android e iOS con Expo Go | hecha (web verificada; Expo Go en el teléfono pendiente) |
| T011 | Pantalla de ingreso con OTP por correo | apps/movil/app/ingresar.tsx | prueba de componente + prueba manual | hecha (prueba manual con correo real pendiente: requiere Supabase) |
| T012 | Asistente de alta: hogar e integrantes (RPC) | apps/movil/app/(alta)/* | prueba de integración contra Supabase local | pendiente |
| T013 | Consentimientos con texto versionado (`docs/legal/consentimiento-v1.md`) | apps/movil/app/(alta)/consentimientos.tsx, docs/legal/consentimiento-v1.md | prueba de componente | hecha (texto v1 para revisión de Rodrigo) |
| T014 | Acuerdo v1: vista de parámetros, solicitud de firma al CAD, activación | apps/movil/app/(alta)/acuerdo.tsx | prueba de integración | en curso (pantalla y prueba de componente hechas; integración espera T007) |
| T015 | Portada vacía con siguiente paso | apps/movil/app/(tabs)/index.tsx | prueba de componente | hecha |
| T016 | CI: workflow que corre pruebas de base y del monorepo | .github/workflows/ci.yml | CI en verde en el PR | en curso (pasos verdes en local; falta verlo en GitHub tras el push) |
| T017 | Desplegar: proyecto Supabase en sa-east-1, `supabase db push`, publicar la versión web en hosting estático (ADR-03) | docs/despliegue.md | Rodrigo inicia sesión en su teléfono | pendiente |

## Definición de terminado

- [ ] Todos los criterios de aceptación de la spec tienen prueba y están en verde.
- [ ] `db/run_tests.sh` y las pruebas del monorepo pasan en CI.
- [ ] `docs/trazabilidad.csv` actualizado.
- [ ] Estado de la spec cambiado a `implementada`.

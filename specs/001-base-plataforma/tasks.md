# Tareas · Spec 001 Base de la plataforma, hogar y acceso

Reglas: una tarea = un cambio que se puede probar y commitear. Las pruebas van antes que la implementación. `[P]` = puede hacerse en paralelo con la anterior.

| ID | Tarea | Archivos | Prueba que la cierra | Estado |
| --- | --- | --- | --- | --- |
| T001 | Crear el monorepo pnpm con `apps/movil`, `packages/dominio`, `packages/contratos`; TypeScript estricto, Vitest y ESLint | package.json, pnpm-workspace.yaml, tsconfig.base.json | `pnpm -r test` corre (0 pruebas) | hecha |
| T002 | Inicializar Supabase local (`supabase init`) y script `scripts/sync-migraciones.sh` que copia `db/migrations/*.sql` a `supabase/migrations/` con prefijo de fecha | supabase/config.toml, scripts/sync-migraciones.sh | `supabase db reset` aplica 0001–0003 sin errores | pendiente |
| T003 | Aplicar el seed de catálogos en `supabase/seed.sql` desde `db/seed/0001_catalogos.sql` | supabase/seed.sql | `select count(*) from ref.regla_metodo` = 45 | pendiente |
| T004 | Ajustar `db/run_tests.sh` para aceptar `DATABASE_URL` y correrlo contra la base de `supabase start` | db/run_tests.sh | 3 pruebas OK contra Supabase local | pendiente |
| T005 | Verificar funciones `SECURITY DEFINER` y RLS con el rol `postgres` de Supabase (no superusuario); corregir con migración si hace falta | db/migrations/0004_*.sql | `db/run_tests.sh` OK en Supabase local | pendiente |
| T006 | Escribir `db/tests/0004_alta_hogar.sql` con los escenarios de la spec (deben fallar) | db/tests/0004_alta_hogar.sql | Falla por funciones inexistentes | pendiente |
| T007 | Migración `0004_alta_hogar.sql`: `gob.invitacion` + RPC de alta, invitación, períodos y activación del Acuerdo + parámetro `modalidad_sin_culpa` (ADR-10) | db/migrations/0004_alta_hogar.sql | T006 en verde; salida esperada revisada y guardada | pendiente |
| T008 [P] | `packages/dominio/src/parametros.ts`: valores por defecto del Acuerdo con esquema zod y prueba, incluida `modalidad_sin_culpa` | packages/dominio/src/parametros.ts | parametros.test.ts | pendiente |
| T009 [P] | Generar tipos de la base en `packages/contratos` (`supabase gen types`) y script `pnpm gen:tipos` | packages/contratos/src/db.ts | typecheck | pendiente |
| T010 | App Expo: proyecto base con Expo Router, cliente Supabase con sesión en `expo-secure-store` (web: localStorage) | apps/movil/* | La app abre en web (prioridad del MVP, ADR-03); Android e iOS con Expo Go | pendiente |
| T011 | Pantalla de ingreso con OTP por correo | apps/movil/app/(auth)/ingresar.tsx | prueba de componente + prueba manual | pendiente |
| T012 | Asistente de alta: hogar e integrantes (RPC) | apps/movil/app/(alta)/* | prueba de integración contra Supabase local | pendiente |
| T013 | Consentimientos con texto versionado (`docs/legal/consentimiento-v1.md`) | apps/movil/app/(alta)/consentimientos.tsx, docs/legal/consentimiento-v1.md | prueba de componente | pendiente |
| T014 | Acuerdo v1: vista de parámetros, solicitud de firma al CAD, activación | apps/movil/app/(alta)/acuerdo.tsx | prueba de integración | pendiente |
| T015 | Portada vacía con siguiente paso | apps/movil/app/(tabs)/index.tsx | prueba de componente | pendiente |
| T016 | CI: workflow que corre pruebas de base y del monorepo | .github/workflows/ci.yml | CI en verde en el PR | pendiente |
| T017 | Desplegar: proyecto Supabase en sa-east-1, `supabase db push`, publicar la versión web en hosting estático (ADR-03) | docs/despliegue.md | Rodrigo inicia sesión en su teléfono | pendiente |

## Definición de terminado

- [ ] Todos los criterios de aceptación de la spec tienen prueba y están en verde.
- [ ] `db/run_tests.sh` y las pruebas del monorepo pasan en CI.
- [ ] `docs/trazabilidad.csv` actualizado.
- [ ] Estado de la spec cambiado a `implementada`.

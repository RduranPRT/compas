# Plan técnico · Spec 001 Base de la plataforma, hogar y acceso

Fecha: 2026-10-12 · Spec: `specs/001-base-plataforma/spec.md`

## Verificación contra la constitución

| Principio | Cómo se cumple |
| --- | --- |
| I1 Invariantes en la base | Alta de hogar e invitaciones por RPC `SECURITY DEFINER` que validan el JWT; RLS forzada en `gob.invitacion`. |
| I2 Libro inmutable | No se toca el libro. |
| I3 Dinero en enteros | No hay montos. |
| I4 Migraciones hacia adelante | Nueva `0004_alta_hogar.sql` con prueba `db/tests/0004_alta_hogar.sql`. |
| I5 Trazabilidad | Pruebas nombradas por escenario y regla (R25, R39). |
| I7 Privacidad | Consentimientos con texto versionado; menor solo con `datos_menor`. |
| P8 | La IA no participa. |

## Diseño

```
apps/movil (Expo Router)
  app/(auth)/ingresar.tsx       correo → código OTP (supabase.auth.signInWithOtp)
  app/(alta)/hogar.tsx          RPC app.crear_hogar
  app/(alta)/integrantes.tsx    RPC app.invitar_integrante
  app/(alta)/consentimientos.tsx  insert gob.consentimiento
  app/(alta)/acuerdo.tsx        insert acuerdo + regla_hogar, solicitud con firma del CAD
  app/(tabs)/index.tsx          portada vacía
  src/lib/supabase.ts           cliente con almacenamiento seguro de sesión (expo-secure-store)
packages/dominio/src/parametros.ts  valores por defecto del Acuerdo (tabla de la spec), tipados
packages/contratos/src/db.ts        tipos generados con `supabase gen types typescript`
supabase/
  config.toml                   proyecto local
  migrations/                   copia de db/migrations (script scripts/sync-migraciones.sh)
```

Flujo de alta: OTP → `aceptar_invitacion()` (si hay invitación pendiente para el correo) o pantalla "crear hogar" → integrantes → consentimientos → Acuerdo → portada.

Firma del Acuerdo: el ORG crea `acuerdo_hogar` en `borrador` y una `solicitud_aprobacion` tipo `acuerdo` con 1 firma requerida del CAD; al aprobarse, una función `app.activar_acuerdo(p_acuerdo uuid)` lo pasa a `vigente` y registra AcuerdoVersionado. Si el CAD aún no tiene cuenta, el ORG puede activar con `urgente = true` y queda pendiente la firma (se informa en la portada).

## Cambios de base de datos

`db/migrations/0004_alta_hogar.sql`:
- Tabla `gob.invitacion` con RLS (administradores del hogar).
- Agregar `modalidad_sin_culpa` (`igual` | `proporcional_ingreso` | `manual_por_adulto`) al CHECK de `gob.regla_hogar` (ADR-10) y definir cómo se guarda el monto por adulto en la modalidad manual.
- RPC `app.crear_hogar`, `app.invitar_integrante` (adultos), `app.registrar_menor` (hijos sin cuenta, D26), `app.aceptar_invitacion`, `app.crear_periodo`, `app.activar_acuerdo`.
- Cada RPC: `SECURITY DEFINER`, `SET search_path`, valida `app.jwt_sub()` y el rol; emite evento en `sys.evento_dominio`.

`db/tests/0004_alta_hogar.sql`: escenarios de la spec simulando JWT como en `0003_test_supabase_auth.sql`.

## Contratos

- Tipos generados de la base en `packages/contratos`.
- Esquema zod de `ParametrosAcuerdo` en `packages/dominio`.

## Estrategia de pruebas

| Criterio de aceptación | Tipo de prueba | Archivo |
| --- | --- | --- |
| Crear el hogar | SQL | db/tests/0004_alta_hogar.sql |
| Invitar a la co-administradora (R39) | SQL | db/tests/0004_alta_hogar.sql |
| Registrar a los hijos sin cuenta propia (R25, D26) | SQL | db/tests/0004_alta_hogar.sql |
| Aislamiento entre hogares | SQL (ya cubierto en 0003) + integración PostgREST | db/tests/0003…, apps/movil/test/aislamiento.test.ts |
| Firmar el Acuerdo v1 | SQL + unitaria de parámetros | db/tests/0004…, packages/dominio/src/parametros.test.ts |
| Consentimientos | Componente | apps/movil/test/consentimientos.test.tsx |

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| En Supabase el rol `postgres` no es superusuario y RLS forzada afecta a funciones `SECURITY DEFINER` | Tarea T005: ejecutar `db/run_tests.sh` contra `supabase start`; si falla, otorgar `BYPASSRLS` al dueño de las funciones o leer desde `app.membresia` (ya sin RLS). |
| Correos OTP llegan a spam | Configurar remitente en Supabase Auth; probar con los correos reales del hogar. |
| iOS sin cuenta Apple Developer | Usar la versión web instalada (ADR-03). |

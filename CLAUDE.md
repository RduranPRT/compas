# CLAUDE.md — instrucciones para Claude Code en el repositorio Compás

Compás es una app móvil de finanzas para el hogar Durán Damann (pareja con hijos menores, Chile). Se desarrolla con Spec-Driven Development: primero la spec, después el plan, las tareas y el código. El dueño del producto es Rodrigo (ingeniero informático, rol funcional; revisa specs y prueba en el teléfono).

## Lee antes de trabajar

1. `.specify/memory/constitution.md` — manda sobre todo lo demás.
2. `docs/metodo/metodo-compas-v2.md` — glosario, procesos, reglas R01–R45, eventos, estados.
3. `docs/decisiones-hogar.md` — decisiones del piloto y calendario.
4. `docs/adr/` — arquitectura.
5. La spec en la que trabajas: `specs/NNN-*/spec.md` (y su `plan.md` y `tasks.md` si existen).

## Flujo de trabajo

Comandos (skills en `.claude/skills/`, funcionan en terminal, escritorio y web):

| Comando | Para qué |
| --- | --- |
| `/siguiente` | Qué toca ahora según la hoja de ruta |
| `/especificar <idea>` | Crear o actualizar una spec |
| `/planificar NNN` | Plan técnico de una spec aprobada |
| `/tareas NNN` | Tareas pequeñas desde el plan |
| `/implementar NNN` | Implementar tarea por tarea con pruebas |
| `/verificar NNN` | Comprobar cobertura, pruebas y trazabilidad |
| `/ajustar <observación>` | Convertir lo visto en la marcha blanca en un cambio trazado |

No implementes nada que no esté en una spec aprobada. Si la spec es ambigua, pregunta; no inventes reglas de negocio.

## Stack (ADR-03, ADR-04, ADR-09)

- Monorepo pnpm: `apps/movil` (Expo + Expo Router + TypeScript), `packages/dominio` (reglas puras), `packages/contratos` (tipos y esquemas zod), `supabase/` (config, funciones, migraciones).
- Base de datos: PostgreSQL (Supabase). Fuente de verdad del esquema: `db/migrations/` en orden numérico; `supabase/migrations/` se genera copiándolas.
- Servidor: Supabase Edge Functions (Deno/TypeScript). IA: Claude API solo desde Edge Functions.
- Pruebas: Vitest en TypeScript; `db/run_tests.sh` para la base (compara con `db/tests/esperado/`).

## Reglas que no se rompen

- **Dinero**: pesos chilenos enteros (`bigint` en SQL, `number` entero validado o `bigint` en TS). Nunca `float` para montos. UF y moneda extranjera guardan monto original y valor de conversión.
- **Saldos de sobre**: solo desde `plan.libro_sobre` (vista `plan.v_saldo_sobre`). No se escribe el libro directamente; lo hacen los triggers. Correcciones con asientos de signo contrario.
- **Migraciones**: nunca edites una migración existente. Crea `db/migrations/NNNN_<slug>.sql`, su prueba `db/tests/NNNN_<slug>.sql` y regenera la salida esperada con `ACTUALIZAR=1 ./db/run_tests.sh` solo después de revisar que la salida es correcta.
- **IA**: propone, nunca aprueba, asigna, reasigna, firma ni imputa a Futuro, emergencia o deudas (R36, P8). Cada texto o propuesta guarda `regla_codigo`. Antes de cada llamada, `minimizar()` (sin RUT, cuentas completas, correos, teléfonos ni nombres de menores). Sin consentimiento `analitica_ia` vigente no se llama a la IA.
- **Privacidad**: datos de menores solo para administradores (R25). Cartolas en bucket privado, borradas a los 30 días (R43). Nunca registres montos ni glosas en logs de servidor.
- **Seguridad**: toda tabla nueva con `hogar_id`, RLS habilitada y forzada, política `p_hogar` y restricciones por rol. La app usa solo la clave anónima y el JWT del usuario; `service_role` nunca sale del servidor.
- **Mensajes al usuario**: en español de Chile, sin culpa (R16): hecho, regla y opción. Formato de montos `$12.345` (punto de miles, sin decimales).
- **Fechas**: zona horaria `America/Santiago`. Fecha contable = fecha de compra (D07).

## Convenciones

- Nombres del dominio en español, iguales a la base: `sobre`, `movimiento`, `imputacion`, `porAsignar`. Código técnico genérico puede ir en inglés.
- Funciones de reglas: `packages/dominio/src/reglas/rNN_<nombre>.ts`, exportan una función pura y su prueba `rNN_<nombre>.test.ts` cita la regla en el nombre del caso.
- Commits en español con la spec y la regla: `feat(003): lector CSV BancoEstado [R41]`, `fix(008): reserva de tarjeta en reembolso [R44]`.
- Al terminar una spec, actualiza `docs/trazabilidad.csv` (regla → spec → implementación → prueba).

## Comandos útiles

```bash
pnpm install
pnpm -r test            # pruebas del monorepo
pnpm -r typecheck
supabase start          # base local con Docker
./db/run_tests.sh       # pruebas de invariantes (PGHOST/PGUSER apuntando a la base local)
pnpm --filter movil start
```

## Marcha blanca

La app está en uso real desde que la spec 005 queda implementada. Prioriza no perder datos: cualquier cambio que toque movimientos, sobres o el libro lleva prueba de base de datos. Las observaciones de uso entran por `/ajustar` y quedan en `docs/bitacora-marcha-blanca.md`.

# ADR-09 · Backend y hosting

Estado: Aceptada · 24-10-2026 (propuesta 12-10-2026) · Brechas: G40, G46, G47 · Decisión del hogar: tope USD 25 al mes

## Contexto

El modelo de datos está en PostgreSQL 16 con RLS, triggers e invariantes probadas. Se necesita autenticación, almacenamiento de archivos (cartolas), funciones de servidor (IA, lectores, indicadores) y tareas programadas, con el menor costo y mantenimiento posible.

## Decisión

**Supabase**, región São Paulo (`sa-east-1`, la más cercana a Chile):

| Necesidad | Componente |
| --- | --- |
| Base de datos | Postgres gestionado; migraciones de `db/migrations` aplicadas con `supabase db push` |
| Autenticación | Supabase Auth con correo (enlace mágico o código). Las cuentas de los menores las crea el ORG. La migración 0003 traduce el JWT a hogar, integrante y rol. |
| API | PostgREST sobre los esquemas de negocio, protegido por RLS. Operaciones con varias escrituras (asignar ingreso, confirmar lote) como funciones RPC en SQL. |
| Archivos | Storage, bucket privado `cartolas` con ruta `{hogar_id}/{importacion_id}`; borrado a los 30 días (R43). |
| Funciones | Edge Functions (Deno/TypeScript): `ia-clasificar`, `ia-chat`, `ia-perfil`, `cartola-leer`, `indicadores`, `retencion`. |
| Tareas | `pg_cron`: indicadores 09:00, resumen de alertas 20:00, purga diaria, cambio de estado del presupuesto el día 1. |

Plan: **Free** durante la marcha blanca (500 MB de base, 1 GB de archivos; el proyecto se pausa tras una semana sin actividad, lo que el uso diario evita). Respaldo semanal con `pg_dump` a un archivo privado mientras se esté en Free. Pasar a **Pro (USD 25 al mes)** cuando la app sea de uso crítico o antes del 1 de diciembre si se quiere respaldo diario gestionado; en ese caso el tope del hogar se revisa con Rodrigo porque Pro + Apple + IA lo supera.

Roles de base de datos:
- `authenticated` (Supabase) hereda `compas_app`.
- Edge Functions de IA se conectan con un usuario de login miembro de `compas_ia`.
- Jobs con un usuario miembro de `compas_sistema`.
- `service_role` solo para administración, nunca desde la app.

## Alternativas consideradas

| Opción | Por qué no |
| --- | --- |
| Servidor propio (Fly.io, Railway) + Postgres | Más piezas que mantener (auth, archivos, cron) para un desarrollador. |
| Firebase | No es PostgreSQL; perdería el modelo y las invariantes ya probadas. |
| Nhost, Appwrite o PocketBase | Nhost usa GraphQL (Hasura); Appwrite y PocketBase son menos maduros y PocketBase usa SQLite. Supabase es el más maduro sobre PostgreSQL. |
| Neon + Clerk + Vercel | Tres proveedores y tres cuentas para lo que Supabase da junto. |

## Consecuencias

- Los datos quedan en Brasil: debe decirse en el texto del consentimiento `uso_app` (Ley 21.719, transferencia internacional).
- Verificar en el primer despliegue que las funciones `SECURITY DEFINER` de 0001–0003 se comporten igual en Supabase, donde el rol `postgres` no es superusuario (tarea T005 de la spec 001).

## Cómo verificar

Spec 001: `db/run_tests.sh` pasa contra la base local de `supabase start`; dos usuarios de hogares distintos no se ven entre sí a través de PostgREST.

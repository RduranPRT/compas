# Plan técnico · Spec NNN <nombre>

Fecha: AAAA-MM-DD · Spec: `specs/NNN-<slug>/spec.md`

## Verificación contra la constitución

| Principio | Cómo se cumple |
| --- | --- |
| I1 Invariantes en la base | |
| I2 Libro inmutable | |
| I3 Dinero en enteros | |
| I4 Migraciones hacia adelante | |
| I5 Trazabilidad | |
| I7 Privacidad | |
| P8 La IA propone, personas aprueban | |

## Diseño

- Componentes que cambian (app, dominio, contratos, funciones, base).
- Flujo de datos de punta a punta.
- Decisiones locales y por qué (si alguna merece ADR, crearla).

## Cambios de base de datos

Migración `db/migrations/NNNN_<slug>.sql` y prueba `db/tests/NNNN_<slug>.sql` (si aplica).

## Contratos

Tipos, RPC, esquemas zod, eventos.

## Estrategia de pruebas

| Criterio de aceptación | Tipo de prueba | Archivo |
| --- | --- | --- |

## Riesgos

| Riesgo | Mitigación |
| --- | --- |

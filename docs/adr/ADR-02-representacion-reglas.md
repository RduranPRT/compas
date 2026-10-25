# ADR-02 · Representación de reglas

Estado: Aceptada · 24-10-2026 (propuesta 12-10-2026) · Brechas: G38

## Contexto

El método tiene 45 reglas con niveles de precedencia y parámetros que la familia ajusta en el Acuerdo del Hogar. Algunas protegen el dinero y nunca deben romperse; otras calculan propuestas; otras definen tono y frecuencia de mensajes.

## Decisión

Tres capas, según qué protege cada regla:

1. **Invariantes en PostgreSQL** (nivel 1–3 de precedencia y toda regla de integridad): triggers, restricciones y RLS. Ejemplos: R01, R11, R25, R26–R29, R34–R37, R41–R44. Ya implementadas en `db/migrations` y probadas en `db/tests`.
2. **Paquete de dominio en TypeScript** (`packages/dominio`): funciones puras, una por regla de cálculo, con nombre `rNN_descripcion` (por ejemplo `r03_aporteProrrateado`, `r04_ordenFlujo`, `r09_ritmo`). Reciben datos y parámetros y devuelven resultados más la cita de la regla. Sin I/O. Cada función tiene pruebas unitarias con los ejemplos de su spec.
3. **Parámetros en `gob.regla_hogar`**: valores del Acuerdo vigente, leídos con `app.parametro()` en SQL y con un lector tipado en TypeScript. Valores por defecto en `packages/dominio/src/parametros.ts`.

La precedencia se aplica en el orquestador de cada proceso (por ejemplo, el generador del plan aplica R05 antes que R04).

## Alternativas consideradas

| Opción | Por qué no |
| --- | --- |
| Motor de reglas genérico (DMN, json-rules-engine) | Agrega un intérprete y un lenguaje para 45 reglas que el equipo puede leer como código; dificulta las pruebas de dinero. |
| Todo en la base de datos | La lógica de propuestas (plan, distribución, perfil) es más clara y probable en TypeScript, y se reutiliza en el cliente offline. |
| Todo en la app | La IA y la app podrían saltarse invariantes; viola la constitución (I1). |

## Consecuencias

- `docs/trazabilidad.csv` indica la capa de cada regla.
- Cambiar un parámetro no requiere desplegar código; cambiar una regla sí, con su spec.
- El dominio puede ejecutarse en el teléfono (validaciones offline) y en Edge Functions.

## Cómo verificar

CI ejecuta `db/run_tests.sh` y las pruebas de `packages/dominio`. Cada regla de la capa 2 tiene al menos un caso de prueba que cita su código.

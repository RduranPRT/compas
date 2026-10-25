# ADR-10 · Modalidad del sin culpa

Estado: Aceptada · 24-10-2026 · Decisiones: D06, D23, D25

## Contexto

Con pozo común total (D23) todo el ingreso va al fondo común y cada adulto recibe un monto sin culpa de libre uso. Falta definir cómo se calcula ese monto entre los adultos.

## Decisión

La modalidad es un **parámetro del Acuerdo del Hogar**, elegido al definir el plan familiar (ADR-02, capa 3):

| `modalidad_sin_culpa` | Cálculo |
| --- | --- |
| `igual` (por defecto) | El mismo monto para cada adulto: `pct_sin_culpa` del ingreso del hogar repartido en partes iguales, o `monto_sin_culpa_clp`. |
| `proporcional_ingreso` | Cada adulto recibe en proporción a su ingreso. |
| `manual_por_adulto` | Monto fijo por adulto definido en el Acuerdo. |

Implementación:
- Base de datos: agregar `modalidad_sin_culpa` al CHECK de `gob.regla_hogar` en la migración 0004 (spec 001).
- Dominio: el cálculo vive en `packages/dominio` y se prueba con un caso por modalidad.

## Consecuencias

- Cambiar de modalidad es una nueva versión del Acuerdo, con firma (no requiere desplegar código).
- Con `manual_por_adulto` hay que guardar un monto por integrante; la forma exacta del valor (por ejemplo, un objeto `{integrante_id: monto}` en `monto_sin_culpa_clp`) se define en el plan de la spec 001.

## Cómo verificar

Prueba unitaria por modalidad con dos adultos de ingresos distintos; prueba SQL de que `modalidad_sin_culpa` se acepta en `gob.regla_hogar`.

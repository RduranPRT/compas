# ADR-05 · Regla de aporte por defecto

Estado: Aceptada · 24-10-2026 (propuesta 12-10-2026) · Brechas: G42

> **Nota 24-10-2026:** en la sesión de esta fecha se aprobó como "ADR-05" el aporte de los adultos al fondo común (pozo común total, D23) y la modalidad del sin culpa, que quedó registrada en [ADR-10](ADR-10-modalidad-sin-culpa.md). El aporte lineal R03 de esta ADR se aprobó después en la misma sesión.

## Contexto

Los fondos prorrateados (gastos verdaderos irregulares y metas) necesitan un aporte mensual. Hay variantes: lineal, escalonado o porcentaje del ingreso.

## Decisión

Aporte lineal (R03): `aporte = ceil((monto_objetivo − saldo) / meses_restantes)`, en pesos enteros.

- Si `saldo ≥ monto_objetivo`: aporte 0 y se ofrece liberar el excedente.
- Si `meses_restantes = 0` y falta dinero: alerta `fondo_insuficiente`.
- El fondo de emergencia no tiene fecha: su aporte sale del orden de la etapa (E1: hasta 1 mes de esenciales; E3: hasta 3–6 meses).

Implementación: `packages/dominio/src/reglas/r03_aporteProrrateado.ts`.

## Alternativas consideradas

Porcentaje fijo del ingreso (más simple, pero no garantiza llegar a la fecha); escalonado (más complejo de explicar a la familia).

## Consecuencias

El aporte sube si se atrasa un mes; la IA lo explica citando R03.

## Cómo verificar

Casos de prueba: (900.000, 0, 6) → 150.000; (900.000, 900.000, 3) → 0; (100.000, 10.000, 0) → alerta.

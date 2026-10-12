# ADR-06 · Estrategia de deuda por defecto

Estado: Propuesta · 12-10-2026 · Brechas: G43

## Contexto

R21 compara bola de nieve (menor saldo primero) y avalancha (mayor tasa primero). El hogar piloto usa tarjeta de crédito sin cuotas habituales y paga el total, por lo que la gestión de deudas (EP11) queda fuera del MVP.

## Decisión

- Valor por defecto del parámetro `estrategia_deuda`: **avalancha**, porque minimiza el costo total.
- La interfaz siempre muestra el costo total de ambas estrategias y la familia elige (R21).
- Implementación en V2 (EP11). En el MVP solo se registran deudas existentes y cuotas (spec 005 y 008).

## Consecuencias

Si el perfil inicial detecta deuda de consumo (intereses o cuotas en los estados de cuenta), la retroalimentación lo señala y se adelanta EP11.

## Cómo verificar

Cuando se implemente EP11: dos deudas de ejemplo con tasas distintas producen órdenes distintos y el costo total de avalancha es menor o igual.

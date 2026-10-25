# Spec 008 · Ciclo de la tarjeta de crédito

Estado: aprobada (delegada a Claude Code, D29, 25-10-2026) · Fecha: 2026-10-12 · Épica: EP02, EP07
Procesos: S1, P4, P2 · Reglas: R26, R27, R34, R44 · Decisiones: D07, D08, D24 · Depende de: 005

## Objetivo

Como la tarjeta es el medio de pago principal, que el hogar sepa en todo momento cuánto debe pagar a fin de mes y que ese dinero ya esté apartado: cada compra con tarjeta sale de su categoría y queda reservada para pagar la tarjeta.

## Historias de usuario

- **HU-008-1** Como administradores, queremos ver por tarjeta: gastado del ciclo, facturado, reservado y fecha de pago.
- **HU-008-2** Como organizador, quiero registrar el pago de la tarjeta (o que venga de la cartola) sin que cuente como gasto.
- **HU-008-3** Como organizador, quiero que la deuda que la tarjeta traía al 1 de octubre quede cubierta en el primer mes.
- **HU-008-4** Como co-administradora, quiero cuadrar el estado de cuenta contra lo registrado.

## Criterios de aceptación

```gherkin
Característica: Tarjeta de crédito (R27, R44, R34)

  Escenario: Compra con tarjeta reserva el pago (R44)
    Dado Alimentación con $300.000 asignados
    Cuando se confirma una compra de $100.000 con la Visa
    Entonces Alimentación queda en $200.000
    Y el sobre Pago Visa del período queda en $100.000

  Escenario: Pago de la tarjeta (R27)
    Cuando se registra un pago de $100.000 desde la cuenta corriente a la Visa
    Entonces Pago Visa baja a $0
    Y ningún sobre de categoría cambia
    Y el pago no cuenta como gasto en K4 ni K6

  Escenario: Deuda previa al piloto
    Dado la Visa con saldo inicial −$420.000 al 2026-10-01
    Cuando se registra el pago de $420.000 en octubre
    Entonces Pago Visa de octubre queda en −$420.000
    Y en línea base se muestra como "deuda previa al piloto" sin alertas
    Y desde el primer plan, el borrador propone cubrir el saldo negativo de Pago Visa antes que Vida

  Escenario: Reembolso con tarjeta
    Cuando se devuelve $15.000 de una compra con la Visa
    Entonces la categoría recupera $15.000 y Pago Visa baja $15.000

  Escenario: Cuotas siguen su mes (D08, R26)
    Dado una compra de $300.000 en 3 cuotas por_cuota
    Entonces cada mes la reserva de Pago Visa sube solo $100.000

  Escenario: Conciliación con el estado de cuenta (R34)
    Dado un estado de cuenta importado con facturado $512.300
    Cuando lo registrado del ciclo suma $509.800
    Entonces se muestra la diferencia de $2.500 y las líneas no calzadas
    Y cerrar el ciclo con diferencia exige un ajuste con motivo

  Escenario: Aviso de pago por vencer
    Dado el día de pago 5
    Cuando faltan 3 días
    Entonces se avisa el monto facturado y si la reserva alcanza
```

## Reglas y cálculos

- Ciclo: compras desde el día de facturación del mes anterior + 1 hasta el día de facturación; vence el día de pago del mes siguiente.
- Reservado = saldo del sobre de pago de la tarjeta (libro: `reserva_tarjeta` − `pago_tarjeta`).
- Ya implementado en base de datos: `plan.contabilizar` (reserva por período de cada imputación) y `fin.contabilizar_pago_tarjeta` (migración 0002, pruebas P6–P9 y P15).

## Datos

`fin.cuenta` (tipo tarjeta), `plan.sobre` (tipo pago_tarjeta, `cuenta_id`), `fin.transferencia` (tipo pago_tarjeta), `fin.conciliacion`, `fin.importacion`.

## Interfaz

Tarjeta "Visa" en portada: "Debes pagar $X el 5 de diciembre · Apartado $Y". Detalle del ciclo con compras y estado de conciliación.

## IA

No interviene (salvo clasificación de líneas importadas, spec 003).

## Eventos

PagoTarjetaRegistrado, PagoPorVencer.

## Fuera de alcance

Avances en efectivo, compras en moneda extranjera (R32), intereses por pago mínimo (se registran como gasto en categoría "Comisiones e intereses").

## Decisiones de la Beta (D29; 25-10-2026)

- La tarjeta muestra: deuda total (saldo inicial más compras, menos devoluciones y pagos), apartado (suma de sus sobres de pago de tarjeta), compras del ciclo en curso y fecha del próximo pago.
- `app.registrar_pago_tarjeta` crea la transferencia hecha; la base consume la reserva (R27, R44).
- La conciliación con el estado de cuenta usa `app.conciliar_cuenta`, compartida con el cierre semanal (spec 010).

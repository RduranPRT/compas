# Spec 007 · Ingresos y distribución del día de pago

Estado: aprobada (delegada a Claude Code, D29, 25-10-2026) · Fecha: 2026-10-12 · Épica: EP05
Procesos: P3 · Reglas: R01, R02, R04, R13, R22, R33, R45 · Decisiones: D01, D02, D03, D04, D05, D22, D23 · Depende de: 006

## Objetivo

Cuando llega un sueldo o un bono, repartirlo en minutos según el plan y la etapa, y dejar la lista de transferencias que el hogar hace en su banco (la app no mueve dinero).

## Historias de usuario

- **HU-007-1** Como integrante con ingresos, quiero informar que me llegó el sueldo (o que lo detecte la cartola).
- **HU-007-2** Como organizador, quiero una propuesta de reparto en el orden de nuestra etapa y confirmarla de una vez.
- **HU-007-3** Como organizador, cuando llega un bono quiero que una parte vaya a Futuro según lo acordado.
- **HU-007-4** Como adultos, queremos ver la transferencia de nuestro sin culpa como tarea pendiente.

## Criterios de aceptación

```gherkin
Característica: Distribución del ingreso (R01, R04, R22, R45)

  Escenario: Sueldo con plan aprobado
    Dado el plan de diciembre aprobado y un sueldo base de $2.400.000 recibido el 30 de noviembre
    Cuando se registra con para_mes_siguiente (D01)
    Entonces entra a Por asignar de diciembre
    Y la IA propone asignaciones en el orden de la etapa
    Y al confirmar el ORG, Por asignar queda en 0 (R02)

  Escenario: Ingreso antes del plan (D02)
    Dado que el plan del mes no está aprobado
    Cuando llega un ingreso
    Entonces queda en Por asignar hasta que se apruebe el plan

  Escenario: Ingreso variable (R45, R22)
    Dado pct_variable_a_futuro = 50
    Cuando llega un bono de $600.000 marcado como variable
    Entonces se propone $300.000 a Futuro y el resto según etapa (D04)
    Y no se dispara ajuste del plan (R33 solo compara ingreso base)

  Escenario: No se asigna más de lo recibido (R01)
    Cuando se intenta asignar $1 más de lo que hay en Por asignar
    Entonces se rechaza

  Escenario: Reponer emergencia primero (R13)
    Dado que en el mes se usó el fondo de emergencia
    Cuando llega un ingreso en E1–E3
    Entonces la propuesta repone emergencia antes que Futuro de largo plazo

  Escenario: Tareas de transferencia
    Cuando se confirma la distribución
    Entonces se crean transferencias pendientes (sin culpa a cuentas personales, aportes a cuenta de ahorro)
    Y a las 72 h sin marcar se recuerda una vez
```

## Datos

`fin.movimiento` (tipo ingreso), `fin.ingreso` (`es_variable`, `para_mes_siguiente`, `diferencia_pct`), `plan.asignacion`, `fin.transferencia`. RPC `app.confirmar_distribucion(p_ingreso uuid, p_asignaciones jsonb)` transaccional.

## Interfaz

Pantalla "Llegó un ingreso": monto, quién, base o variable; propuesta en el orden 1→5 con montos editables; botón "Confirmar reparto"; lista de transferencias con check.

## IA

La propuesta la calcula el dominio (`r04_ordenFlujo`, `r22_reajuste`, `r45_variable`); la IA solo redacta una frase explicativa.

## Eventos

IngresoRecibido, IngresoAsignado, TransferenciaPendiente.

## Fuera de alcance

Transferencias reales desde la app.

## Decisiones de la Beta (D29; 25-10-2026)

- La propuesta de reparto la calcula `proponerDistribucion` (dominio) con las líneas del plan aprobado menos lo ya asignado. Sin plan aprobado, el ingreso queda en Por asignar (D02) y la pantalla lo explica.
- `app.confirmar_distribucion` inserta las asignaciones (R01 lo valida la base) y crea transferencias pendientes: sin culpa → `a_personal`; Futuro, emergencia y fondos → `aporte_fondo` a la primera cuenta de ahorro o inversión, si existe.
- El recordatorio a las 72 h es una alerta del control diario (spec 009).

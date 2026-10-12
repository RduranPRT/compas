# Spec 009 · Control, alertas y reasignación N1

Estado: borrador · Fecha: 2026-10-12 · Épica: EP08, EP09
Procesos: P5, P6 (N1, N2 manual) · Reglas: R09, R10, R11, R12, R16, R37, R38, R40 · Decisiones: D13, D14 · Depende de: 006, 008

## Objetivo

Avisar a tiempo y sin culpa cuando un sobre va rápido o queda negativo, y permitir corregirlo moviendo dinero entre sobres en dos toques.

## Historias de usuario

- **HU-009-1** Como co-administradora, quiero saber cuando un sobre variable va más rápido de lo planeado.
- **HU-009-2** Como integrante, quiero que un sobre negativo me ofrezca de dónde cubrirlo.
- **HU-009-3** Como hogar, no queremos más de 3 avisos al día por persona.
- **HU-009-4** Como organizador, quiero saber si el mes va a cerrar en negativo.

## Criterios de aceptación

```gherkin
Característica: Control y N1 (R09, R10, R12, R38, R40)

  Escenario: Ritmo excedido (R09)
    Dado Alimentación con $400.000 asignados y $200.000 gastados el día 12 de un mes de 30 días
    Cuando corre el control
    Entonces el ritmo es 1,25 y se emite RitmoExcedido con mensaje sin culpa (R16)

  Escenario: Sobre negativo y N1 (R10)
    Cuando Ocio queda en −$8.000
    Entonces se propone cubrirlo desde sobres de Vida u otros esenciales con saldo
    Y nunca se propone tomar de Futuro o emergencia sin doble firma (R37)

  Escenario: Autoaprobación bajo umbral (R38)
    Dado autoaprobacion_n1_pct = 5
    Cuando se mueven $8.000 desde un sobre de $200.000
    Entonces la reasignación se aplica sin aprobación y queda registrada

  Escenario: Sobre el umbral pide aprobación del CAD
    Cuando se mueven $30.000 desde un sobre de $200.000
    Entonces se crea una solicitud para el CAD

  Escenario: Balance proyectado negativo (R12)
    Cuando el pronóstico de fin de mes es negativo
    Entonces se abre N2 para el ORG con propuesta de recortes en Vida y sin culpa

  Escenario: Tope diario (R40)
    Dado que una persona ya recibió 3 alertas hoy
    Cuando se genera una cuarta
    Entonces va al resumen de las 20:00

  Escenario: Línea base sin alertas
    Dado una fecha anterior a mes_primer_plan
    Cuando corre el control
    Entonces no se emiten alertas de ritmo ni de sobre negativo
```

## Datos

`plan.v_ritmo_sobre`, `med.alerta`, `med.evento_recuperacion`, `plan.reasignacion`, `gob.solicitud_aprobacion`. Job `pg_cron` diario 20:00 (`app.control_diario()`).

## Interfaz

Portada con ritmo del mes; notificaciones push; pantalla "Cubrir sobre" con orígenes sugeridos.

## Eventos

RitmoExcedido, SobreNegativo, DesvioDetectado, RecuperacionIniciada, RecuperacionCerrada.

## Fuera de alcance

N3 y N4 automáticos (se registran a mano), abandono detectado (V2).

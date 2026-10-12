# Spec 006 · Plan mensual base cero

Estado: borrador · Fecha: 2026-10-12 · Épica: EP04
Procesos: P2, P2-A, S3 · Reglas: R01, R03, R04, R05, R06, R07, R08, R20, R26, R33, R39, R44, R45 · Decisiones: D03, D09, D21, D22, ADR-02, ADR-05 · Depende de: 004, 005

## Objetivo

Que el día 25 los administradores reciban un borrador de presupuesto base cero para el mes siguiente, armado con el perfil y la historia, lo ajusten y lo aprueben antes del día 1. El primero es el de diciembre de 2026.

## Historias de usuario

- **HU-006-1** Como organizador, quiero un borrador del plan con cada peso asignado y la razón de cada línea.
- **HU-006-2** Como co-administradora, quiero ajustar montos y ver al instante el semáforo 50/30/20.
- **HU-006-3** Como organizador, quiero aprobar el plan y que, si no respondo en 48 h, decida mi suplente.
- **HU-006-4** Como administradores, cuando el sueldo llega distinto a lo esperado, queremos una propuesta de ajuste.

## Criterios de aceptación

```gherkin
Característica: Plan mensual (R01, R04, R06, R07, R33, R39, R45)

  Escenario: Borrador base cero
    Dado el día 25 de noviembre de 2026 y mes_primer_plan = 2026-12-01
    Cuando se genera el borrador de diciembre
    Entonces la suma de líneas es igual al ingreso base proyectado (R45)
    Y cada línea tiene regla y explicación (P8)
    Y los pagos fijos nuevos o en UF llevan holgura de 15 % (R08)
    Y los fondos tienen aporte R03
    Y las cuotas preasignadas del mes están incluidas (R26)
    Y el sobre de pago de cada tarjeta incluye lo facturado pendiente de pago (R44)
    Y cada adulto tiene su sin culpa

  Escenario: Orden de la etapa (R04, R05)
    Dado un hogar en E1
    Cuando se arma el borrador
    Entonces se cubren primero pagos fijos, luego emergencia hasta 1 mes de esenciales, luego mínimos de deudas, sobres y sin culpa

  Escenario: Semáforo (R06, R07)
    Cuando Esenciales supera 50 % del ingreso
    Entonces el bloque se muestra en rojo con la regla R06
    Y el plan se puede aprobar igual (semáforo, no bloqueo)

  Escenario: No se aprueba descuadrado (R01)
    Dado un borrador cuyas líneas suman distinto del ingreso proyectado
    Cuando el ORG intenta aprobar
    Entonces se rechaza indicando la diferencia y "Por asignar" muestra el monto que falta o sobra

  Escenario: Suplencia (R39)
    Dado un borrador enviado a aprobación el 25
    Cuando el ORG no responde en 48 h
    Entonces el CAD puede aprobarlo como suplente y queda registrado como_suplente

  Escenario: Ajuste por ingreso distinto (R33, D03)
    Dado un plan aprobado con ingreso base de $2.400.000
    Cuando llega un sueldo de $2.200.000 (−8,3 %)
    Entonces se propone la versión 2 con recortes en orden inverso: sin culpa, Vida, fondos no críticos
    Y nunca se recortan Cuatro Paredes (R05)

  Escenario: Arrastre al nuevo mes (R20)
    Dado noviembre cerrado con Alimentación en +$30.000 y Ocio en −$10.000
    Cuando se arma diciembre
    Entonces Alimentación arrastra +$30.000 y Por asignar de diciembre descuenta $10.000
```

## Reglas y cálculos

Implementación en `packages/dominio/src/plan/` con una función por regla (ADR-02). El orquestador `generarBorrador(datos, parametros)` aplica precedencia: R05 > R13 > R04 > R03/R08 > R06/R07 (solo informan).

## Datos

`plan.presupuesto_mensual`, `plan.linea_plan`, `plan.sobre`, `plan.programacion_flujo`, `gob.solicitud_aprobacion`, `gob.firma`, `plan.v_bloques_periodo`. Migración nueva para el arrastre (`tipo = 'arrastre'` en el libro al abrir el período, ejecutado por función `app.abrir_periodo`).

## Interfaz

Pantalla "Plan de diciembre": bloques con semáforo arriba, lista de sobres editable, "Por asignar" fijo abajo, botón "Enviar a aprobación". Referencia: wireframes v2, P2.

## IA

`ia-plan` (modelo mayor) solo redacta la explicación general y hasta 3 sugerencias; los montos los calcula el dominio. Sugerencias en `ia.recomendacion`.

## Eventos

PresupuestoAprobado, AcuerdoVersionado (si cambian parámetros).

## Fuera de alcance

Plan de deudas (EP11), metas de largo plazo con inversión.

## Preguntas abiertas

Ninguna.

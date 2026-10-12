# Spec 010 · Cierres semanal y mensual, KPI y línea base

Estado: borrador · Fecha: 2026-10-12 · Épica: EP10, EP12
Procesos: P7, S1 · Reglas: R19, R20, R23, R34, P5 · Decisiones: D14, D15, D16, D20, D21, ADR-08 · Depende de: 003, 005 (línea base); 006–009 (cierre con plan)

## Objetivo

Cerrar cada semana en 15 minutos y cada mes en 45, con las cuentas cuadradas, la valoración de la familia y los indicadores calculados. Los cierres de octubre y noviembre establecen la línea base.

## Historias de usuario

- **HU-010-1** Como co-administradora, el domingo quiero cuadrar las cuentas y despejar pendientes.
- **HU-010-2** Como familia, a fin de mes queremos valorar cada categoría (+/0/−) y responder las preguntas Kakeibo.
- **HU-010-3** Como organizador, quiero ver los indicadores del mes y la comparación con la línea base.
- **HU-010-4** Como administradores, queremos que la IA nos proponga el cambio de etapa si corresponde.

## Criterios de aceptación

```gherkin
Característica: Cierres (R19, R20, R34)

  Escenario: Cierre semanal (R34)
    Dado el domingo
    Cuando el CAD ingresa el saldo real de cada cuenta
    Entonces se compara con lo registrado y las diferencias exigen ajuste con motivo
    Y los movimientos de la semana pasan a conciliados
    Y se registra SemanaCerrada

  Escenario: Cierre mensual de línea base (octubre)
    Dado octubre sin presupuesto
    Cuando el ORG cierra octubre tras importar todas las cartolas del mes
    Entonces se calcula K1, K3, K4, K6 y KP1 con lo real
    Y la familia valora cada categoría
    Y el período queda cerrado como línea base

  Escenario: Cierre mensual con plan
    Dado diciembre con plan aprobado
    Cuando se cierra
    Entonces se calculan arrastres (R20), KPI e ICF
    Y la IA redacta un resumen con 1 a 3 recomendaciones con regla y fuente
    Y se propone avance o retroceso de etapa si se cumplen los criterios (R23, D15)

  Escenario: Importar estado de cuenta antes de cerrar (ADR-08)
    Dado una tarjeta sin estado de cuenta importado para el ciclo
    Cuando se intenta cerrar el mes
    Entonces se pide importarlo o justificar la omisión

  Escenario: Reapertura (D20)
    Cuando un administrador reabre noviembre con motivo
    Entonces se pueden corregir movimientos y al cerrar se recalculan KPI dejando la versión anterior
```

## Datos

`med.cierre`, `med.reflexion`, `med.medicion_kpi`, `fin.conciliacion`, `plan.periodo`, `gob.historial_etapa`, `gob.reunion`.

## Interfaz

Asistente de cierre semanal (4 pasos) y mensual (5 pasos), pantalla de indicadores con comparación contra línea base.

## IA

`ia-resumen` (modelo mayor): entrada = KPI y variaciones; salida = resumen y recomendaciones con regla y fuente.

## Eventos

SemanaCerrada, MesCerrado, EtapaPropuesta.

## Fuera de alcance

Reunión mensual con agenda guiada en la app (se registra el acta simple).

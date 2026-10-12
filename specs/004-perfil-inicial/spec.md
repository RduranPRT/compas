# Spec 004 · Perfil inicial y retroalimentación

Estado: borrador · Fecha: 2026-10-12 · Épica: EP16 (nueva)
Procesos: P1 (pasos 4–6) · Reglas: R06, R07, R16, R23, R41, R43, R45, P8 · Decisiones: D21, D22, ADR-04 · Depende de: 003

## Objetivo

Que el hogar vea, en una pantalla, cómo ha manejado su dinero los últimos meses y reciba de 3 a 5 hallazgos concretos con su regla, para tomar decisiones informadas en el primer plan y confirmar su etapa.

## Historias de usuario

- **HU-004-1** Como administradores, queremos un diagnóstico de julio a septiembre: cuánto entra, en qué se va, qué es fijo y cómo usamos la tarjeta.
- **HU-004-2** Como administradores, queremos hallazgos sin culpa y accionables, cada uno con la regla que lo sustenta.
- **HU-004-3** Como organizador, quiero que lo detectado (ingresos base, pagos fijos, suscripciones, gastos anuales) se precargue para no escribirlo a mano.
- **HU-004-4** Como administradores, queremos confirmar la etapa del hogar con la evidencia a la vista.

## Criterios de aceptación

```gherkin
Característica: Perfil inicial (R23, R45, P8)

  Escenario: Generar el perfil con tres meses de historia
    Dado movimientos históricos revisados de julio, agosto y septiembre de 2026
    Cuando el ORG pide generar el perfil
    Entonces se crea perfil_inicial versión 1 en estado presentado
    Y contiene ingreso base, ingreso variable, gasto por categoría y bloque, pagos fijos, suscripciones, gastos irregulares, uso de tarjeta, K1, K3, K4, K6 y etapa sugerida

  Escenario: Ingreso base y variable (R45)
    Dado abonos de sueldo de $2.400.000, $2.400.000 y $2.450.000 y un bono de $600.000 en agosto
    Cuando se calcula el perfil
    Entonces el ingreso base mensual es la mediana de los abonos recurrentes: $2.400.000
    Y el ingreso variable promedio es $200.000 al mes

  Escenario: Pago fijo detectado
    Dado cargos de "ENEL" en los tres meses con montos que varían menos de 20 %
    Cuando se calcula el perfil
    Entonces ENEL aparece como pago fijo de Servicios con su monto promedio y día típico

  Escenario: Uso de la tarjeta
    Dado estados de cuenta de la Visa con facturado y pagado por mes
    Cuando se calcula el perfil
    Entonces el perfil indica si se paga el total facturado cada mes
    Y suma intereses y comisiones del período

  Escenario: Semáforo 50/30/20 real (R06, R07)
    Cuando el gasto en Esenciales es 58 % del ingreso
    Entonces el perfil marca Esenciales en rojo citando R06

  Escenario: Retroalimentación con regla y fuente (P8, R16)
    Cuando la IA redacta la retroalimentación
    Entonces hay entre 3 y 5 hallazgos
    Y cada hallazgo tiene título, explicación, cifra que lo respalda, regla, fuente y una acción propuesta
    Y ningún hallazgo usa lenguaje de culpa ni juicio

  Escenario: Las cifras las calcula el sistema, no la IA
    Cuando se presenta el perfil
    Entonces todas las cifras vienen del cálculo determinista del paquete de dominio
    Y la IA solo redacta texto a partir de esas cifras

  Escenario: Etapa sugerida y confirmación (R23)
    Dado que el perfil sugiere E1 porque la reserva cubre 0,4 meses de esenciales
    Cuando ORG y CAD confirman
    Entonces se registra la etapa E1 en historial_etapa con la evidencia del perfil
    Y la etapa del hogar pasa a E1

  Escenario: Precarga de ingresos, pagos fijos y fondos
    Cuando el ORG acepta el perfil
    Entonces se proponen ingresos esperados (base y variable), pagos fijos y fondos de gastos anuales
    Y cada propuesta se puede aceptar, editar o descartar una por una

  Escenario: Sin consentimiento de IA
    Dado que un administrador no otorgó analitica_ia
    Cuando se genera el perfil
    Entonces se muestran las cifras y la etapa sugerida por reglas, sin texto redactado por IA
```

## Reglas y cálculos (paquete `packages/dominio/src/perfil/`)

| Métrica | Cálculo |
| --- | --- |
| Ingreso base | Mediana mensual de abonos recurrentes (mismo origen en ≥ 2 de 3 meses, variación < 10 %) |
| Ingreso variable | Promedio mensual de abonos no recurrentes clasificados como ingreso |
| Gasto por categoría | Promedio mensual de cargos clasificados como gasto, por categoría y bloque |
| Pagos fijos | Mismo comercio en ≥ 2 de 3 meses con variación < 20 % |
| Suscripciones | Pagos fijos ≤ $30.000 de servicios digitales |
| Gastos irregulares | Cargos únicos ≥ 50 % del gasto mensual promedio de su categoría → candidatos a fondo prorrateado (R03) |
| Uso de tarjeta | Facturado vs pagado por mes; paga total si pagado ≥ 98 % del facturado |
| K1 | Abonos a cuentas de ahorro o inversión / ingreso |
| K3 | Cuotas de deudas e intereses / ingreso |
| K4 | Gasto Esenciales / ingreso |
| K6 | Ingresos − gastos (sin transferencias internas ni pagos de tarjeta) |
| K2 estimado | Saldo de ahorro declarado / esenciales mensuales |
| Etapa sugerida | E0 si hay intereses de mora o pagos esenciales atrasados; E1 si K2 < 1; E2 si hay deuda de consumo; E3 si K2 < 3; E4 en otro caso |

## Datos

`fin.movimiento_historico` (y movimientos confirmados de octubre si existen), `med.perfil_inicial`, `gob.historial_etapa`, `gob.solicitud_aprobacion`, `ia.recomendacion`.

## Interfaz

Pantalla "Tu punto de partida": tarjeta de ingresos, gráfico de bloques con semáforo, lista de fijos, uso de tarjeta, hallazgos (expandibles con regla y fuente), etapa sugerida con evidencia y botón "Confirmar etapa" (requiere ambos administradores).

## IA

`ia-perfil` (modelo mayor): entrada = métricas calculadas (sin glosas ni nombres) + reglas aplicables; salida `{hallazgos: [{titulo, explicacion, cifra, regla_codigo, fuente_codigo, accion}]}` validada con zod; 3 a 5 elementos. Cada hallazgo se guarda en `ia.recomendacion`.

## Eventos

PerfilInicialGenerado, EtapaPropuesta, EtapaConfirmada.

## Fuera de alcance

Recomendaciones de inversión, comparación con otros hogares.

## Preguntas abiertas

- [POR ACLARAR] ¿Hay ahorros o inversiones fuera de las cuentas registradas que deban contar para K2 (fondo de emergencia)?

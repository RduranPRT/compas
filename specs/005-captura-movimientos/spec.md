# Spec 005 · Captura y clasificación de movimientos

Estado: aprobada (delegada a Claude Code, D29, 25-10-2026) · Fecha: 2026-10-12 · Épica: EP06
Procesos: P4 · Reglas: R11, R16, R17, R18, R26, R29, R35, R36, R44 · Decisiones: D07, D08, D10, D11, D12, ADR-01, ADR-04 · Depende de: 002

## Objetivo

Registrar cada gasto en menos de 10 segundos, por formulario o por chat, con la intención inferida, y dejar que el CAD confirme por excepción. Con esta spec la app entra en marcha blanca.

## Historias de usuario

- **HU-005-1** Como integrante, quiero anotar un gasto con monto y sobre en dos toques.
- **HU-005-2** Como integrante, quiero escribir "12 lucas feria con débito" y que la app lo entienda.
- **HU-005-3** Como co-administradora, quiero una bandeja con lo que falta confirmar y los posibles duplicados.
- **HU-005-4** Como hijo, quiero anotar lo que gasto de mi mesada.
- **HU-005-5** Como integrante, quiero capturar sin conexión y que se sincronice después.
- **HU-005-6** Como integrante, cuando compro en cuotas quiero elegir si se descuenta todo ahora o cuota a cuota.

## Criterios de aceptación

```gherkin
Característica: Captura de movimientos (R17, R26, R35, R36, D11)

  Escenario: Captura rápida
    Cuando un integrante registra $12.990 en Alimentación con la Visa
    Entonces el movimiento queda con fecha de hoy, medio Visa e intención supervivencia por defecto de la categoría (R17)
    Y si la confianza es ≥ 0,8 queda confirmado; si no, por confirmar (R36)

  Escenario: Captura por chat
    Cuando el integrante escribe "gasté 12 lucas en la feria con débito"
    Entonces la IA propone monto 12000, sobre Alimentación, cuenta corriente, intención supervivencia
    Y el integrante confirma o corrige en la misma pantalla
    Y la respuesta muestra el costo en horas de vida si el integrante tiene horas_mes (R18)

  Escenario: Compra en cuotas, cada cuota en su mes (R26, D08, R44)
    Cuando se registra una compra de $300.000 en 3 cuotas con la Visa y tratamiento por_cuota
    Entonces el gasto se imputa $100.000 al sobre de la categoría en cada uno de los 3 meses de facturación
    Y el sobre de pago de Visa de cada mes reserva $100.000
    Y se crea una deuda tipo compra_cuotas con sus 3 cuotas para calcular la carga financiera (K3)
    Y si el período de un mes futuro no existe, se crea con sus sobres

  Escenario: Compra en cuotas, total al comprar (D08)
    Cuando se registra la misma compra con tratamiento total
    Entonces el sobre descuenta $300.000 en el mes de compra y no se crea deuda

  Escenario: Duplicado candidato (R35)
    Dado un gasto de $12.990 con la Visa el 2026-11-03
    Cuando se registra otro de $12.990 con la Visa el 2026-11-04
    Entonces queda por confirmar y aparece en la bandeja como posible duplicado

  Escenario: Gasto en sobre cerrado (R11)
    Dado el sobre Ocio cerrado
    Cuando se registra un gasto en Ocio
    Entonces se imputa igual y se abre una reasignación N1 (spec 009)

  Escenario: Reembolso (R29)
    Cuando se registra una devolución de $15.000 asociada a una compra de Vestuario
    Entonces vuelve al sobre de Vestuario

  Escenario: Menor registra en su mesada
    Dado un menor autenticado
    Cuando registra $3.000
    Entonces solo puede imputarlo a su sobre de mesada

  Escenario: Captura sin conexión (D11)
    Dado un teléfono sin conexión
    Cuando se registran dos gastos
    Entonces se guardan en la cola local y al reconectar se crean una sola vez cada uno

  Escenario: Línea base sin alertas
    Dado la fecha anterior a mes_primer_plan
    Cuando un sobre sin asignación recibe gastos
    Entonces se muestra lo gastado, pero no se emiten SobreNegativo ni alertas de ritmo

  Escenario: Bandeja del CAD
    Cuando el CAD abre la bandeja
    Entonces ve los movimientos por confirmar ordenados por antigüedad y los duplicados candidatos
    Y puede confirmar, corregir o descartar cada uno o en lote
```

## Reglas y cálculos

- Campos mínimos: monto y sobre. El medio de pago por defecto es el último usado por el integrante.
- Intención por defecto: la de la categoría; editable (R17).
- Horas de vida (R18): monto / (ingreso base del integrante / horas_mes).
- Cuotas: `tratamiento_cuotas_default` del Acuerdo, editable por compra.

## Datos

`fin.movimiento`, `fin.imputacion`, `fin.deuda`, `fin.cuota_deuda`, `fin.duplicado_candidato`, `ia.inferencia`, `sys.operacion_cliente`. RPC `app.registrar_gasto(...)` que crea movimiento e imputaciones en una transacción e idempotente por `cliente_op_id`.

## Interfaz

Botón "+" persistente; teclado numérico primero, luego sobres frecuentes; pestaña "Chat"; bandeja del CAD con contador. Referencia: wireframes v2, pantallas P4.

## IA

`ia-chat` (modelo liviano): entrada = frase minimizada + sobres y cuentas del integrante; salida `{intent, monto, sobre_id, cuenta_id, fecha, intencion, n_cuotas, confianza}` validada. Nunca propone sobres de Futuro, emergencia o cuota como imputación automática (R36).

## Eventos

GastoRegistrado, MovimientoPorConfirmar, DuplicadoCandidato, SobreNegativo (solo desde mes_primer_plan).

## Fuera de alcance

Foto de boleta, gasto compartido con terceros (R30), moneda extranjera (R32), dictado por voz.

## Preguntas abiertas

Ninguna.

## Decisiones de la Beta (D26, D29, D31, D32; 25-10-2026)

- Los hijos no inician sesión (D26): el escenario "Menor registra en su mesada" lo cumple un adulto que registra en el sobre de mesada del hijo; la RLS de menores sigue vigente.
- La captura manual (sin IA) queda confirmada al instante; la confianza solo aplica a lo que propone la IA (R36).
- La pestaña "Chat" interpreta la frase con reglas en el dispositivo ("12 lucas", "$12.990", "feria", "con débito") y, si hay IA disponible y consentimiento, con `ia-chat` (D31). Siempre muestra la propuesta para confirmar antes de guardar.
- Cuotas por_cuota (D32): la cuota 1 cae en el mes de compra; el monto se reparte en cuotas enteras y la última absorbe el resto.
- Sin conexión (D11): la cola local guarda las capturas con `cliente_op_id`; `app.registrar_gasto` es idempotente por ese identificador.
- RPC: `app.registrar_gasto`, `app.registrar_ingreso`, `app.registrar_reembolso`, `app.confirmar_movimiento`, `app.descartar_movimiento`, `app.resolver_duplicado`.

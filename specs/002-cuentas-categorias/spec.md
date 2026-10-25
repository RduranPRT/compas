# Spec 002 · Cuentas, tarjetas, categorías y sobres del período

Estado: aprobada (delegada a Claude Code, D29, 25-10-2026) · Fecha: 2026-10-12 · Épica: EP02, EP03
Procesos: P1 (paso 2 y 5), S1, S3 · Reglas: R05, R28, R31, R44 · Decisiones: D05, D06, D17, D23, D24 · Depende de: 001

## Objetivo

Dejar registradas las cuentas y tarjetas del hogar con su saldo al 1 de octubre, las categorías del hogar y los sobres de cada período, para que los movimientos importados o capturados tengan dónde caer.

## Historias de usuario

- **HU-002-1** Como organizador, quiero registrar cuentas corrientes, cuentas vista, ahorro, efectivo y tarjetas de crédito con su saldo al inicio del piloto.
- **HU-002-2** Como organizador, quiero partir de categorías sugeridas y ajustarlas a nuestra realidad.
- **HU-002-3** Como administradores, queremos que cada período tenga sus sobres creados automáticamente, incluido el sin culpa de cada adulto y la mesada de cada hijo.
- **HU-002-4** Como organizador, quiero declarar ingresos típicos (base y variable) y pagos fijos para que el plan los use.

## Criterios de aceptación

```gherkin
Característica: Cuentas, categorías y sobres (S1, R31, R44, D23)

  Escenario: Registrar una tarjeta de crédito
    Dado un hogar con Acuerdo vigente
    Cuando el ORG registra la tarjeta "Visa" con día de facturación 25, día de pago 5, cupo y últimos 4 dígitos
    Entonces la cuenta queda de tipo tarjeta_credito y del fondo común (D23)
    Y nunca se guarda el número completo de la tarjeta

  Escenario: Saldo inicial al inicio del piloto
    Dado una cuenta corriente con saldo de $850.000 al 2026-10-01
    Cuando el ORG registra la cuenta
    Entonces fecha_saldo_inicial es 2026-10-01 y saldo_inicial es 850000

  Escenario: Deuda inicial de tarjeta
    Dado la Visa con $420.000 facturados en septiembre y no pagados al 2026-10-01
    Cuando el ORG registra la tarjeta con saldo inicial adeudado de $420.000
    Entonces saldo_inicial queda en -420000
    Y el sistema lo usa en la spec 008 para cubrir ese pago (R44)

  Escenario: Efectivo como billetera (R31)
    Cuando el ORG activa "Efectivo"
    Entonces se crea una cuenta tipo billetera que se concilia semanalmente

  Escenario: Categorías desde plantilla
    Dado un hogar nuevo
    Cuando el ORG acepta la plantilla de categorías
    Entonces se crean las 13 categorías con su bloque, tipo de sobre e intención por defecto
    Y Alimentación, Vivienda, Servicios y Transporte quedan marcadas como Cuatro Paredes (R05)
    Y el ORG puede renombrar, desactivar o agregar categorías

  Escenario: Sobres del período
    Dado las categorías activas, dos adultos y dos menores
    Cuando se crea o abre el período de noviembre de 2026
    Entonces existe un sobre por categoría activa
    Y un sobre sin culpa por cada adulto y un sobre de mesada por cada menor (D06, D17)
    Y un sobre de pago de tarjeta por cada tarjeta activa (R44)
    Y crear los sobres dos veces no los duplica

  Escenario: Ingresos típicos base y variable (R45)
    Cuando el ORG declara "Sueldo Rodrigo" $X mensual día 30 como base
    Y "Bono variable" como variable
    Entonces el plan futuro usará solo los ingresos base para proyectar
```

## Reglas y cálculos

- Tipos de cuenta: vista, ahorro, billetera, tarjeta_credito, inversion. Tarjeta exige día de facturación y día de pago.
- Todas las cuentas registradas son fondo común (D23). Las cuentas personales no se registran; el sin culpa se transfiere a ellas (D05).
- Saldo inicial de tarjeta: negativo = deuda facturada pendiente al inicio del piloto.

## Datos

- `fin.cuenta`, `plan.categoria`, `plan.sobre`, `plan.ingreso_esperado` (columna `es_base`), `plan.pago_fijo`.
- RPC nueva `app.crear_sobres_periodo(p_periodo uuid)` idempotente (migración nueva).
- RPC `app.aplicar_plantilla_categorias()`.

## Interfaz

- Paso "Cuentas" del alta: lista, alta rápida (nombre, tipo, institución, últimos 4, saldo al 1-10).
- Paso "Categorías": plantilla editable agrupada por bloque.
- Pantalla "Ingresos y pagos fijos" con base/variable (también se precarga desde el perfil inicial, spec 004).

## IA

No interviene.

## Eventos

Ninguno nuevo.

## Fuera de alcance

Fondos y metas con aportes (spec 006), deudas con plan de pago (EP11), cuentas en moneda extranjera.

## Preguntas abiertas

- Resuelta 24-10-2026: bancos Santander e Itaú (cuentas y tarjetas de crédito); cartolas descargables en Excel.

## Decisiones de la Beta (D29, 25-10-2026)

- La plantilla suma **Vestuario** (Vida, variable, deseo) y **Comisiones e intereses** (Esenciales, variable, imprevisto), que usan las specs 005 y 008: quedan 15 categorías.
- Los sobres del período los crea `app.asegurar_periodo(p_mes date)`, idempotente; también la llaman las RPC de captura cuando el mes aún no existe. Las categorías `sin_culpa` y `mesada` generan un sobre por adulto o por hijo; `fondo` genera uno por fondo activo; `cuota` (deudas) no genera sobres en el MVP (EP11).
- Después del Acuerdo, la portada muestra la lista "Configura tu hogar": cuentas y tarjetas, categorías, ingresos y pagos fijos, cartolas y perfil inicial. Cada paso se puede retomar desde "Más".
- Solo los administradores registran cuentas, categorías, ingresos esperados y pagos fijos (RLS restrictiva).

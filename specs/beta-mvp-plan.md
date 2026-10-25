# Plan técnico de la Beta del MVP · Specs 002–011

Fecha: 2026-10-25 · Decisión: D29 (Beta delegada) · Specs: 002 a 011 (aprobadas por delegación)

Este plan reúne el diseño común a las specs 002–011. Cada spec tiene su `tasks.md` con las tareas, archivos y pruebas que la cierran.

## Verificación contra la constitución

| Principio | Cómo se cumple |
| --- | --- |
| I1 Invariantes en la base | Toda escritura de dinero pasa por RPC `SECURITY DEFINER` que validan JWT, rol y hogar; los triggers existentes (R01, R36, R37, R41, R42, R44, base cero, período cerrado) siguen siendo la última barrera. |
| I2 Libro inmutable | Ninguna RPC escribe `plan.libro_sobre`; los asientos salen de los triggers. Arrastre (R20) con asientos de signo contrario. |
| I3 Dinero en enteros | `bigint` en SQL; en TypeScript `number` entero validado con zod (`montoClp`). |
| I4 Migraciones hacia adelante | 0006–0015, una por spec, cada una con su prueba en `db/tests/` y salida esperada. |
| I5 Trazabilidad | Pruebas nombradas por escenario y regla; `docs/trazabilidad.csv` al cierre. |
| I7 Privacidad | Cartolas procesadas en el dispositivo, sin subir el archivo (D30); `minimizar()` antes de toda llamada a la IA; menores solo para administradores. |
| P8 | La IA solo propone (sugerencias, textos); confirmar, asignar, aprobar y firmar son RPC que exigen una persona. |

## Arquitectura

```
packages/dominio/src/
  dinero.ts                montoClp (zod), redondeos, reparto en cuotas (D32)
  fechas.ts                meses, días hábiles simples, zona America/Santiago
  minimizar.ts             R43: RUT, cuentas, correos, teléfonos, nombres de menores
  cartola/                 tabla → LineaCartola (mapeo asistido), huella, clase por reglas, comercio
  frase.ts                 intérprete de frases de captura ("12 lucas feria con débito")
  reglas/rNN_*.ts          una función pura por regla (R03, R04, R05, R06, R07, R08, R09, R12, R13, R18, R20, R22, R33, R35, R38, R45)
  perfil/                  métricas del perfil inicial, etapa sugerida y hallazgos por reglas
  plan/                    generarBorrador (base cero) y proponerDistribucion
  kpi.ts                   K1, K2, K3, K4, K6, KP1, ICF
packages/contratos/src/
  db.ts                    tipos generados
  ia.ts                    esquemas zod de entrada y salida de cada función de IA
apps/movil/
  app/(tabs)/              Inicio · Sobres · Movimientos · Más (barra visible) y botón "+"
  app/<pantalla>.tsx       rutas de stack: registrar, bandeja, cuentas, categorias, ingresos-fijos,
                           cartolas, revisar/[id], perfil, plan, distribuir, tarjeta/[id], cubrir/[id],
                           aprobaciones, cierre-semanal, cierre-mensual, indicadores, privacidad, avisos
  src/datos/*.ts           acceso a Supabase (RPC y lecturas), un archivo por área
  src/pantallas/*.tsx      componentes puros con props (probados con Testing Library)
  src/lib/cola.ts          cola local de capturas sin conexión (D11)
supabase/functions/
  _compartido/             cliente Claude, consentimiento, validación zod
  ia-extraer-cartola, ia-clasificar, ia-chat, ia-texto   (responden 503 si no hay ANTHROPIC_API_KEY)
db/migrations/
  0006_cuentas_sobres      plantilla 15, asegurar_periodo, crear_sobres_periodo, RLS de configuración
  0007_captura             registrar_gasto/ingreso/reembolso, confirmar, descartar, duplicados (R11, R26, R29, R35)
  0008_importacion         tipo transferencia, regla_comercio, importar_cartola, clasificar_comercio (R27, R28, R41–R43)
  0009_perfil_etapa        guardar_perfil, proponer_etapa, confirmación con firmas (R23)
  0010_tarjeta             registrar_pago_tarjeta, v_saldo_cuenta, conciliar_cuenta (R27, R34, R44)
  0011_plan                guardar_borrador_plan, enviar_plan, aprobar_plan, abrir_periodo con arrastre (R20, R39)
  0012_distribucion        confirmar_distribucion, transferencias pendientes (R01, R04)
  0013_control             emitir_alerta, reasignar, resolver_solicitud, control_diario + pg_cron (R09–R12, R37–R40)
  0014_cierres             cerrar_semana, cerrar_mes, reabrir_periodo (R19, R20, R34, D20)
  0015_privacidad          revocar consentimiento, solicitar borrado, purgar_hogares (R25, D19)
```

## Navegación y UX

- Cuatro pestañas visibles: **Inicio** (lo urgente: avisos, pendientes, Por asignar, tarjetas, ritmo del mes, lista "Configura tu hogar"), **Sobres** (saldo de cada sobre del mes, con "Cubrir" en los negativos), **Movimientos** (lista con filtro y bandeja de pendientes) y **Más** (configuración, cartolas, perfil, plan, cierres, aprobaciones, privacidad, salir).
- Botón "+" fijo en Inicio, Sobres y Movimientos: abre la captura con el teclado numérico primero y los sobres frecuentes después (≤ 10 s, HU-005-1).
- Mensajes sin culpa (R16): hecho, regla y opción. Montos con `formatoPesos` ($12.345).
- Cada pantalla muestra estados vacíos que dicen qué hacer, y errores de red con opción de reintentar.

## Pruebas

- Base: una prueba SQL por migración con los escenarios Gherkin de su spec (JWT simulado como en 0005).
- Dominio: Vitest, una prueba por regla que cita la regla en el nombre del caso.
- Pantallas: Testing Library sobre los componentes puros.
- Integración: flujo diario contra Supabase local (captura, importación, plan, distribución, cierre).

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Sin clave de Claude todavía | Respaldo por reglas en todas las funciones (D31); las funciones de IA responden 503 y la app sigue. |
| Datos reales en producción | Solo migraciones nuevas; cada una se prueba en una base nueva y en la local con datos antes de `db push`. |
| Volumen de pantallas | Componentes puros pequeños sobre un kit de UI común; prioridad 002 → 005 → 003 → 004 → 008 → 006 → 007 → 009 → 010 → 011. |

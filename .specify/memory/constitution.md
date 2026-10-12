# Constitución de Compás

Versión 1.0 · 12-10-2026 · Proyecto Compás (app de finanzas del hogar)

Este documento manda sobre todas las specs, planes y tareas. Si una spec contradice la constitución, se corrige la spec. Cambiarla requiere una ADR y la aprobación de Rodrigo.

## Lema

Automatiza el ahorro, haz consciente el gasto y decide en familia.

## Principios del método (P1–P8)

| Código | Principio | Qué significa para el código |
| --- | --- | --- |
| P1 | Cada peso tiene una tarea | Presupuesto base cero: la suma de líneas del plan es igual al ingreso proyectado; el dinero real solo se asigna cuando se recibe (R01). |
| P2 | Primero el futuro, en automático | El flujo del día de pago se propone en el orden de la etapa (R04); Futuro va primero desde E3. |
| P3 | 50/30/20 como semáforo | Los bloques Esenciales ≤ 50 %, Futuro ≥ 20 %, Vida ≤ 30 % se muestran como semáforo, nunca bloquean (R06, R07). |
| P4 | Una prioridad a la vez según etapa | La etapa E0–E5 decide destinos y mínimos; la IA propone cambios de etapa y las personas confirman (R23). |
| P5 | El gasto se mide en vida y valores | Intención del gasto, valoración +/0/− y horas de vida aparecen en captura y cierre (R17–R19). |
| P6 | Un desvío se corrige, no se castiga | Escalera N1–N4 y mensajes sin culpa: describen hecho, regla y opción, nunca juicio (R16). |
| P7 | Se decide en familia con reglas explícitas | Toda regla configurable vive en el Acuerdo del Hogar versionado; aprobaciones con suplencia a 48 h y doble firma para Futuro (R37, R39). |
| P8 | Toda recomendación cita su regla y fuente; la IA propone, solo personas aprueban | Ninguna ruta de código permite que la IA apruebe, mueva dinero o impute a Futuro, emergencia o deudas. Cada texto de la IA lleva `regla_codigo`. |

## Niveles de precedencia de reglas

Si dos reglas aplican al mismo caso, gana el nivel menor.

1. Legal y privacidad (Ley 21.719, datos de menores)
2. Integridad de datos (libro de sobres, cuadratura, corte del piloto)
3. Seguridad del hogar (Cuatro Paredes, fondo de emergencia, doble firma)
4. Acuerdo del Hogar (parámetros elegidos por la familia)
5. Método (base cero, semáforo, aportes)
6. Experiencia (alertas, mensajes, tono)

## Principios de ingeniería (I1–I10)

- **I1. La base de datos guarda las invariantes.** Lo que nunca debe romperse (R01, R36, R37, cuadratura, período cerrado, libro inmutable, aislamiento por hogar) se impone con triggers, restricciones y RLS en PostgreSQL. La app y la IA pueden fallar; la base no deja pasar el error.
- **I2. Libro inmutable.** Los saldos de sobre salen solo de `plan.libro_sobre`. Nunca se actualiza ni se borra un asiento; se corrige con asientos de signo contrario.
- **I3. Dinero en pesos enteros.** CLP como `bigint`. UF y moneda extranjera guardan monto original y valor de conversión. Nada de `float` para dinero en ningún lenguaje.
- **I4. Migraciones hacia adelante.** Una migración aplicada no se edita. Todo cambio de esquema es una migración nueva con sus pruebas en `db/tests` y su salida esperada.
- **I5. Trazabilidad.** Cada spec cita procesos (P1–P7, S1–S6), reglas (R01–R45) y decisiones (D01–D20, ADR). Cada prueba de aceptación nombra la regla que verifica. `docs/trazabilidad.csv` se actualiza en el mismo cambio.
- **I6. Especificación antes que código.** No se implementa nada sin `spec.md` aprobada; el plan y las tareas se derivan de ella. Si al implementar aparece una ambigüedad, se marca `[POR ACLARAR]` en la spec y se pregunta.
- **I7. Privacidad por diseño.** Minimización antes de cualquier llamada a la IA (sin RUT, sin números de cuenta completos, sin nombres de menores). Documentos de cartola se purgan a los 30 días (R43). Datos de menores solo para administradores (R25).
- **I8. Pruebas que fallan primero.** Cada criterio de aceptación tiene una prueba automática. Las reglas de dinero se prueban en SQL; la lógica de dominio en TypeScript con pruebas unitarias; los flujos con pruebas de integración.
- **I9. Simple para un hogar.** El MVP sirve a un hogar real en marcha blanca. Se prefiere lo simple y verificable a lo escalable en teoría. Presupuesto de operación ≤ USD 25 al mes.
- **I10. Idioma.** Interfaz, documentación, mensajes de commit y nombres del dominio en español (igual que la base de datos). Identificadores técnicos genéricos pueden ir en inglés.

## Gobierno del kit

- Dueño del producto y aprobador de specs: Rodrigo.
- Una spec pasa de `borrador` a `aprobada` cuando Rodrigo la aprueba; de `aprobada` a `implementada` cuando sus pruebas están en verde en CI.
- Las decisiones de arquitectura viven en `docs/adr/`. Una ADR `aceptada` solo se cambia con otra ADR que la reemplace.

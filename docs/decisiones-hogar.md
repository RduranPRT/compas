# Decisiones del hogar piloto — 12-10-2026

Respuestas de Rodrigo a las 10 preguntas abiertas de la Fase 2 y requisito nuevo EP16. Cierran las brechas indicadas.

## Respuestas

| # | Pregunta | Decisión | Consecuencia en el diseño | Brechas |
| --- | --- | --- | --- | --- |
| 1 | ¿Solo para el hogar o producto? | Solo el hogar Durán Damann ahora; producto en V2 | Multi-hogar con RLS se mantiene. Registro público, términos y cobro fuera del MVP. Privacidad diseñada como si hubiera terceros. | G61, G35 |
| 2 | Integrantes y roles | Pareja con hijos menores | Roles ORG, CAD y MEN. Menores con cuenta propia y consentimiento parental (R25). Sin asesor. | G62 |
| 3 | Teléfonos | iOS y Android | ADR-03: Expo (React Native) multiplataforma. | G39 |
| 4 | Uso de tarjeta de crédito | Medio principal, sin cuotas habituales | Ciclo de tarjeta en el núcleo del MVP (R44, spec 008). | G07 |
| 5 | Tipos de ingreso | Sueldo más componente variable | Plan con ingreso base; variable como extra (R45, D22). | G13 |
| 6 | Aporte al fondo común | Pozo común total | Todas las cuentas registradas son fondo común; sin culpa por adulto (D23). | G14 |
| 7 | Tope de hosting e IA | Hasta USD 25 al mes | Supabase plan gratuito en marcha blanca; IA liviana (ADR-04, ADR-09). | G40, G41 |
| 8 | IA alojada fuera de Chile | Sí, con datos minimizados | Consentimiento `analitica_ia` obligatorio; filtro de minimización (ADR-04). | G36 |
| 9 | Tratamiento de cuotas | Elegir en cada compra | `fin.movimiento.tratamiento_cuotas`; por defecto cada cuota en su mes (D08 ajustada). | G08 |
| 10 | Horas y fecha del piloto | Más de 20 h por semana; piloto desde el 1-10-2026 con datos retroactivos | Octubre y noviembre como línea base desde cartolas; primer plan 1-12-2026 (D21). | G63, G64 |

## Requisito nuevo EP16 — Diagnóstico inicial desde cartolas

Pedido de Rodrigo: el sistema debe permitir cargar cartolas bancarias para que la IA analice el comportamiento previo, arme un perfil inicial y entregue retroalimentación para construir el plan.

- Entradas: cartolas de cuenta corriente o vista y estados de cuenta de tarjeta, en PDF, CSV o XLSX. Tres meses previos (julio a septiembre de 2026) más los meses desde octubre.
- Uso doble: perfil inicial con los meses previos (histórico, R41) y carga retroactiva del piloto desde el 1 de octubre (movimientos por confirmar, R42).
- Privacidad: documento original eliminado a los 30 días; minimización antes de la IA (R43).
- Specs: 003 (importación) y 004 (perfil inicial).

## Calendario

| Período | Trabajo | Resultado |
| --- | --- | --- |
| 12 oct | Kit SDD, ADR, migraciones 0002–0003 probadas | Repositorio listo para Claude Code |
| 13–18 oct | Specs 001 y 002 | Base, autenticación, hogar, cuentas y categorías operativos |
| 19–30 oct | Specs 003, 004 y 005 | **Marcha blanca v0:** cartolas cargadas, perfil inicial, captura diaria |
| 2–20 nov | Specs 006, 007 y 008 | Plan, distribución de ingresos y ciclo de tarjeta |
| 21–30 nov | Specs 009, 010 y 011 | Alertas, N1, cierres y privacidad; app lista para el primer plan |
| 1 dic | Primer presupuesto real | Operación con plan; entra en vigencia la Ley 21.719 |

## Decisiones de arquitectura — 24-10-2026

| ADR | Decisión | Estado |
| --- | --- | --- |
| 01 | Chat dentro de la app; motor Claude por API (clave la entrega Rodrigo, como secreto de Supabase) | Aceptada |
| 02 | Reglas en tres capas: triggers en PostgreSQL, paquete TypeScript y parámetros del Acuerdo | Aceptada |
| 03 | Expo con **MVP primero en web**; iOS y Android después desde el mismo código | Aceptada |
| 04 | Claude por API con datos minimizados: Haiku para chat y clasificación, Sonnet para perfil y resúmenes | Aceptada |
| 05 | Aporte lineal R03 a fondos y metas | Aceptada |
| 06 | Estrategia de deuda | Postergada a V2 |
| 07 | Indicadores: CMF principal, mindicador.cl respaldo | Aceptada |
| 08 | Lectura de correos de compra | Postergada a V2 |
| 09 | Supabase, plan gratuito en marcha blanca con respaldo propio; Pro al ser producto | Aceptada |
| 10 | Modalidad del sin culpa parametrizable (D25) | Aceptada |

Respuestas a las preguntas de las specs (24-10-2026):

| Spec | Pregunta | Decisión |
| --- | --- | --- |
| 001 | Acceso de los hijos | Sin cuenta propia en el MVP; toda la información la ingresan los padres (D26). |
| 001 | Cantidad y nombres de los hijos | Parametrizable; se ingresa en el levantamiento de información del alta. |
| 002/003 | Bancos y tarjetas | Santander e Itaú, cartolas en Excel. |
| 003 | Lectores por banco | No se construyen: la IA transforma cualquier formato a LineaCartola (D27). |
| 004 | Ahorros fuera de las cuentas | No en el MVP. |

Calendario: la spec 001 aún no se implementa (estaba planificada para el 13 al 18 de octubre); el calendario se ajusta al retomar la Fase 3.

## Pendiente del hogar

- Descargar en Excel las cartolas y estados de cuenta de julio a octubre de Santander e Itaú.
- Anotar gastos en efectivo desde el 1 de octubre.
- Registrarse en la API de la CMF para obtener la clave de indicadores (ADR-07).
- Entregar la clave de la API de Claude cuando se implemente la primera función de IA (ADR-04).

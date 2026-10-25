# Método Compás v2 — fuente única para el desarrollo

Versión 2.1 · 12-10-2026

Este documento consolida la Fase 1 (Método Compás) y la Fase 2 (Diseño del proceso ajustado v2, Modelo de base de datos v2, Estado de brechas y Decisiones del 12-10-2026). Es la referencia de negocio para todas las specs. Si una spec y este documento difieren, se corrige la spec o se registra una decisión nueva aquí.

Fuentes metodológicas: You Need a Budget (YNAB), The Total Money Makeover (Ramsey), Your Money or Your Life (YMOYL), I Will Teach You to Be Rich (Sethi), All Your Worth (Warren, 50/30/20) y Kakeibo; más BCCh (carga financiera), FinHealth Score, Stanley y Danko, y Save More Tomorrow.

## 1. Glosario

| Término | Definición |
| --- | --- |
| Hogar | Unidad que administra su dinero en Compás. Todo dato pertenece a un hogar (`hogar_id`). |
| Integrante | Persona del hogar con un rol: ORG, CAD, ING, MEN o ASE. |
| Acuerdo del Hogar | Conjunto versionado de parámetros que la familia firma (día del plan, umbrales, sin culpa, etc.). |
| Etapa | Situación financiera del hogar, E0 a E5. Decide prioridades y orden del flujo del día de pago. |
| Período | Mes calendario presupuestario (D01). Estados: abierto, en cierre, cerrado, reabierto. |
| Presupuesto mensual | Plan *proyectado* del período, versionado. Base cero: Σ líneas = ingreso proyectado. |
| Sobre | Bolsa de dinero de una categoría en un período. Tipos: por asignar, próximo mes, fijo, variable, fondo, futuro, emergencia, cuota, sin culpa, mesada y pago de tarjeta. |
| Por asignar | Sobre especial donde entra todo ingreso confirmado antes de repartirse. |
| Asignación | Dinero real que pasa de Por asignar a un sobre; solo con dinero recibido (R01). |
| Reasignación | Movimiento de dinero entre sobres dentro del período (N1). |
| Imputación | Parte de un gasto cargada a un sobre. Σ imputaciones = monto del gasto. |
| Libro de sobres | Registro inmutable de asientos; los saldos se calculan desde aquí. |
| Bloque | Esenciales (≤ 50 %), Futuro (≥ 20 %), Vida (≤ 30 %). Semáforo, no regla de asignación. |
| Cuatro Paredes | Comida, vivienda, servicios básicos y transporte. Prioridad absoluta en E0 (R05). |
| Fondo prorrateado | Gasto verdadero irregular repartido en cuotas mensuales: aporte = (monto − saldo) / meses restantes (R03). |
| Sin culpa | Monto personal por adulto, de libre uso y detalle privado (D06). |
| Mesada | Sobre propio de un menor (D17). |
| Pago de tarjeta | Sobre por tarjeta de crédito que reserva lo gastado con ella para pagarla (R44). |
| Intención | Supervivencia, deseo, cultura o imprevisto (Kakeibo). |
| Ritmo | gastado / (asignado × días transcurridos / días del mes). Aplica a sobres variables (R09). |
| Ingreso base | Parte estable del ingreso (sueldo); con él se proyecta el plan (R45). |
| Ingreso variable | Bonos, comisiones, horas extra; entra como extra y se reparte con su propia regla (R45). |
| Línea base | Meses del piloto que se registran y clasifican sin presupuesto, para medir el punto de partida. |
| Cartola | Extracto de cuenta bancaria o estado de cuenta de tarjeta, en PDF, CSV o XLSX. |
| Perfil inicial | Diagnóstico generado desde cartolas: ingresos, gastos por bloque, fijos, uso de tarjeta, KPI y etapa sugerida. |
| Histórico | Movimientos anteriores al inicio del piloto. Solo alimentan el perfil (R41). |
| UF | Unidad de Fomento, unidad reajustable chilena. Se convierte al valor del día (R24). |
| RCI | Razón de carga financiera a ingreso (BCCh): > 25 % sin hipotecario o > 50 % con hipotecario = alta carga. |

## 2. Actores

| Código | Actor | Puede | No puede |
| --- | --- | --- | --- |
| ORG | Organizador/a | Aprobar plan, distribuir ingresos, decidir N2–N4, cambiar el Acuerdo con CAD | Retirar de Futuro sin doble firma |
| CAD | Co-administrador/a | Capturar y confirmar movimientos, aprobar N1, conciliar, suplir a ORG | Cambiar el Acuerdo solo |
| ING | Integrante con ingresos | Registrar, ver sobres comunes, gestionar su sin culpa | Aprobar plan o reasignaciones |
| MEN | Integrante menor | Ver y registrar en su mesada, ver su meta | Ver finanzas del hogar |
| ASE | Asesor externo | Leer, con vencimiento a 90 días | Modificar datos |
| IA | Asistente Compás | Inferir, proponer, resumir, alertar, explicar citando regla | Aprobar, mover dinero, imputar a Futuro, emergencia o deudas |
| SIS | Sistemas externos | Entregar datos (indicadores, notificaciones) | Escribir sin validación |

En el hogar piloto: pareja con hijos menores → ORG, CAD y MEN. Sin asesor en el MVP.

Gobierno: todo rol A tiene suplente; si el A no responde en 48 h decide el suplente (R39). Desacuerdo entre administradores: se mantiene lo vigente hasta la reunión mensual. Reasignaciones N1 bajo el umbral (5 % del sobre de origen) se autoaprueban (R38). Tocar Futuro o emergencia exige doble firma (R37).

## 3. Procesos

| ID | Proceso | Tipo | Disparador | A | Salida |
| --- | --- | --- | --- | --- | --- |
| E1 | Acordar y gobernar | Estratégico | Alta del hogar, cambio de regla, reunión mensual | ORG + firma CAD | Acuerdo versionado |
| E2 | Mejorar el método | Estratégico | Trimestral o 3 eventos N2+ | ORG | Ajustes de parámetros |
| P1 | Incorporar | Núcleo | Alta del hogar o N4 | ORG | Diagnóstico, etapa, cuentas, Acuerdo v1 |
| P2 | Planificar el mes | Núcleo | Día 25 o MesCerrado | ORG | Presupuesto aprobado |
| P2-A | Ajustar el plan | Núcleo | Ingreso base ±5 % del proyectado | ORG | Presupuesto v+1 |
| P3 | Recibir y distribuir | Núcleo | IngresoRecibido | ORG | Asignaciones reales y transferencias |
| P4 | Capturar y clasificar | Núcleo | Gasto por app, chat, foto o cartola | CAD | Movimientos confirmados |
| P5 | Controlar y alertar | Núcleo | Cada gasto; diario 20:00 | CAD | Alertas, pronóstico |
| P6 | Recuperar desvíos | Núcleo | DesvioDetectado | CAD (N1), ORG (N2–N4) | Reasignación o plan de recuperación |
| P7 | Cerrar y aprender | Núcleo | Domingo; día 1 | CAD / ORG | Conciliación, valoraciones, KPI, arrastres |
| S1 | Cuentas y conciliación | Soporte | Alta de cuenta; cierre semanal | CAD | Saldos conciliados |
| S2 | Deudas | Soporte | Alta de deuda o compra en cuotas | ORG | Cuotas preasignadas |
| S3 | Fondos y metas | Soporte | Alta de meta; P2 | ORG | Aportes prorrateados |
| S4 | Indicadores UF/IPC | Servicio | Diario 09:00 | — | Indicador vigente |
| S5 | Privacidad y consentimiento | Soporte | Alta de integrante; solicitud de derechos | ORG | Consentimientos, exportación, borrado |
| S6 | Educación | Capacidad | Hitos, primera vez de una función | — | Microcontenido |

### P1 Incorporar (ampliado por EP16)

1. ORG crea el hogar e invita a CAD e integrantes; S5 registra consentimientos (parental para MEN).
2. ORG registra cuentas y tarjetas con saldo inicial.
3. ORG sube cartolas y estados de cuenta (EP16). El sistema extrae, normaliza, separa transferencias internas y pagos de tarjeta, detecta duplicados y la IA clasifica. ORG confirma en lote.
4. La IA genera el perfil inicial y la retroalimentación (3–5 hallazgos con regla y fuente) y propone etapa (R23).
5. ORG declara o confirma ingresos típicos (base y variable), pagos fijos y deudas, partiendo de lo detectado.
6. ORG y CAD confirman etapa y firman el Acuerdo v1.

Término: etapa confirmada y Acuerdo v1 firmado. Eventos: HogarCreado, CartolaImportada, PerfilInicialGenerado, EtapaConfirmada.

### P2 Planificar el mes

1. La IA genera borrador base cero: fijos con holgura R08, aportes R03, cuotas R26, sobres según historial, sin culpa por adulto, sobre de pago de tarjeta por el saldo facturado pendiente.
2. Aplica el orden de la etapa (R04) y el semáforo (R06, R07), explicando cada desviación con su regla.
3. CAD revisa; ORG aprueba (suplente a 48 h).
4. El sistema congela el presupuesto como aprobado y programa el flujo de pago.

Término: Σ líneas = ingreso proyectado base (R45). Evento: PresupuestoAprobado.

### P3 Recibir y distribuir

1. Se registra el ingreso (monto, cuenta, fecha, tipo) y si es base o variable.
2. Sin plan aprobado → queda en Por asignar (D02). Ingreso base ±5 % → P2-A (R33).
3. La IA propone la distribución en el orden de la etapa. El ingreso variable se reparte con `pct_variable_a_futuro` (R45, R22).
4. ORG confirma; se crean asignaciones y tareas de transferencia (la app no mueve dinero).
5. Transferencias pendientes a las 72 h generan recordatorio.

Término: Por asignar = 0 para ese ingreso. Eventos: IngresoAsignado, TransferenciaPendiente.

### P4 Capturar y clasificar

1. El integrante registra monto y sobre (≤ 10 s); o llega por chat, foto o cartola.
2. La IA infiere categoría, bloque, intención y medio de pago; < 0,8 de confianza → por confirmar (R36).
3. Deduplicación: monto, fecha ±2 días y medio de pago (R35).
4. Compra en cuotas: se elige tratamiento (cada cuota en su mes o total al comprar; por defecto cada cuota). Gasto con tarjeta: reserva en el sobre de pago de tarjeta (R44). Pago de tarjeta: transferencia, no gasto (R27).
5. CAD confirma pendientes 2–3 veces por semana.

### P5 Controlar y alertar

Ritmo por sobre variable (R09, umbral 1,1), pronóstico de fin de mes, balance proyectado (R12), pagos por vencer a 3 días, abandono a 14 días (D14). Máximo 3 alertas por persona al día; el resto al resumen de las 20:00 (R40).

### P6 Recuperar desvíos

| Nivel | Disparador | A | Plazo | Acción | Salida |
| --- | --- | --- | --- | --- | --- |
| N1 Reasignación | Sobre negativo o gasto en sobre cerrado | CAD | 72 h | Mover desde Vida u otro esencial; autoaprobado bajo umbral (R38) | Sobre ≥ 0 |
| N2 Desvío del mes | Balance proyectado < 0 (R12) | ORG | Hasta el cierre | Recortar Vida y sin culpa; pausar aportes no críticos | Balance ≥ 0 |
| N3 Rotura estructural | R14 | ORG + CAD | 30 días | Rediseño; evaluar retroceso de etapa | 2 cierres en verde |
| N4 Reinicio | Abandono o decisión del hogar | ORG | Fecha simbólica ≤ 15 días | Volver a P1 sin arrastrar historial negativo | Primer cierre semanal completo |

### P7 Cerrar y aprender

- Semanal (domingo, ≤ 15 min, A: CAD): conciliar cuentas, resolver pendientes y duplicados, revisar ritmo, una pregunta Kakeibo.
- Mensual (día 1–3, ≤ 45 min, A: ORG): conciliación final (diferencia > $1.000 exige ajuste), valoración +/0/− por categoría, arrastres (R20), KPI e ICF, resumen y 1–3 recomendaciones de la IA, propuesta de etapa, reunión mensual (D16), cierre del período.
- En línea base (octubre y noviembre de 2026) el cierre mensual se hace sin presupuesto: conciliación, clasificación completa, valoración y KPI de partida.

## 4. Decisiones de diseño D01–D20

| ID | Tema | Decisión |
| --- | --- | --- |
| D01 | Qué es el mes | Mes calendario. Ingreso desde el día 20 puede ir al mes siguiente vía sobre Próximo mes. |
| D02 | Ingreso antes del plan | Queda en Por asignar; se asigna al aprobar. |
| D03 | Ingreso menor al proyectado | Se asigna en orden de la etapa hasta agotar; sobres sin cubrir marcados; P2-A. |
| D04 | Ingreso mayor o extraordinario | Excedente a Por asignar; propuesta por etapa (E0–E2 deuda o colchón; E3+ Futuro). |
| D05 | Cuentas incluidas | Solo fondo común y tarjetas del hogar; transferir a personal = gasto del sobre sin culpa. |
| D06 | Privacidad del gasto personal | Sin culpa registra solo el monto transferido. |
| D07 | Fecha contable | Fecha de compra, no de facturación ni de pago. |
| D08 | Cuotas | **Ajustada 12-10:** el tratamiento se elige en cada compra: cada cuota en su mes (deuda con cuotas preasignadas, R26) o total al comprar. Por defecto, cada cuota. |
| D09 | Fijos en UF | Plan con UF proyectada del día 1 + holgura; imputación al valor del día de pago. |
| D10 | Confianza IA | < 0,8 → por confirmar; nunca a Futuro ni deudas. |
| D11 | Sin conexión | Cola local con identificador único; idempotencia al sincronizar. |
| D12 | Duplicados | Monto, fecha ±2 días y medio → candidato; lo resuelve un administrador. |
| D13 | Fatiga de alertas | Máximo 3 al día; resumen a las 20:00. |
| D14 | Cierre no hecho | Recordatorio a 24 y 72 h; 14 días sin actividad → AbandonoDetectado. |
| D15 | Retroceso de etapa | Si se incumple el criterio de entrada en 2 cierres seguidos. |
| D16 | Reunión mensual | Quórum ambos administradores; agenda fija. |
| D17 | Menores | Mesada como sobre propio; ven solo su sobre y meta. |
| D18 | Asesor | Solo lectura, vence a 90 días. |
| D19 | Datos del hogar | Exportación y borrado a solicitud; datos crudos ≤ 30 días. |
| D20 | Reapertura | Solo administradores, con motivo; recalcula KPI y deja versión anterior. |
| D21 | Inicio del piloto | **Nueva 12-10:** el piloto parte el 1-10-2026. Octubre y noviembre son línea base (cargados desde cartolas). Primer presupuesto real: 1-12-2026. |
| D22 | Ingreso variable | **Nueva 12-10:** el plan se proyecta con el ingreso base; el variable entra como extra (R45). |
| D23 | Fondo común | **Nueva 12-10:** pozo común total. Todas las cuentas registradas son del fondo común; cada adulto recibe su sin culpa. |
| D24 | Tarjeta de crédito | **Nueva 12-10:** medio de pago principal. Cada gasto con tarjeta se reserva en su sobre de pago de tarjeta (R44). |
| D25 | Modalidad del sin culpa | **Nueva 24-10:** se elige al definir el Acuerdo: igual para todos, proporcional al ingreso o monto manual por adulto (parámetro `modalidad_sin_culpa`, ADR-10). |
| D26 | Hijos en el MVP | **Nueva 24-10:** no inician sesión; los padres ingresan toda la información. La cantidad de hijos es parametrizable y se define en el levantamiento de información. |
| D27 | Ingesta de cartolas | **Nueva 24-10:** sin lectores por banco; la IA transforma cualquier formato a LineaCartola, tras minimizar (R43) y con validación de totales. |
| D28 | Ingreso en el MVP | **Nueva 25-10:** correo y contraseña. El ORG crea las cuentas de los adultos en el panel de Supabase y les cambia la contraseña si la olvidan; no hay registro público. **Pendiente para la etapa comercial:** definir el modelo de autenticación definitivo (registro abierto con verificación de correo, recuperación autoservicio, código o passkeys, SMTP propio). |

| D29 | Beta delegada | **Nueva 25-10:** Rodrigo delega en Claude Code la aprobación de las specs 002–011 para construir la Beta completa del MVP, resolviendo las ambigüedades con buenas prácticas y esta fuente. Cada spec deja sus decisiones en "Decisiones de la Beta". Lo que no sirva en la marcha blanca se corrige con `/ajustar`. |
| D30 | Cartolas en la Beta | **Nueva 25-10:** Excel (xlsx, xls) y CSV. El archivo se procesa en el teléfono o navegador y **no se sube**: solo se guardan las líneas minimizadas (R43 se cumple con retención cero). Extracción con IA (D27) cuando hay clave de Claude y consentimiento `analitica_ia`; si no, mapeo de columnas asistido (genérico, no por banco). PDF queda para una versión siguiente. |
| D31 | IA con respaldo por reglas | **Nueva 25-10:** toda función de IA tiene un respaldo determinista (reglas de comercio, intérprete de frases, hallazgos por reglas). Sin clave de la API o sin `analitica_ia`, la app funciona completa en modo manual. |
| D32 | Mes de cada cuota | **Nueva 25-10:** en una compra "por cuota", la cuota 1 se imputa en el mes de compra (D07) y la cuota k en el mes k − 1 siguiente. |
| D33 | Avisos en la Beta | **Nueva 25-10:** las alertas se muestran dentro de la app (portada y "Avisos"); las notificaciones push quedan para la app nativa. El control diario corre a las 20:00 de Santiago con `pg_cron`. |
| D34 | Transferencias de cartola | **Nueva 25-10:** las líneas de transferencia entre cuentas del hogar se guardan como movimiento tipo `transferencia`, que no toca el libro ni los KPI (R28). El pago de tarjeta crea `fin.transferencia` tipo `pago_tarjeta` (R27). |

## 5. Etapas y flujo del día de pago

| Etapa | Entrada | 1º | 2º | 3º | 4º | 5º | Futuro mínimo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E0 Estabilizar | Pago esencial atrasado | Cuatro Paredes | Fijos | Deudas (mínimos) | Sobres | Sin culpa | 1 % |
| E1 Colchón inicial | 2 meses al día | Fijos | Emergencia hasta 1 mes | Deudas (mínimos) | Sobres | Sin culpa | = emergencia |
| E2 Desendeudar | Colchón de 1 mes | Fijos | Deuda objetivo (R21) | Fondos | Sobres | Sin culpa | 5 % |
| E3 Proteger | Cero deuda de consumo | Futuro | Fijos | Emergencia 3–6 meses | Fondos | Sin culpa | 10 % |
| E4 Construir | Reserva 3 meses | Futuro | Fijos | Fondos | Sobres | Sin culpa | 20 % |
| E5 Libertad | Ahorro ≥ 20 % por 12 meses | Futuro | Fijos | Fondos | Sobres | Sin culpa | ≥ 20 % |

Los porcentajes son valores por defecto que el hogar puede cambiar en el Acuerdo; no son recomendación financiera.

## 6. Máquinas de estado

| Entidad | Transición | Disparador | Quién | Regla |
| --- | --- | --- | --- | --- |
| Presupuesto | borrador → aprobado | Aprobación P2 | ORG (s/A CAD) | R39 |
| Presupuesto | aprobado → aprobado v+1 | P2-A | ORG | R33 |
| Presupuesto | aprobado → en ejecución | Día 1 | Sistema | — |
| Presupuesto | en ejecución → en cierre | Día 1 del mes siguiente | Sistema | — |
| Presupuesto | en cierre → cerrado | Conciliación + valoraciones | ORG | R34 |
| Presupuesto | cerrado → en cierre | Reapertura con motivo | ORG o CAD | D20 |
| Movimiento | capturado → confirmado | Confianza ≥ 0,8 y sin duplicado (no aplica a cartola) | Sistema | R36 |
| Movimiento | capturado → por confirmar | Confianza < 0,8, duplicado o cartola | Sistema | R35, R36, R42 |
| Movimiento | por confirmar → confirmado | Revisión | CAD | — |
| Movimiento | por confirmar → descartado | Duplicado o rechazo | CAD | R35 |
| Movimiento | confirmado → conciliado | Cierre semanal cuadrado | CAD | R34 |
| Recuperación | abierto → en curso → cerrado / escalado | Acción aprobada / salida / plazo | A del nivel / sistema | R10, R12, R14 |
| Etapa | vigente → propuesta → confirmada / rechazada | Cierre mensual / aprobación / 7 días | IA / ORG + CAD / sistema | R23, D15 |
| Importación | cargada → extraida → en revisión → importada (o fallida, anulada) | Carga, lector, revisión | ORG / sistema | R41–R43 |
| Perfil inicial | borrador → presentado → aceptado / descartado | Generación, revisión | IA / ORG | R23 |

## 7. Eventos de dominio

| Evento | Emite | Consume | Carga mínima |
| --- | --- | --- | --- |
| HogarCreado | P1 | E1, S5 | hogarId, integrantes |
| EtapaConfirmada | P1, P7 | P2, P3 | etapa, criterios |
| EtapaPropuesta | P7 | Administradores | etapa actual, propuesta, evidencia |
| AcuerdoVersionado | E1 | Todos | versión, parámetros, vigencia |
| PresupuestoAprobado | P2, P2-A | P3, P5 | presupuestoId, mes, versión |
| IngresoRecibido | P3, SIS | P3, P2-A | monto, cuenta, fecha, tipo, es_variable |
| IngresoAsignado | P3 | P5, S3 | ingresoId, asignaciones |
| TransferenciaPendiente | P3 | Notificaciones | destino, monto, vence |
| GastoRegistrado | P4 | P5, S2 | movimientoId, imputaciones, origen |
| MovimientoPorConfirmar | P4 | Bandeja CAD | movimientoId, confianza |
| DuplicadoCandidato | P4 | Bandeja CAD | par de movimientos |
| SobreNegativo | P4 | P6 | sobre, saldo |
| RitmoExcedido | P5 | Notificaciones | sobre, ritmo |
| PagoPorVencer | P5 | Notificaciones | pago fijo o tarjeta, fecha |
| DesvioDetectado | P5 | P6 | nivel sugerido, regla |
| RecuperacionIniciada | P6 | P5, P7 | nivel, causa |
| NivelEscalado | P6 | P6, E2 | de nivel, a nivel |
| RecuperacionCerrada | P6 | P7, E2 | duración, causa raíz |
| AbandonoDetectado | P5 | P6 (N4) | días sin actividad |
| SemanaCerrada | P7 | P5 | diferencia de conciliación |
| MesCerrado | P7 | P2, E2 | KPI, arrastres |
| ReinicioAprobado | P6 | P1 | fecha simbólica |
| CartolaCargada | P1/P4 | Lector | importacionId, cuenta, formato |
| CartolaImportada | P1/P4 | P4, perfil | importacionId, históricos, movimientos, duplicados |
| PerfilInicialGenerado | P1 | Administradores | perfilId, etapa sugerida |
| PagoTarjetaRegistrado | S1 | P5 | tarjeta, monto, saldo de reserva |

Persistencia: `sys.evento_dominio` (outbox particionado por año).

## 8. Reglas de negocio R01–R45

Nivel = precedencia (1 manda). Fuente entre paréntesis.

| ID | Regla | Nivel | Procesos |
| --- | --- | --- | --- |
| R01 | Asignación real solo con dinero recibido; el plan proyectado no mueve saldos (YNAB) | 2 | P2, P3 |
| R02 | Con Por asignar > 0 no se proponen gastos nuevos (YNAB) | 5 | P3, P5 |
| R03 | Aporte = (monto − saldo) / meses restantes; saldo ≥ monto → 0; meses = 0 → alerta (YNAB) | 5 | S3, P2 |
| R04 | Distribución en el orden de destinos de la etapa (Sethi) | 5 | P3 |
| R05 | En E0, Cuatro Paredes antes que cualquier destino (Ramsey) | 3 | P2, P3 |
| R06 | Esenciales > 50 % → rojo (Warren) | 5 | P2, P7 |
| R07 | Futuro < 20 % → amarillo; E0–E2 usan el mínimo de la etapa (Warren) | 5 | P2, P7 |
| R08 | Fijos nuevos o en UF con holgura 15 % el primer mes | 5 | P2 |
| R09 | Ritmo > 1,1 en sobre variable → RitmoExcedido | 6 | P5 |
| R10 | Sobre negativo → N1; tomar de Futuro exige doble firma (YNAB) | 4 | P6 |
| R11 | Gasto en sobre cerrado se imputa igual y abre N1 | 2 | P4 |
| R12 | Balance mensual proyectado < 0 → N2 | 5 | P5, P6 |
| R13 | Emergencia usada se repone antes que Futuro de largo plazo (Ramsey) | 3 | P3 |
| R14 | N3 si: 2 meses con balance < 0, esenciales > 50 % en 2 cierres o RCI sobre umbral BCCh | 5 | P6 |
| R15 | Reinicio N4 en fecha simbólica ≤ 15 días | 5 | P6 |
| R16 | Mensajes sin culpa: hecho, regla y opción, nunca juicio (Kakeibo) | 6 | Todos |
| R17 | Confirmación con intención inferida, editable (Kakeibo) | 6 | P4 |
| R18 | Costo en horas de vida = monto / salario real por hora (YMOYL) | 6 | P4, P7 |
| R19 | Valoración +/0/− y preguntas Kakeibo en el cierre | 5 | P7 |
| R20 | Saldo positivo se arrastra al mismo sobre; negativo descuenta Por asignar del mes siguiente (YNAB) | 5 | P7 |
| R21 | Bola de nieve vs avalancha con costo comparado; elige el hogar (Ramsey) | 4 | S2 |
| R22 | Parte de cada reajuste va a Futuro (sugerido 50 %) (SMarT) | 4 | P3 |
| R23 | IA propone avance o retroceso de etapa; administradores confirman | 4 | P1, P7 |
| R24 | UF al valor del día (corte 09:00); sin dato → último valor + alerta | 2 | S4 |
| R25 | Datos de menores solo a administradores, con consentimiento parental | 1 | S5 |
| R26 | Compra en N cuotas tratada "por cuota" = Deuda con cuotas preasignadas por mes de facturación | 2 | P4, S2 |
| R27 | Pago de tarjeta = transferencia a pasivo, no gasto | 2 | P4, S1 |
| R28 | Transferencia entre cuentas del hogar no es ingreso ni gasto | 2 | P4, S1 |
| R29 | Reembolso o devolución vuelve al sobre original | 2 | P4 |
| R30 | Gasto compartido: parte propia al sobre, resto a Por cobrar | 2 | P4 |
| R31 | Efectivo como cuenta billetera conciliada semanalmente | 2 | S1 |
| R32 | Moneda extranjera a CLP con tipo de cambio del día; ajuste al facturar | 2 | P4 |
| R33 | Ingreso base real ±5 % del proyectado → P2-A | 5 | P3 |
| R34 | Conciliación semanal obligatoria; mensual con diferencia > umbral exige ajuste justificado | 2 | P7, S1 |
| R35 | Monto igual, fecha ±2 días y mismo medio → DuplicadoCandidato | 2 | P4 |
| R36 | Inferencia IA < 0,8 → por confirmar; nunca imputa sola a Futuro, emergencia o deuda | 2 | P4 |
| R37 | Retiro de Futuro o emergencia requiere doble firma | 3 | P6 |
| R38 | Reasignación N1 bajo umbral se autoaprueba y registra | 4 | P6 |
| R39 | A sin respuesta en 48 h → decide el suplente | 4 | Todos |
| R40 | Máximo 3 alertas por persona al día; resto en resumen | 6 | P5 |
| R41 | Movimientos anteriores al inicio del piloto solo alimentan el perfil; no tocan sobres ni libro | 2 | P1, P4 |
| R42 | Desde el inicio del piloto, los movimientos de cartola entran por confirmar | 2 | P4 |
| R43 | Documento de cartola se elimina ≤ 30 días tras la extracción; a la IA solo van datos minimizados | 1 | P1, S5 |
| R44 | Gasto con tarjeta de crédito: sale del sobre de la categoría y se reserva en el sobre de pago de esa tarjeta; el pago consume la reserva (YNAB) | 2 | P4, S1 |
| R45 | El plan se proyecta con el ingreso base; el variable entra como extra y se reparte con `pct_variable_a_futuro` | 4 | P2, P3 |

Dónde vive cada regla: ver `docs/trazabilidad.csv` (columna `implementacion`: `db` = trigger o restricción; `dominio` = paquete TypeScript; `ia` = contrato de la IA; `ui` = interfaz).

## 9. Indicadores del MVP

| ID | Nombre | Fórmula | Meta | Dónde |
| --- | --- | --- | --- | --- |
| ICF | Índice Compás | Promedio ponderado 0–100 de K1, K2, K3, K4, K6 normalizados | ≥ 70 verde · 40–69 amarillo | Portada |
| RIT | Ritmo del mes | Σ gastado variables / (Σ asignado variables × días transcurridos / días del mes) | ≤ 1,0 verde · ≤ 1,1 amarillo | Portada |
| K2 | Meses de reserva | Saldo emergencia / esenciales mensuales | Meta de la etapa | Portada |
| K1 | Tasa de ahorro | Asignado a Futuro / ingreso del mes | ≥ mínimo de la etapa | Cierre |
| K3 | RCI | Cuotas de deuda / ingreso | ≤ 25 % sin hipotecario | Cierre |
| K4 | Esenciales / ingreso | Gasto Esenciales / ingreso | ≤ 50 % | Cierre |
| K6 | Balance mensual | Ingresos − gastos − aportes | ≥ 0 | Cierre |
| KC1 | % asignado al día 3 | Asignado en ≤ 72 h / ingreso recibido | 100 % | Cierre |
| KC2 | Pendientes > 48 h | Movimientos por confirmar con antigüedad > 48 h | 0 | Bandeja |
| KC3 | Diferencia de conciliación | Σ |saldo real − registrado| | ≤ umbral | Cierre |
| KP1 | Cobertura de captura | Registrados / reales según cartola | ≥ 90 % | Piloto |
| KP2 | Tiempo de captura | Mediana de segundos por captura manual | ≤ 10 s | Piloto |
| KP3 | Plan a tiempo | Presupuesto aprobado antes del día 1 | Sí | Piloto |
| KP4 | Rituales cumplidos | Cierres hechos / programados | ≥ 90 % | Piloto |
| KP5 | Días para retomar | Entre RecuperacionIniciada y RecuperacionCerrada | ≤ 7 | Piloto |
| KE | Esfuerzo mensual | Minutos activos en la app por hogar | ≤ 120 | Piloto |

K5 y K10 bajo demanda; K7, K8, K9 y KP6 en V2.

## 10. Alcance del MVP para la marcha blanca

Incluye: hogar, integrantes, roles y consentimientos; cuentas y tarjetas; importación de cartolas y perfil inicial; captura manual y por chat con IA; plan mensual base cero con aprobación; ingresos y distribución; ciclo de tarjeta de crédito; control, alertas y N1; cierres semanal y mensual con KPI.

Fuera del MVP: lectura de correos de compra, Finanzas Abiertas (desde julio de 2027), deudas con estrategia bola de nieve o avalancha (EP11), educación (EP15), asesor externo, N3 y N4 automáticos, foto de boletas, multi-hogar público (registro abierto, términos, cobro).

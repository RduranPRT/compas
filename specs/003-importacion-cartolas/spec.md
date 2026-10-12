# Spec 003 · Importación de cartolas y estados de cuenta

Estado: borrador · Fecha: 2026-10-12 · Épica: EP16 (nueva)
Procesos: P1 (paso 3), P4, S1 · Reglas: R27, R28, R35, R36, R41, R42, R43 · Decisiones: D07, D12, D21, ADR-04, ADR-08 · Depende de: 002

## Objetivo

Cargar en minutos los movimientos reales del hogar desde los documentos del banco: los anteriores al 1 de octubre alimentan el perfil inicial y los posteriores quedan como movimientos del piloto, listos para confirmar. Es la base de la línea base de octubre y noviembre.

## Historias de usuario

- **HU-003-1** Como organizador, quiero subir la cartola de mi cuenta o el estado de cuenta de la tarjeta en PDF, CSV o Excel y que el sistema lea sus movimientos.
- **HU-003-2** Como organizador, quiero revisar y confirmar en lote lo que la IA clasificó, agrupado por comercio.
- **HU-003-3** Como organizador, quiero que si subo dos veces el mismo documento o documentos que se traslapan, no se dupliquen movimientos.
- **HU-003-4** Como administradores, queremos que lo que ya registramos a mano se calce con la cartola en vez de duplicarse.
- **HU-003-5** Como hogar, queremos que el documento original se borre a los 30 días.

## Criterios de aceptación

```gherkin
Característica: Importación de cartolas (R41, R42, R43, R35)

  Escenario: Cartola de tres meses que cruza el inicio del piloto
    Dado inicio_piloto = 2026-10-01
    Y una cartola de la cuenta corriente del 2026-07-01 al 2026-10-15 con 180 líneas
    Cuando el ORG la sube y el lector la extrae
    Entonces las líneas anteriores al 2026-10-01 quedan en movimiento_historico (R41)
    Y las líneas desde el 2026-10-01 quedan como movimientos con origen cartola en estado por_confirmar (R42)
    Y la importación informa n_filas, n_historicos, n_movimientos y n_duplicados

  Escenario: Mismo archivo dos veces
    Dado una importación ya hecha de un archivo
    Cuando se sube el mismo archivo
    Entonces se rechaza indicando la fecha de la importación anterior

  Escenario: Documentos traslapados
    Dado una cartola importada hasta el 2026-10-15
    Cuando se sube otra del 2026-10-01 al 2026-10-31
    Entonces las líneas ya importadas no se vuelven a crear (huella de línea)
    Y solo entran las del 2026-10-16 al 2026-10-31

  Escenario: Calce con captura manual (R35)
    Dado un gasto capturado a mano de $12.990 el 2026-10-03 con la Visa
    Cuando la cartola de la Visa trae $12.990 el 2026-10-04
    Entonces no se crea un movimiento nuevo
    Y el movimiento manual queda marcado como calzado con la línea de cartola

  Escenario: Pago de tarjeta y transferencias internas (R27, R28)
    Dado una línea de la cuenta corriente "PAGO TARJETA VISA" por $420.000
    Cuando se importa
    Entonces se registra como transferencia tipo pago_tarjeta hacia la Visa, no como gasto
    Y una transferencia entre dos cuentas del hogar no se cuenta como ingreso ni gasto

  Escenario: Clasificación con IA y confianza (R36)
    Dado movimientos de octubre importados
    Cuando la IA los clasifica
    Entonces cada uno tiene categoría, bloque, intención y confianza
    Y ninguno queda confirmado sin revisión humana (R42)
    Y ninguno queda imputado por la IA a Futuro, emergencia o cuotas (R36)

  Escenario: Revisión en lote por comercio
    Dado 23 movimientos de "JUMBO" clasificados como Alimentación
    Cuando el ORG confirma el grupo
    Entonces los 23 quedan confirmados e imputados a Alimentación
    Y se guarda la regla "JUMBO → Alimentación" para próximas importaciones

  Escenario: Minimización antes de la IA (R43)
    Dado una glosa con RUT, número de cuenta o nombre de un menor
    Cuando se envía a la IA
    Entonces el texto enviado no contiene el RUT, ni más de 4 dígitos de la cuenta, ni el nombre del menor

  Escenario: Retención del documento (R43)
    Dado una importación de hace 30 días
    Cuando corre el job diario de retención
    Entonces el archivo se elimina del almacenamiento
    Y la importación queda con purgada_en y sin storage_uri
    Y los movimientos importados se conservan

  Escenario: PDF escaneado sin texto
    Dado un PDF que es solo imagen
    Cuando se intenta extraer
    Entonces la importación queda fallida con el mensaje "Este PDF es una imagen. Descarga la cartola en Excel o CSV desde tu banco"
```

## Reglas y cálculos

- **Huella de línea** (`hash_linea`): sha256 de `cuenta_id | fecha | monto con signo | glosa normalizada | ordinal del día` (el ordinal distingue dos compras iguales el mismo día).
- **Calce con captura manual**: mismo monto, misma cuenta, fecha ±2 días, sin calce previo → se asocia (no se duplica). Si hay más de un candidato, queda como DuplicadoCandidato para el CAD (R35).
- **Clase de cada línea**: gasto, ingreso, transferencia_interna, pago_tarjeta, comision, interes, reembolso u otro. Reglas deterministas primero (glosas conocidas: "PAGO TARJETA", "TRASPASO A", "TEF", "COMISION", "INTERES"), IA después.
- **Fecha contable**: la fecha de la operación, no la de facturación (D07).
- **Estados de la importación**: cargada → extraida → en_revision → importada; o fallida, anulada.

## Datos

- `fin.importacion`, `fin.movimiento_historico`, `fin.movimiento` (columnas `importacion_id`, `hash_linea`), `fin.transferencia`, `fin.duplicado_candidato`, `ia.inferencia`, Storage bucket privado `cartolas`.
- Migración nueva: `fin.regla_comercio` (hogar, patrón normalizado, categoria_id, intención, creada_por, veces_usada) con RLS de administradores; y `fin.movimiento.calce_importacion_id` para el calce con captura manual.

## Lectores

Paquete `packages/lectores` con una interfaz común `leer(archivo) → LineaCartola[]` y pruebas con archivos de ejemplo anonimizados en `packages/lectores/fixtures/`:

| Prioridad | Lector | Formato |
| --- | --- | --- |
| 1 | Bancos del hogar [POR ACLARAR] | CSV o XLSX descargado del banco |
| 2 | Estado de cuenta de tarjeta del hogar [POR ACLARAR] | PDF con texto |
| 3 | Genérico CSV/XLSX con mapeo de columnas elegido por el usuario | CSV o XLSX |
| 4 | PDF con texto vía IA (`ia-extraer-cartola`) | PDF |

## Interfaz

- "Cargar cartola": elegir cuenta → subir archivo → progreso → resumen (históricos, del piloto, duplicados, transferencias).
- "Revisar importación": grupos por comercio con categoría sugerida y confianza; confirmar grupo, cambiar categoría, separar un movimiento.

## IA

- `ia-clasificar` (modelo liviano): entrada minimizada `{fecha, monto, sentido, glosa, comercio}` + categorías del hogar + reglas de comercio; salida `{clase, categoria_id, intencion, confianza, razon_corta}` validada con zod.
- `ia-extraer-cartola` (modelo liviano): texto del PDF minimizado → `LineaCartola[]`. Se valida que la suma de cargos y abonos cuadre con los totales del documento cuando existan; si no cuadra, la importación queda en revisión con advertencia.

## Eventos

CartolaCargada, CartolaImportada, MovimientoPorConfirmar, DuplicadoCandidato.

## Fuera de alcance

Conexión directa a bancos (Finanzas Abiertas, desde julio de 2027), OCR de imágenes, lectura de correos (ADR-08).

## Preguntas abiertas

- [POR ACLARAR] Bancos de las cuentas y emisores de las tarjetas, y en qué formato descarga cada uno su cartola.
- [POR ACLARAR] Una cartola real de muestra por banco para construir el lector (se anonimiza antes de entrar al repositorio).

# Spec 011 · Privacidad, derechos y retención (Ley 21.719)

Estado: aprobada (delegada a Claude Code, D29, 25-10-2026) · Fecha: 2026-10-12 · Épica: EP14
Procesos: S5 · Reglas: R25, R43 · Decisiones: D19, ADR-04, ADR-09 · Depende de: 001, 003

## Objetivo

Llegar al 1 de diciembre de 2026, fecha de entrada en vigencia de la Ley 21.719, con consentimientos por finalidad, ejercicio de derechos y retención de datos funcionando, aunque el producto sea solo para el hogar.

## Historias de usuario

- **HU-011-1** Como integrante, quiero ver y revocar mis consentimientos.
- **HU-011-2** Como integrante, quiero descargar todos mis datos.
- **HU-011-3** Como organizador, quiero borrar los datos del hogar si dejamos de usar la app.
- **HU-011-4** Como hogar, queremos que los documentos de cartola se borren solos a los 30 días.

## Criterios de aceptación

```gherkin
Característica: Privacidad (R25, R43, D19)

  Escenario: Revocar analitica_ia
    Cuando un adulto revoca analitica_ia
    Entonces las funciones de IA dejan de procesar sus datos desde ese momento
    Y la app sigue funcionando en modo manual

  Escenario: Exportación
    Cuando un integrante pide exportar
    Entonces recibe un archivo con sus datos y los del hogar que puede ver, en formato JSON y CSV, con enlace que vence en 7 días

  Escenario: Borrado del hogar
    Cuando el ORG y el CAD confirman el borrado
    Entonces el hogar queda con eliminado_en y a los 30 días se borran sus datos y archivos

  Escenario: Retención de cartolas (R43)
    Dado archivos de cartola con más de 30 días
    Cuando corre el job diario
    Entonces se eliminan del almacenamiento y la importación queda con purgada_en

  Escenario: Menores (R25)
    Dado un menor
    Entonces sus datos solo los ven los administradores y él mismo
    Y revocar datos_menor desactiva su acceso
```

## Datos

`gob.consentimiento`, `gob.solicitud_derecho`, `fin.importacion`, `fin.v_importacion_por_purgar`, Storage. Edge Function `retencion` y `exportar`.

## Interfaz

Ajustes → Privacidad: consentimientos, descargar mis datos, borrar hogar. Texto legal versionado en `docs/legal/`.

## Fuera de alcance

Registro de actividades de tratamiento para terceros (necesario si Compás se ofrece a otros hogares en V2).

## Decisiones de la Beta (D29, D30; 25-10-2026)

- Exportación: el archivo (JSON y CSV) se arma en el dispositivo con lo que la persona puede ver y se descarga de inmediato; queda registrada como `gob.solicitud_derecho` cumplida. No se guarda en el servidor, así que no hay enlace que vencer.
- Retención de cartolas: no hay documentos guardados (D30); el escenario se cumple con `purgada_en` al importar.
- Borrado del hogar: solicitud con doble firma. Al aprobarse, el hogar queda con `eliminado_en` y `app.purgar_hogares()` (pg_cron diario) borra sus datos a los 30 días. Mientras tanto, la app muestra que el borrado está programado y permite anularlo.
- Revocar `datos_menor` desactiva al hijo (`activo = false`); revocar `analitica_ia` apaga las funciones de IA para esa persona.

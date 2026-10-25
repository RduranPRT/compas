# ADR-07 · Fuente de indicadores económicos

Estado: Aceptada · 24-10-2026 (propuesta 12-10-2026; fuentes invertidas al aprobar) · Brechas: G44

## Contexto

S4 necesita UF diaria, IPC mensual, UTM y dólar para pagos fijos en UF (D09, R24) y compras en moneda extranjera (R32).

## Decisión

- **Fuente principal**: API de la CMF (oficial, gratuita; requiere registrarse para obtener una clave, que se guarda como secreto de Supabase).
- **Respaldo**: API pública mindicador.cl (`/api/uf/{dd-mm-aaaa}`, `/api/ipc`, `/api/utm`, `/api/dolar`), gratuita y sin clave, si la principal falla dos veces seguidas.
- **Ejecución**: job diario a las 09:00 de Santiago (`pg_cron` llama a la Edge Function `indicadores`), que carga el día y los 3 días siguientes de UF cuando están publicados.
- **Sin dato** (R24): se usa el último valor conocido y se emite alerta `uf_sin_dato`.
- **Histórico**: al importar cartolas antiguas se cargan los valores de las fechas necesarias.

## Alternativas consideradas

Banco Central (BDE) con usuario y clave: más oficial, pero más fricción; queda como tercera opción.

## Consecuencias

Hay que registrarse en la CMF antes de implementar la función `indicadores`. El respaldo comunitario no es oficial; se mitiga con la fuente principal y con la tabla `ref.indicador_economico` como caché.

## Cómo verificar

Prueba de integración con respuesta grabada; prueba de R24 con un día sin dato.

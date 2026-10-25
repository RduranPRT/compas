# ADR-04 · Dónde corre la IA

Estado: Aceptada · 24-10-2026 (propuesta 12-10-2026) · Brechas: G36, G41 · Decisión del hogar: IA fuera de Chile con datos minimizados

## Contexto

La IA clasifica movimientos, interpreta el chat, extrae datos de cartolas en PDF, genera el perfil inicial, propone planes y redacta resúmenes. El hogar aceptó procesamiento fuera de Chile con datos minimizados y un tope total de USD 25 al mes.

## Decisión

- **Proveedor**: Claude API de Anthropic.
- **Modelos** (verificar nombres y precios vigentes en docs.claude.com antes de implementar):
  - Liviano (`claude-haiku-5-5`) para clasificación, chat de captura y extracción de PDF.
  - Mayor (`claude-sonnet-5-5`) solo para perfil inicial, resumen mensual y propuesta de plan, que ocurren pocas veces al mes.
- **Dónde corre**: solo en Supabase Edge Functions (`supabase/functions/ia-*`). La clave de la API vive en los secretos de Supabase; nunca en la app ni en el repositorio. Rodrigo la entrega cuando se implemente la primera función de IA.
- **Rol de base de datos**: las funciones de IA escriben con el rol `compas_ia` (inserta propuestas e inferencias; no aprueba, no asigna, no firma; R36 en trigger).
- **Minimización** (R43, módulo `packages/dominio/src/minimizar.ts`): antes de cada llamada se eliminan RUT, números de cuenta y tarjeta (se dejan 4 dígitos), correos, teléfonos y nombres de menores; los nombres de adultos se reemplazan por su rol.
- **Salidas estructuradas**: cada llamada declara un esquema JSON (zod en `packages/contratos/ia`). Respuestas que no validan se descartan y el movimiento queda por confirmar.
- **Trazabilidad**: cada inferencia se guarda en `ia.inferencia` (campo, valor, confianza, modelo) y cada propuesta en `ia.recomendacion` con `regla_codigo` (P8).
- **Consentimiento**: sin consentimiento `analitica_ia` vigente del titular, la función responde sin IA (captura manual).

## Alternativas consideradas

| Opción | Por qué no |
| --- | --- |
| Llamar a la IA desde la app | Expone la clave y salta la minimización. |
| Modelo local en el teléfono | Calidad insuficiente para PDF y perfil; mayor consumo de batería. |
| Solo modelo mayor | Costo innecesario para clasificar. |

## Consecuencias

- Costo estimado en marcha blanca: unos pocos dólares al mes (cientos de clasificaciones cortas y pocas generaciones largas). Se mide con un contador por función y se alerta al superar USD 10.
- Conjunto de evaluación: 100 movimientos reales anonimizados del hogar, con categoría esperada; meta de precisión ≥ 85 % antes de bajar el umbral de confirmación.

## Cómo verificar

Pruebas de contrato con respuestas grabadas; prueba de minimización con RUT y números de tarjeta de ejemplo; prueba de base de datos T11 (la IA no imputa a Futuro ni firma).

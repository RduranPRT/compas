# ADR-01 · Canal de chat

Estado: Propuesta · 12-10-2026 · Brechas: G37

## Contexto

La captura conversacional ("gasté 12 lucas en la feria") es una innovación del método y apunta a KP2 (≤ 10 s por captura). Se evaluó dónde vive esa conversación. El piloto es un solo hogar, con iOS y Android, y un tope de USD 25 al mes.

## Decisión

El chat vive **dentro de la app Compás** como pantalla de captura y consulta. El mismo motor atiende texto escrito y, en una segunda iteración, dictado por voz del teléfono.

## Alternativas consideradas

| Opción | Por qué no ahora |
| --- | --- |
| WhatsApp Business API | Requiere cuenta verificada por Meta, plantillas aprobadas y costo por conversación; los datos financieros pasan por un tercero más. |
| Telegram bot | Rápido de construir, pero la familia no lo usa y agrega un canal de datos más que declarar en el consentimiento. |
| Sin chat, solo formulario | Pierde la innovación principal de captura y la intención inferida (R17). |

## Consecuencias

- La conversación queda bajo la misma autenticación y RLS que el resto de la app.
- El contrato de la IA para chat (spec 005) define intents: registrar gasto, registrar ingreso, consultar saldo de sobre y preguntar "¿cómo vamos?".
- Revisar en V2 si un canal externo sube la cobertura de captura (KP1).

## Cómo verificar

Prueba de aceptación de spec 005: un gasto dictado en una frase queda registrado con monto, sobre e intención en ≤ 10 s medianos durante dos semanas de marcha blanca.

# Decisiones de arquitectura (ADR)

| ADR | Tema | Decisión | Estado |
| --- | --- | --- | --- |
| [01](ADR-01-canal-chat.md) | Canal de chat | Chat dentro de la app; sin WhatsApp en el MVP | Propuesta |
| [02](ADR-02-representacion-reglas.md) | Representación de reglas | Invariantes en PostgreSQL + paquete de dominio en TypeScript + parámetros en el Acuerdo | Propuesta |
| [03](ADR-03-plataforma-movil.md) | Plataforma móvil y offline | Expo (React Native) con TypeScript, versión web incluida, cola offline local | Propuesta |
| [04](ADR-04-ia.md) | Dónde corre la IA | Claude API desde Edge Functions, con minimización y salidas estructuradas | Propuesta |
| [05](ADR-05-aporte-defecto.md) | Regla de aporte por defecto | Aporte lineal R03 | Propuesta |
| [06](ADR-06-estrategia-deuda.md) | Estrategia de deuda por defecto | Avalancha, mostrando el costo de bola de nieve; fuera del MVP | Propuesta |
| [07](ADR-07-indicadores.md) | Fuente de indicadores | mindicador.cl con respaldo CMF; job diario 09:00 | Propuesta |
| [08](ADR-08-avisos-compra.md) | Lectura de avisos de compra | Fuera del MVP; reemplazada por importación de cartolas | Propuesta |
| [09](ADR-09-backend-hosting.md) | Backend y hosting | Supabase (Postgres, Auth, Storage, Edge Functions, pg_cron) en São Paulo | Propuesta |

Estados: Propuesta → Aceptada (la aprueba Rodrigo) → Reemplazada (por otra ADR).

Formato de cada ADR: contexto, decisión, alternativas consideradas, consecuencias y cómo verificar.

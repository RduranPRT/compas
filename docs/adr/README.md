# Decisiones de arquitectura (ADR)

| ADR | Tema | Decisión | Estado |
| --- | --- | --- | --- |
| [01](ADR-01-canal-chat.md) | Canal de chat | Chat dentro de la app; sin WhatsApp en el MVP | Aceptada |
| [02](ADR-02-representacion-reglas.md) | Representación de reglas | Invariantes en PostgreSQL + paquete de dominio en TypeScript + parámetros en el Acuerdo | Aceptada |
| [03](ADR-03-plataforma-movil.md) | Plataforma móvil y offline | Expo (React Native) con TypeScript; **MVP primero en web**, iOS y Android después; cola offline local | Aceptada |
| [04](ADR-04-ia.md) | Dónde corre la IA | Claude API desde Edge Functions, con minimización y salidas estructuradas; Haiku para chat y clasificación, Sonnet para perfil y resúmenes | Aceptada |
| [05](ADR-05-aporte-defecto.md) | Regla de aporte por defecto | Aporte lineal R03 | Aceptada |
| [06](ADR-06-estrategia-deuda.md) | Estrategia de deuda por defecto | Avalancha, mostrando el costo de bola de nieve; fuera del MVP | Postergada a V2 |
| [07](ADR-07-indicadores.md) | Fuente de indicadores | CMF con respaldo mindicador.cl; job diario 09:00 | Aceptada |
| [08](ADR-08-avisos-compra.md) | Lectura de avisos de compra | Fuera del MVP; reemplazada por importación de cartolas | Postergada a V2 |
| [09](ADR-09-backend-hosting.md) | Backend y hosting | Supabase (Postgres, Auth, Storage, Edge Functions, pg_cron) en São Paulo; plan gratuito en marcha blanca | Aceptada |
| [10](ADR-10-modalidad-sin-culpa.md) | Modalidad del sin culpa | Parámetro del Acuerdo: igual, proporcional al ingreso o manual por adulto | Aceptada |

Estados: Propuesta → Aceptada (la aprueba Rodrigo) → Reemplazada (por otra ADR). Postergada = fuera del MVP, se reevalúa en V2.

Última revisión: 24-10-2026.

Formato de cada ADR: contexto, decisión, alternativas consideradas, consecuencias y cómo verificar.

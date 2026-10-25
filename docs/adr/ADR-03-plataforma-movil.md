# ADR-03 · Plataforma móvil y offline

Estado: Aceptada · 24-10-2026 (propuesta 12-10-2026) · Brechas: G39 · Decisión del hogar: iOS y Android; MVP primero en web (24-10-2026)

## Contexto

La familia usa iOS y Android. El piloto parte en marcha blanca con un solo desarrollador (Rodrigo, más de 20 h por semana con Claude Code). Se necesita captura sin conexión (D11) y notificaciones.

## Decisión

**MVP primero en web (24-10-2026).** La marcha blanca se publica como app web generada por Expo (React Native Web), instalable en la pantalla de inicio del teléfono y usable desde el computador. iOS y Android se publican después desde el mismo código, sin reescribir la interfaz.

- **Expo (React Native) con TypeScript**, SDK 56 o el vigente al iniciar, con Expo Router.
- **Monorepo con pnpm**:
  - `apps/movil`: la app (iOS, Android y web desde el mismo código).
  - `packages/dominio`: reglas de cálculo (ADR-02).
  - `packages/contratos`: tipos generados desde la base (`supabase gen types`) y esquemas zod de eventos y de la IA.
  - `supabase/`: migraciones (copiadas desde `db/migrations`), Edge Functions y configuración.
- **Offline**: cola local en `expo-sqlite` con `cliente_op_id` por operación; al reconectar se envía y la base deduplica por `UNIQUE (hogar_id, cliente_op_id)` (D11). Lectura offline de saldos desde la última sincronización.
- **Distribución en marcha blanca**: versión web (`expo export --platform web`) en un hosting estático, a definir en la tarea T017 de la spec 001. Los integrantes la instalan en la pantalla de inicio.
- **Distribución posterior** (cuando se decida):
  - Android: build interna con EAS (APK instalable).
  - iOS: TestFlight, que requiere cuenta Apple Developer (USD 99 al año).
- **Notificaciones**: en web, notificaciones web push; en iPhone solo funcionan con la app instalada en la pantalla de inicio. Si no están disponibles, el resumen de las 20:00 y las alertas se muestran dentro de la app. En nativo, Expo Notifications.

## Alternativas consideradas

| Opción | Por qué no |
| --- | --- |
| Flutter | Igual de capaz, pero Claude Code y el ecosistema de Supabase tienen mejor soporte en TypeScript, y se comparte código con las Edge Functions. |
| Web pura con Next.js (PWA) | Mejor web, pero pasar a app nativa obligaría a reescribir la interfaz. Con Expo la web sale del mismo código. |
| Nativo doble (Swift + Kotlin) | Duplica el trabajo para un desarrollador. |

## Consecuencias

- Un solo lenguaje (TypeScript) en app, dominio y funciones del servidor.
- Web primero: el modo sin conexión depende del almacenamiento del navegador y es más limitado; la carga de cartolas es más cómoda desde el computador; el registro rápido requiere instalar la app en la pantalla de inicio.
- El costo de Apple (USD 99 al año) se posterga hasta publicar en iOS.
- Costo: USD 99 al año por Apple si se usa TestFlight (~USD 8 al mes dentro del tope de USD 25).
- Las pantallas siguen los wireframes v2 (artifact "Wireframes Compás v2").

## Cómo verificar

Spec 001: la app abre en Android, iOS (o web) y en navegador, inicia sesión y muestra el hogar. Spec 005: un gasto capturado en modo avión aparece una sola vez tras reconectar.

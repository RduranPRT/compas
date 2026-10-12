# ADR-03 · Plataforma móvil y offline

Estado: Propuesta · 12-10-2026 · Brechas: G39 · Decisión del hogar: iOS y Android

## Contexto

La familia usa iOS y Android. El piloto parte en marcha blanca con un solo desarrollador (Rodrigo, más de 20 h por semana con Claude Code). Se necesita captura sin conexión (D11) y notificaciones.

## Decisión

- **Expo (React Native) con TypeScript**, SDK 56 o el vigente al iniciar, con Expo Router.
- **Monorepo con pnpm**:
  - `apps/movil`: la app (iOS, Android y web desde el mismo código).
  - `packages/dominio`: reglas de cálculo (ADR-02).
  - `packages/contratos`: tipos generados desde la base (`supabase gen types`) y esquemas zod de eventos y de la IA.
  - `supabase/`: migraciones (copiadas desde `db/migrations`), Edge Functions y configuración.
- **Offline**: cola local en `expo-sqlite` con `cliente_op_id` por operación; al reconectar se envía y la base deduplica por `UNIQUE (hogar_id, cliente_op_id)` (D11). Lectura offline de saldos desde la última sincronización.
- **Distribución en marcha blanca**:
  - Android: build interna con EAS (APK instalable).
  - iOS: TestFlight, que requiere cuenta Apple Developer (USD 99 al año). Mientras no exista la cuenta, los integrantes con iPhone usan la versión web instalada en la pantalla de inicio.
- **Notificaciones**: Expo Notifications; en web, solo dentro de la app.

## Alternativas consideradas

| Opción | Por qué no |
| --- | --- |
| Flutter | Igual de capaz, pero Claude Code y el ecosistema de Supabase tienen mejor soporte en TypeScript, y se comparte código con las Edge Functions. |
| Solo web (PWA) | Notificaciones y offline limitados en iOS; sirve como respaldo, no como plataforma principal. |
| Nativo doble (Swift + Kotlin) | Duplica el trabajo para un desarrollador. |

## Consecuencias

- Un solo lenguaje (TypeScript) en app, dominio y funciones del servidor.
- Costo: USD 99 al año por Apple si se usa TestFlight (~USD 8 al mes dentro del tope de USD 25).
- Las pantallas siguen los wireframes v2 (artifact "Wireframes Compás v2").

## Cómo verificar

Spec 001: la app abre en Android, iOS (o web) y en navegador, inicia sesión y muestra el hogar. Spec 005: un gasto capturado en modo avión aparece una sola vez tras reconectar.

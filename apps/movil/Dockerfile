# Versión web de Compás (ADR-03): se compila con Expo y se sirve como sitio estático con Caddy.
# Contexto de build: raíz del monorepo (ver railway.json).
FROM node:22-slim AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/movil ./apps/movil
RUN pnpm install --frozen-lockfile --filter movil...
# Públicas: quedan dentro del bundle (URL y clave anónima de Supabase; nunca service_role).
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
RUN test -n "$EXPO_PUBLIC_SUPABASE_URL" && test -n "$EXPO_PUBLIC_SUPABASE_ANON_KEY" \
 && EXPO_PUBLIC_SUPABASE_URL="$EXPO_PUBLIC_SUPABASE_URL" EXPO_PUBLIC_SUPABASE_ANON_KEY="$EXPO_PUBLIC_SUPABASE_ANON_KEY" \
    pnpm --filter movil export:web

FROM caddy:2-alpine
COPY apps/movil/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/movil/dist /srv

# Despliegue de Compás

Última revisión: 25-10-2026 (spec 001, T017).

| Pieza | Dónde | Identificador |
| --- | --- | --- |
| Base, autenticación y API | Supabase, región São Paulo (`sa-east-1`), plan Free (ADR-09) | proyecto `opoeeyxpharopjftfdnt` |
| Versión web (ADR-03) | Railway, proyecto `compas`, servicio `web` | https://web-production-136d.up.railway.app |

El hosting web quedó en Railway porque el hogar ya tiene plan pagado (decisión de Rodrigo, 25-10-2026). La web es un sitio estático: Railway compila `apps/movil/Dockerfile` (Expo → `dist`) y lo sirve con Caddy (`apps/movil/Caddyfile`).

## Base de datos (Supabase)

Las migraciones viven en `db/migrations/` y se copian a `supabase/migrations/`.

```bash
corepack pnpm db:sync
corepack pnpm exec supabase link --project-ref opoeeyxpharopjftfdnt
corepack pnpm exec supabase db push
corepack pnpm exec supabase migration list --linked
```

`db push` pide la contraseña de la base (guardada en el gestor de contraseñas, nunca en el repositorio).

### Ajustes del panel que `db push` no sube (una sola vez)

1. **Settings → API → Data API → Exposed schemas**: agregar `app`, `gob`, `fin`, `plan`, `med`, `ref`, `ia`. Sin esto la app no puede leer ni guardar (error `PGRST106 Invalid schema`).
2. **Authentication → Sign In / Providers**: desactivar **Allow new users to sign up** (registro público cerrado, D28). El proveedor **Email** queda activo; en sus opciones, largo mínimo de contraseña **10**.
3. **Authentication → URL Configuration**: *Site URL* = `https://web-production-136d.up.railway.app`.

No se necesita SMTP ni plantillas de correo en el MVP: no se envían correos (D28).

### Cuentas (D28)

Las crea el organizador en **Authentication → Users → Add user → Create new user**: correo, contraseña de al menos 10 caracteres y **Auto Confirm User** marcado. La contraseña se entrega en persona; si alguien la olvida, el organizador la cambia desde el mismo panel. Para la pareja: crear su cuenta aquí y luego invitarla desde la app con el mismo correo; al ingresar queda como co-administradora.

### Respaldo (plan Free, ADR-09)

Semanal, a un archivo privado fuera del repositorio:

```bash
corepack pnpm exec supabase db dump --linked -f respaldo-AAAA-MM-DD.sql
corepack pnpm exec supabase db dump --linked --data-only -f datos-AAAA-MM-DD.sql
```

## Versión web (Railway)

Variables del servicio `web` (se pasan al build como argumentos del Dockerfile):

| Variable | Valor |
| --- | --- |
| `RAILWAY_DOCKERFILE_PATH` | `apps/movil/Dockerfile` |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://opoeeyxpharopjftfdnt.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | clave `anon` del proyecto (pública; nunca `service_role`) |

Publicar una versión nueva desde la raíz del repositorio:

```bash
railway up --service web --detach -m "<qué cambia>"
railway deployment list --service web --json
```

La publicación está lista cuando la nueva implementación queda en `SUCCESS`. Probar la imagen antes, en local:

```bash
docker build -f apps/movil/Dockerfile --build-arg EXPO_PUBLIC_SUPABASE_URL=... --build-arg EXPO_PUBLIC_SUPABASE_ANON_KEY=... -t compas-web .
docker run --rm -e PORT=8080 -p 8080:8080 compas-web
```

No se usa `railway.json`: Railway lo dejó obsoleto (deja de leerse el 01-12-2026) y los servicios nuevos no lo aplican.

## Instalar en el teléfono

Abrir la dirección web en el navegador del teléfono, ingresar con el correo y elegir **Agregar a pantalla de inicio**.

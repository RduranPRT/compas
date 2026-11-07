# Despliegue de Compás

Última revisión: 07-11-2026 (publicación automática).

| Pieza | Dónde | Identificador |
| --- | --- | --- |
| Base, autenticación y API | Supabase, región São Paulo (`sa-east-1`), plan Free (ADR-09) | proyecto `opoeeyxpharopjftfdnt` |
| Versión web (ADR-03) | Railway, proyecto `compas`, servicio `web` | https://web-production-136d.up.railway.app |

El hosting web quedó en Railway porque el hogar ya tiene plan pagado (decisión de Rodrigo, 25-10-2026). La web es un sitio estático: Railway compila `apps/movil/Dockerfile` (Expo → `dist`) y lo sirve con Caddy (`apps/movil/Caddyfile`).

## Publicación automática (desde 07-11-2026)

Todo lo que entra a `main` se publica solo con `.github/workflows/desplegar.yml`, cuando el CI termina en verde y en este orden:

1. **Migraciones**: si hay pendientes, el workflow se detiene y pide aprobación en el entorno `produccion` (GitHub → Actions → la ejecución → *Review deployments*). Al aprobar, guarda un respaldo cifrado (esquema y datos) en el bucket privado `respaldos` de Railway y aplica `supabase db push`. Si el entorno no exige aprobación, no migra.
2. **Funciones de IA**: solo si cambió `supabase/functions/`.
3. **Web**: solo si cambió `apps/movil/`, `packages/` o las dependencias; `railway up --ci` espera a que quede en `SUCCESS`.

Si una publicación falla, se corrige y se vuelve a fusionar, o se usa **Run workflow** en Actions → *Desplegar*, que vuelve a publicar funciones y web. El CI además falla si `supabase/migrations/` no está al día con `db/migrations/`.

El repositorio es público: los registros de Actions los puede ver cualquiera. Por eso el respaldo nunca va a GitHub y ningún paso imprime datos del hogar.

### Configuración (una sola vez)

**Secretos** (GitHub → Settings → Secrets and variables → Actions):

| Secreto | De dónde sale |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access Tokens |
| `SUPABASE_DB_PASSWORD` | contraseña de la base (gestor de contraseñas) |
| `RAILWAY_TOKEN` | Railway → proyecto `compas` → Settings → Tokens, entorno `production` |
| `RESPALDO_ENDPOINT`, `RESPALDO_BUCKET`, `RESPALDO_ACCESS_KEY_ID`, `RESPALDO_SECRET_ACCESS_KEY` | Railway → bucket `respaldos` → Credentials (endpoint, nombre del bucket, claves) |
| `RESPALDO_CLAVE` | frase larga y aleatoria; guardarla también en el gestor de contraseñas: sin ella el respaldo no se puede abrir |
| `CLAUDE_CODE_OAUTH_TOKEN` | `claude setup-token`; lo usan la revisión de PR (`revision.yml`) y `@claude` (`claude.yml`) |

**Entorno**: Settings → Environments → New environment `produccion` → *Required reviewers*: Rodrigo.

**Merge automático**: Settings → General → marcar *Allow auto-merge* y *Automatically delete head branches*. Settings → Branches → regla para `main` con *Require status checks to pass*: `Invariantes de la base de datos` y `Pruebas y tipos del monorepo`.

### Abrir un respaldo

Descargarlo desde Railway (bucket `respaldos`) y descifrarlo con la frase de `RESPALDO_CLAVE`:

```bash
gpg --decrypt respaldo-AAAAMMDD-HHMM-xxxxxxx.tgz.gpg | tar -xzf -
```

Quedan `esquema.sql` y `datos.sql`. Se borran solos a los 30 días.

## Base de datos (Supabase)

Las migraciones viven en `db/migrations/` y se copian a `supabase/migrations/`.

```bash
corepack pnpm db:sync
corepack pnpm exec supabase link --project-ref opoeeyxpharopjftfdnt
corepack pnpm exec supabase db push
corepack pnpm exec supabase migration list --linked
```

`db push` pide la contraseña de la base (guardada en el gestor de contraseñas, nunca en el repositorio).

Desde la Beta (migraciones 0006–0017), `db push` también programa con `pg_cron` el control diario (`compas-control-diario`, 23:00 UTC = 20:00 de Santiago en verano) y la retención (`compas-retencion`). Para revisarlos: SQL Editor → `select jobname, schedule from cron.job;`.

### Funciones de IA (ADR-04, D31)

```bash
corepack pnpm exec supabase functions deploy ia-extraer-cartola ia-clasificar ia-chat ia-texto --project-ref opoeeyxpharopjftfdnt
corepack pnpm exec supabase secrets set ANTHROPIC_API_KEY=<clave> --project-ref opoeeyxpharopjftfdnt
```

Sin `ANTHROPIC_API_KEY` las funciones responden 503 y la app usa sus reglas: la Beta funciona completa sin IA. Opcional: `CLAUDE_MODELO_LIVIANO` y `CLAUDE_MODELO_MAYOR` para cambiar de modelo. La IA solo procesa datos de quien tiene vigente el consentimiento `analitica_ia`.

### Ajustes del panel que `db push` no sube (una sola vez)

1. **Settings → API → Data API → Exposed schemas**: agregar `app`, `gob`, `fin`, `plan`, `med`, `ref`, `ia`. Sin esto la app no puede leer ni guardar (error `PGRST106 Invalid schema`).
2. **Authentication → Sign In / Providers**: desactivar **Allow new users to sign up** (registro público cerrado, D28). El proveedor **Email** queda activo; en sus opciones, largo mínimo de contraseña **10**.
3. **Authentication → URL Configuration**: *Site URL* = `https://web-production-136d.up.railway.app`.

No se necesita SMTP ni plantillas de correo en el MVP: no se envían correos (D28).

### Cuentas (D28)

Las crea el organizador en **Authentication → Users → Add user → Create new user**: correo, contraseña de al menos 10 caracteres y **Auto Confirm User** marcado. La contraseña se entrega en persona; si alguien la olvida, el organizador la cambia desde el mismo panel. Para la pareja: crear su cuenta aquí y luego invitarla desde la app con el mismo correo; al ingresar queda como co-administradora.

### Respaldo (plan Free, ADR-09)

Antes de cada migración lo toma solo el workflow (ver "Publicación automática"). Además, semanal, a un archivo privado fuera del repositorio:

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

La publicación normal es automática (ver arriba). Para publicar a mano desde la raíz del repositorio:

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

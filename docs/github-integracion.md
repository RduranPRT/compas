# Integración de GitHub con Claude Code

## Qué hay en el repositorio

| Archivo | Qué hace |
| --- | --- |
| `.github/workflows/ci.yml` | Pruebas de la base de datos y del monorepo en cada push y pull request |
| `.github/workflows/claude.yml` | Claude responde a `@claude` en comentarios de issues y pull requests; puede correr `./db/run_tests.sh` |
| `.github/workflows/revision.yml` | Claude revisa cada pull request contra `CLAUDE.md` y comenta en línea |
| `.github/ISSUE_TEMPLATE/` | Plantillas: Spec, Ajuste de marcha blanca, Error |
| `scripts/crear-issues.sh` | Crea etiquetas y los issues de la hoja de ruta |

Crear un issue no dispara a Claude: solo los comentarios que mencionan `@claude`. Así controlas cuándo trabaja y cuánto consume.

## Configuración (una sola vez)

1. **Claude GitHub App**: instalar en [github.com/apps/claude](https://github.com/apps/claude) → *Only select repositories* → `RduranPRT/compas`.
2. **Token de la suscripción**: en tu computador, con Claude Code instalado, ejecuta `claude setup-token` y copia el token.
3. **Secreto del repositorio**: GitHub → Settings → Secrets and variables → Actions → *New repository secret* → nombre `CLAUDE_CODE_OAUTH_TOKEN`, valor: el token.
4. **Claude Code web**: en [claude.ai/code](https://claude.ai/code) conecta GitHub y elige `compas`.
5. **Rutinas** en [claude.ai/code/routines](https://claude.ai/code/routines) (opcional):
   - *Estado semanal*: lunes 8:50, repositorio `compas`, prompt: "Ejecuta /siguiente y resume en 5 líneas: qué spec sigue, qué pull requests esperan revisión y qué falla en el CI".

## Uso diario

| Quiero | Escribo en GitHub |
| --- | --- |
| Que Claude planifique una spec aprobada | Comentario en el issue: `@claude /planificar 003` |
| Que la implemente | `@claude /tareas 003` y luego `@claude /implementar 003` |
| Que verifique antes de cerrar | `@claude /verificar 003` |
| Corregir algo en un pull request | Comentario en la línea: `@claude cambia esto para que use enteros` |
| Registrar algo visto en el uso real | Issue "Ajuste de marcha blanca" + comentario `@claude /ajustar` |
| Que corrija el CI solo | En la sesión de claude.ai/code del pull request, activar **Auto-fix** |

Cada pull request pasa por el CI y por la revisión automática; el merge lo haces tú.

## Costos

Cada ejecución usa minutos de GitHub Actions y el uso de tu suscripción Claude. El workflow limita cada ejecución a 80 turnos y 60 minutos.

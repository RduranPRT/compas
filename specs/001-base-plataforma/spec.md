# Spec 001 · Base de la plataforma, hogar y acceso

Estado: aprobada · Fecha: 2026-10-12 · Épica: EP01, EP14
Procesos: P1 (pasos 1 y 6), E1, S5 · Reglas: R25, R39 · Decisiones: D17, D21, D23, ADR-03, ADR-09 · Depende de: —

## Objetivo

Que la familia pueda instalar la app, iniciar sesión, crear el hogar con sus integrantes y dejar firmado el Acuerdo del Hogar v1 con el inicio del piloto, sobre una base de datos segura donde cada hogar ve solo lo suyo.

## Historias de usuario

- **HU-001-1** Como organizador, quiero crear el hogar e invitar a mi pareja como co-administradora para que ambos administremos las finanzas.
- **HU-001-2** Como organizador, quiero indicar cuántos hijos tenemos y registrarlos (nombre o apodo y mesada) con el consentimiento parental, sin que ellos necesiten cuenta propia en el MVP.
- **HU-001-3** Como integrante, quiero iniciar sesión con mi correo sin recordar contraseñas.
- **HU-001-4** Como administradores, queremos firmar el Acuerdo v1 con los parámetros por defecto para empezar el piloto el 1 de octubre.
- **HU-001-5** Como integrante, quiero aceptar el uso de la app y, si quiero, el análisis con IA, sabiendo qué datos salen de Chile.

## Criterios de aceptación

```gherkin
Característica: Hogar, integrantes y acceso (S5, R25, R39)

  Escenario: Crear el hogar
    Dado un usuario autenticado sin hogar
    Cuando crea el hogar "Durán Damann" con su nombre
    Entonces existe el hogar con etapa inicial E0 pendiente de diagnóstico
    Y el usuario queda como integrante ORG vinculado a su cuenta
    Y se registra el evento HogarCreado
    Y se crean los períodos octubre, noviembre y diciembre de 2026 con su sobre Por asignar

  Escenario: Invitar a la co-administradora
    Dado un hogar con su ORG
    Cuando el ORG invita a un correo con rol CAD
    Entonces al iniciar sesión con ese correo el usuario queda como CAD del mismo hogar
    Y el CAD queda registrado como suplente del ORG (R39)

  Escenario: Registrar a los hijos sin cuenta propia (R25, D26)
    Dado un hogar con ORG
    Cuando en el levantamiento de información el ORG indica que el hogar tiene 2 hijos
    Y registra a cada uno con nombre o apodo, rol MEN y otorga el consentimiento datos_menor
    Entonces existen 2 integrantes MEN sin usuario_auth_id
    Y el consentimiento queda con titular el menor y otorgado por el ORG
    Y sin ese consentimiento no se puede registrar al menor
    Y la cantidad de hijos se puede cambiar después agregando o desactivando integrantes MEN

  Escenario: Aislamiento entre hogares
    Dado dos hogares con usuarios distintos
    Cuando el usuario del hogar A consulta cuentas, movimientos o integrantes
    Entonces no obtiene ninguna fila del hogar B
    Y no puede insertar filas con el hogar B


  Escenario: Firmar el Acuerdo v1
    Dado un hogar con ORG y CAD
    Cuando el ORG propone el Acuerdo v1 con los parámetros por defecto
    Y el CAD lo firma
    Entonces el Acuerdo v1 queda vigente desde 2026-10-01
    Y el parámetro inicio_piloto vale 2026-10-01 y mes_primer_plan vale 2026-12-01
    Y se registra el evento AcuerdoVersionado

  Escenario: Consentimientos al primer ingreso
    Dado un adulto que inicia sesión por primera vez
    Cuando acepta uso_app
    Entonces puede usar la app
    Y si no acepta analitica_ia, la app funciona sin funciones de IA y lo indica
    Y el texto de consentimiento informa que los datos se alojan en Brasil y que la IA procesa datos minimizados en Estados Unidos
```

## Reglas y cálculos

Parámetros por defecto del Acuerdo v1 (`gob.regla_hogar`):

| Código | Valor | Regla |
| --- | --- | --- |
| inicio_piloto | "2026-10-01" | R41 |
| mes_primer_plan | "2026-12-01" | D21 |
| dia_plan | 25 | P2 |
| dia_ingreso_mes_siguiente | 20 | D01 |
| umbral_ritmo | 1.1 | R09 |
| umbral_ajuste_ingreso_pct | 5 | R33 |
| autoaprobacion_n1_pct | 5 | R38 |
| plazo_suplencia_h | 48 | R39 |
| max_alertas_dia | 3 | R40 |
| hora_resumen_diario | "20:00" | D13 |
| confianza_ia_min | 0.8 | R36 |
| umbral_conciliacion_clp | 1000 | R34 |
| holgura_fijos_pct | 15 | R08 |
| pct_reajuste_a_futuro | 50 | R22 |
| pct_variable_a_futuro | 50 | R45 |
| pct_sin_culpa | 5 | E1 |
| modalidad_sin_culpa | "igual" | D25, ADR-10 |
| estrategia_deuda | "avalancha" | R21, ADR-06 |
| dias_abandono | 14 | D14 |
| tratamiento_cuotas_default | "por_cuota" | D08 |
| dias_retencion_cartola | 30 | R43 |

## Datos

- Migraciones 0001, 0002 y 0003 aplicadas en Supabase.
- RPC nuevas (migración 0005, `SECURITY DEFINER`, validan el JWT):
  - `app.crear_hogar(p_nombre_hogar text, p_nombre text) returns uuid`
  - `app.invitar_integrante(p_correo text, p_nombre text, p_rol gob.rol_integrante) returns uuid` (solo adultos en el MVP)
  - `app.registrar_menor(p_nombre text, p_version_consentimiento text) returns uuid` (integrante MEN sin `usuario_auth_id`; registra el consentimiento `datos_menor` con la versión del texto aceptado en la misma transacción; sin versión no registra)
  - `app.aceptar_invitacion() returns uuid` (vincula `usuario_auth_id` del JWT con la invitación por correo)
  - `app.crear_periodo(p_mes date) returns uuid` (crea período y sobre Por asignar; idempotente)
  - `app.proponer_acuerdo(p_reglas jsonb, p_urgente boolean) returns uuid` y `app.activar_acuerdo(p_acuerdo uuid) returns uuid` (ver plan).
- Tabla nueva `gob.invitacion` (hogar, integrante, correo, rol, estado, vence_en) con RLS para administradores; los hijos no se invitan (D26).
- `gob.acuerdo_hogar`, `gob.regla_hogar`, `gob.solicitud_aprobacion`, `gob.firma` (firma del CAD), `gob.consentimiento`.

## Interfaz

- Inicio de sesión con correo y código de 6 dígitos.
- Asistente de alta en 4 pasos: hogar → integrantes (adultos; luego "¿Cuántos hijos tienen?" y nombre o apodo de cada uno, sin correo) → consentimientos (incluye datos_menor por cada hijo) → Acuerdo v1 (lista legible de parámetros con su explicación y regla).
- En el MVP toda la información la ingresan los padres (D26).
- Portada vacía con el texto "Siguiente paso: cargar tus cuentas" (spec 002).
- Referencia visual: wireframes v2, pantalla P1.

## IA

No interviene.

## Eventos

Emite HogarCreado y AcuerdoVersionado en `sys.evento_dominio`.

## Fuera de alcance

Registro público de otros hogares, recuperación de cuenta por soporte, asesor externo, cambio de etapa (spec 004), cuentas e inicio de sesión de los hijos (V2; la vista "menor ve solo lo suyo" ya está protegida por RLS en 0001 y 0003).

## Preguntas abiertas

- Resuelta 24-10-2026: los hijos no inician sesión en el MVP; toda la información la ingresan los padres (D26).
- Resuelta 24-10-2026: la cantidad de hijos es parametrizable y se ingresa en el levantamiento de información del alta, con nombre o apodo de cada uno.

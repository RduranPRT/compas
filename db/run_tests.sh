#!/usr/bin/env bash
# Aplica todas las migraciones en una base nueva por cada archivo de prueba y compara
# la salida con db/tests/esperado/<prueba>.out. Uso:
#   PGHOST=... PGUSER=... ./db/run_tests.sh            # verificar
#   ACTUALIZAR=1 ./db/run_tests.sh                       # regenerar salidas esperadas
#   SOLO=0004_test_x MOSTRAR=1 ./db/run_tests.sh       # una prueba, mostrando su salida
#   DATABASE_URL=postgresql://usuario:clave@host:puerto/base ./db/run_tests.sh
set -uo pipefail
if [[ -n "${DATABASE_URL:-}" ]]; then
  # postgresql://usuario[:clave]@host[:puerto][/base] → variables PG* (cada prueba crea su propia base)
  if [[ ! "$DATABASE_URL" =~ ^postgres(ql)?://([^:@/]+)(:([^@/]*))?@([^:/]+)(:([0-9]+))?(/.*)?$ ]]; then
    echo "DATABASE_URL no reconocida"; exit 2
  fi
  export PGUSER="${BASH_REMATCH[2]}" PGPASSWORD="${BASH_REMATCH[4]}" PGHOST="${BASH_REMATCH[5]}" PGPORT="${BASH_REMATCH[7]:-5432}"
fi
export PGOPTIONS="-c client_min_messages=warning"
cd "$(dirname "$0")"
PSQL="psql -X -q -v ON_ERROR_STOP=1"
fallas=0
for prueba in tests/${SOLO:-*}.sql; do
  nombre=$(basename "$prueba" .sql)
  base="compas_test_${nombre//[^a-z0-9_]/_}"
  psql -X -q -c "DROP DATABASE IF EXISTS $base" -c "CREATE DATABASE $base" postgres >/dev/null 2>&1
  for m in migrations/0001_*.sql seed/0001_*.sql $(ls migrations/*.sql | grep -v '/0001_'); do
    $PSQL -d "$base" -f "$m" >/dev/null || { echo "FALLA al aplicar $m"; exit 1; }
  done
  salida=$(psql -X -d "$base" -f "$prueba" 2>&1 | sed -E 's/^psql:[^:]+:[0-9]+: //; /^CONTEXT:/d; s/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/<uuid>/g')
  esperado="tests/esperado/$nombre.out"
  if [[ "${MOSTRAR:-0}" == "1" ]]; then
    printf "%s
" "$salida"
  elif [[ "${ACTUALIZAR:-0}" == "1" ]]; then
    mkdir -p tests/esperado; printf '%s\n' "$salida" > "$esperado"; echo "actualizado $esperado"
  elif diff -u "$esperado" <(printf '%s\n' "$salida") >/tmp/diff_$nombre.txt; then
    echo "OK    $nombre"
  else
    echo "FALLA $nombre"; cat /tmp/diff_$nombre.txt; fallas=$((fallas+1))
  fi
  psql -X -q -c "DROP DATABASE IF EXISTS $base" postgres >/dev/null 2>&1
done
exit $fallas

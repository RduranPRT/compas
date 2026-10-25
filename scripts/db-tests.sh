#!/usr/bin/env bash
# Corre db/run_tests.sh contra la base de `supabase start`, dentro de un contenedor con psql
# (sirve en Windows sin cliente psql). Argumentos: variables extra, p. ej. ACTUALIZAR=1.
set -euo pipefail
cd "$(dirname "$0")/.."
contenedor=supabase_db_compas
imagen=$(docker inspect "$contenedor" --format '{{.Config.Image}}')
red=$(docker inspect "$contenedor" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}')
extra=()
for a in "$@"; do extra+=(-e "$a"); done
MSYS_NO_PATHCONV=1 docker run --rm --network "$red" -v "$PWD/db:/db" \
  -e DATABASE_URL="postgresql://postgres:postgres@$contenedor:5432/postgres" "${extra[@]}" \
  --entrypoint bash "$imagen" /db/run_tests.sh

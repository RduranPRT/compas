#!/usr/bin/env bash
# Copia db/migrations/*.sql (fuente de verdad) a supabase/migrations/ con versión de fecha fija.
# El seed de catálogos va como migración justo después de 0001, igual que en db/run_tests.sh:
# 0002 en adelante depende de él, y supabase/seed.sql no se aplica en `supabase db push`.
# Versión: 20261012 + NNNN + 00 (seed: 0001 + 50). Fija para que `db push` no duplique migraciones.
set -euo pipefail
cd "$(dirname "$0")/.."
destino=supabase/migrations
mkdir -p "$destino"
rm -f "$destino"/*.sql
for m in db/migrations/[0-9][0-9][0-9][0-9]_*.sql; do
  nombre=$(basename "$m")
  num=${nombre%%_*}
  cp "$m" "$destino/20261012${num}00_${nombre#*_}"
done
for s in db/seed/[0-9][0-9][0-9][0-9]_*.sql; do
  nombre=$(basename "$s")
  num=${nombre%%_*}
  cp "$s" "$destino/20261012${num}50_seed_${nombre#*_}"
done
ls "$destino"

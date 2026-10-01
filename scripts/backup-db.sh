#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y-%m-%d_%H-%M-%S)
OUT_DIR="./backups/db"
mkdir -p "$OUT_DIR"

# Uses the running postgres container
docker compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" > "$OUT_DIR/qrcb_${STAMP}.sql"

echo "✅ DB backup: $OUT_DIR/qrcb_${STAMP}.sql"

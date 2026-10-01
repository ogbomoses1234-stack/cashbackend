#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date +%Y-%m-%d)
OUT_DIR="./backups/minio/$STAMP"
mkdir -p "$OUT_DIR"

docker compose exec -T minio mc mirror --preserve local/qrcb-public /tmp/backup-public
docker compose exec -T minio mc mirror --preserve local/qrcb-private /tmp/backup-private

docker compose cp minio:/tmp/backup-public "$OUT_DIR/public"
docker compose cp minio:/tmp/backup-private "$OUT_DIR/private"

echo "✅ MinIO backup: $OUT_DIR"

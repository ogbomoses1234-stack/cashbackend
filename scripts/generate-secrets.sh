#!/usr/bin/env bash
# Generate strong random secrets for local development / production.
set -euo pipefail

gen() { openssl rand -hex "$1" 2>/dev/null || head -c "$1" /dev/urandom | xxd -p -c 256; }

cat <<EOF
# Copy the lines below into your .env file.

PUBLIC_JWT_SECRET=$(gen 32)
ADMIN_JWT_SECRET=$(gen 32)
QR_SIGNING_SECRET=$(gen 32)
DB_PASSWORD=$(gen 16)
REDIS_PASSWORD=$(gen 16)
MINIO_ROOT_PASSWORD=$(gen 16)
MINIO_SECRET_KEY=$(gen 24)

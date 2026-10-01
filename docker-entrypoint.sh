#!/bin/sh
set -e

echo "═══════════════════════════════════════════════"
echo " QR CashBack Backend — Startup"
echo "═══════════════════════════════════════════════"

echo ""
echo "→ Running Prisma migrations..."
npx prisma migrate deploy

echo ""
echo "→ Checking if DB needs seeding..."
USER_COUNT=$(node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.userProfile.count().then(c => { console.log(c); process.exit(0); }).catch(() => { console.log('0'); process.exit(0); });
" 2>/dev/null || echo "0")

echo "  Found $USER_COUNT users"

if [ "$USER_COUNT" = "0" ]; then
  echo "  Empty DB — seeding admin + sample products..."
  npm run seed || echo "  ⚠️  Seed failed or was partial — continuing anyway"
else
  echo "  DB already has users — skipping seed."
fi

echo ""
echo "→ Starting API server..."
exec node dist/server.js

#!/bin/sh
set -e
# ── BOOTSTRAP ADMIN ─────────────────────────────────
if [ -n "$BOOTSTRAP_ADMIN_EMAIL" ] && [ -n "$BOOTSTRAP_ADMIN_PASSWORD" ]; then
  echo ""
  echo "→ Checking bootstrap admin: $BOOTSTRAP_ADMIN_EMAIL..."
  node -e '
    const { PrismaClient } = require("@prisma/client");
    const argon2 = require("argon2");
    const p = new PrismaClient();
    (async () => {
      const email = process.env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase().trim();
      const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
      const fullName = process.env.BOOTSTRAP_ADMIN_NAME || "Admin";

      const existing = await p.authUser.findUnique({ where: { email } });
      if (existing) {
        console.log("  i  Admin already exists: " + email);
        await p.$disconnect();
        return;
      }

      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      await p.authUser.create({
        data: {
          email,
          passwordHash,
          profile: { create: { email, role: "admin", fullName, emailVerified: true } },
        },
      });
      console.log("  OK  Bootstrap admin created: " + email);
      await p.$disconnect();
    })().catch((err) => {
      console.error("  ERR  Bootstrap admin failed:", err.message);
      process.exit(0);
    });
  '
fi

unset BOOTSTRAP_ADMIN_EMAIL
unset BOOTSTRAP_ADMIN_PASSWORD
unset BOOTSTRAP_ADMIN_NAME
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

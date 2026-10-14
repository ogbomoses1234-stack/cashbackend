#!/usr/bin/env python3
"""Add RefreshToken model + UserProfile relation to prisma/schema.prisma."""
import shutil
import re
from pathlib import Path

ROOT = Path(__file__).parent
SCHEMA = ROOT / "prisma" / "schema.prisma"

if not SCHEMA.exists():
    print(f"❌ Not found: {SCHEMA}")
    raise SystemExit(1)

content = SCHEMA.read_text()

# ────────────────────────────────────────────────────────────
# 1. Append RefreshToken model (skip if already present)
# ────────────────────────────────────────────────────────────
if "model RefreshToken" in content:
    print("⚠️  RefreshToken model already exists — skipping append")
else:
    MODEL = '''

// ═══════════════════════════════════════════════════════════
// REFRESH TOKENS (long-lived sessions)
// ═══════════════════════════════════════════════════════════

model RefreshToken {
  id         String    @id @default(uuid())
  userId     String
  tokenHash  String    @unique
  familyId   String
  userAgent  String?
  ipAddress  String?
  expiresAt  DateTime
  revokedAt  DateTime?
  replacedBy String?
  createdAt  DateTime  @default(now())

  user UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([familyId])
  @@index([expiresAt])
  @@map("refresh_tokens")
}
'''
    content = content.rstrip() + "\n" + MODEL
    print("✅ Appended RefreshToken model")

# ────────────────────────────────────────────────────────────
# 2. Add reverse relation to UserProfile
#    (insert as the first line after "model UserProfile {")
# ────────────────────────────────────────────────────────────
if "refreshTokens RefreshToken[]" in content:
    print("⚠️  UserProfile.refreshTokens already exists — skipping")
else:
    pattern = re.compile(r"(model\s+UserProfile\s*\{\s*\n)", re.MULTILINE)
    match = pattern.search(content)
    if not match:
        print("❌ Could not find 'model UserProfile {' in schema.prisma")
        print("   Add this line manually inside the model:")
        print("     refreshTokens RefreshToken[]")
        raise SystemExit(1)

    insert_at = match.end()
    content = (
        content[:insert_at]
        + "  refreshTokens RefreshToken[]\n"
        + content[insert_at:]
    )
    print("✅ Added reverse relation to UserProfile")

# ────────────────────────────────────────────────────────────
# 3. Write with backup
# ────────────────────────────────────────────────────────────
shutil.copy(SCHEMA, str(SCHEMA) + ".bak")
SCHEMA.write_text(content)
print(f"💾 Saved schema.prisma (backup at {SCHEMA.name}.bak)")

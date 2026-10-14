#!/usr/bin/env python3
"""Adds Special Orders (Packages) backend to qrcashback-backend."""
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).parent

def log(ok, msg):
    print(('  ✅ ' if ok else '  ⚠️  ') + msg)

def patch(path, edits):
    p = ROOT / path
    if not p.exists():
        log(False, f'{path} — FILE NOT FOUND')
        return
    content = p.read_text()
    original = content
    for name, fn in edits:
        try:
            new = fn(content)
            if new == content:
                log(False, f'{path} — {name} (no change or pattern missing)')
            else:
                content = new
                log(True, f'{path} — {name}')
        except Exception as e:
            log(False, f'{path} — {name}: {e}')
    if content != original:
        shutil.copy(p, str(p) + '.bak')
        p.write_text(content)

# ────────────────────────────────────────────────────────────
# 1. prisma/schema.prisma
# ────────────────────────────────────────────────────────────
NEW_MODELS = '''

// ═══════════════════════════════════════════════════════════
// PACKAGES (Special Orders / Concierge Shopping)
// ═══════════════════════════════════════════════════════════

enum PackageStatus {
  draft
  submitted
  quoted
  approved
  in_progress
  shipped
  delivered
  cancelled
}

enum PackageEditStatus {
  pending
  approved
  denied
}

model PackageRequest {
  id              String        @id @default(uuid())
  reference       String        @unique
  userId          String
  title           String
  status          PackageStatus @default(draft)
  isEditable      Boolean       @default(true)
  notes           String?
  country         String
  city            String
  deliveryAddress String
  contactPhone    String
  quotedTotal     Decimal?      @db.Decimal(12, 2)
  currency        String        @default("NGN")
  lastMessageAt   DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  user         UserProfile          @relation(fields: [userId], references: [id], onDelete: Cascade)
  items        PackageItem[]
  messages     PackageMessage[]
  editRequests PackageEditRequest[]

  @@index([userId, createdAt])
  @@index([status])
  @@map("package_requests")
}

model PackageItem {
  id             String   @id @default(uuid())
  requestId      String
  productId      String?
  name           String
  details        String?
  quantity       Int      @default(1)
  estimatedPrice Decimal? @db.Decimal(12, 2)
  imageObjectKey String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  request PackageRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)

  @@index([requestId])
  @@map("package_items")
}

model PackageMessage {
  id                  String    @id @default(uuid())
  requestId           String
  senderId            String
  senderRole          String
  body                String    @db.Text
  attachmentObjectKey String?
  readAt              DateTime?
  createdAt           DateTime  @default(now())

  request PackageRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)

  @@index([requestId, createdAt])
  @@map("package_messages")
}

model PackageEditRequest {
  id         String            @id @default(uuid())
  requestId  String
  reason     String            @db.Text
  status     PackageEditStatus @default(pending)
  adminNote  String?
  resolvedAt DateTime?
  createdAt  DateTime          @default(now())

  request PackageRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)

  @@index([requestId])
  @@map("package_edit_requests")
}
'''

patch('prisma/schema.prisma', [
    ('append package models',
     lambda c: c if 'model PackageRequest' in c else c + NEW_MODELS),
    ('add UserProfile.packageRequests relation',
     lambda c: c if 'packageRequests PackageRequest[]' in c
       else c.replace('model UserProfile {',
                      'model UserProfile {\n  packageRequests PackageRequest[]', 1)),
])

# ────────────────────────────────────────────────────────────
# 2. src/utils/generateSerial.ts  (append helper)
# ────────────────────────────────────────────────────────────
PACKAGE_REF = '''
export function generatePackageRef(): string {
  const n = crypto.randomInt(10000, 99999);
  const t = Date.now().toString().slice(-5);
  return `PKG-${t}${n}`;
}
'''

patch('src/utils/generateSerial.ts', [
    ('add generatePackageRef',
     lambda c: c if 'generatePackageRef' in c else c + PACKAGE_REF),
])

# ────────────────────────────────────────────────────────────
# 3. src/config/constants.ts  (add namespace)
# ────────────────────────────────────────────────────────────
patch('src/config/constants.ts', [
    ('add PACKAGE_ITEMS namespace',
     lambda c: c if 'PACKAGE_ITEMS' in c
       else c.replace("AVATARS: 'avatars',",
                      "AVATARS: 'avatars',\n  PACKAGE_ITEMS: 'package-items',", 1)),
])

# ────────────────────────────────────────────────────────────
# 4. src/validators/upload.validator.ts  (allow 'package')
# ────────────────────────────────────────────────────────────
patch('src/validators/upload.validator.ts', [
    ("add 'package' to purpose enum",
     lambda c: c if "'package'" in c
       else c.replace("'avatar', 'product']", "'avatar', 'product', 'package']", 1)),
    ('add packageId to scope',
     lambda c: c if 'packageId' in c
       else c.replace("productId: z.string().uuid().optional(),",
                      "productId: z.string().uuid().optional(),\n        packageId: z.string().uuid().optional(),", 1)),
])

# ────────────────────────────────────────────────────────────
# 5. src/controllers/public/upload.controller.ts  (case + limit)
# ────────────────────────────────────────────────────────────
patch('src/controllers/public/upload.controller.ts', [
    ('add package upload rate limit',
     lambda c: c if 'package: 20' in c
       else c.replace("product: 20,", "product: 20,\n    package: 20,", 1)),
    ('add package namespace case',
     lambda c: c if "case 'package':" in c
       else c.replace(
         "    case 'avatar':",
         "    case 'package':\n      namespace = MEDIA_NAMESPACES.PACKAGE_ITEMS;\n      keyScope = [user.sub, scope?.packageId || 'unsorted'];\n      break;\n    case 'avatar':",
         1)),
])

# ────────────────────────────────────────────────────────────
# 6. src/routes/public/index.ts  (mount)
# ────────────────────────────────────────────────────────────
patch('src/routes/public/index.ts', [
    ('import packageRoutes',
     lambda c: c if "import packageRoutes" in c
       else c.replace("import staffRoutes from './staff.routes';",
                      "import staffRoutes from './staff.routes';\nimport packageRoutes from './package.routes';", 1)),
    ('mount /packages',
     lambda c: c if "router.use('/packages'" in c
       else c.replace("router.use('/staff', staffRoutes);",
                      "router.use('/staff', staffRoutes);\nrouter.use('/packages', packageRoutes);", 1)),
])

# ────────────────────────────────────────────────────────────
# 7. src/routes/admin/index.ts  (mount)
# ────────────────────────────────────────────────────────────
patch('src/routes/admin/index.ts', [
    ('import admin packageRoutes',
     lambda c: c if "packageRoutes" in c
       else c.replace("import uploadRoutes from './upload.routes';",
                      "import uploadRoutes from './upload.routes';\nimport packageRoutes from './package.routes';", 1)),
    ('mount /packages',
     lambda c: c if "router.use('/packages'" in c
       else c.replace("router.use('/uploads', uploadRoutes);",
                      "router.use('/uploads', uploadRoutes);\nrouter.use('/packages', packageRoutes);", 1)),
])

# ────────────────────────────────────────────────────────────
# 8. src/services/email.service.ts  (add 2 methods)
# ────────────────────────────────────────────────────────────
EMAIL_METHODS = '''
  static async sendPackageStatus(to: string, reference: string, status: string) {
    const label = status.replace('_', ' ');
    await this.send(
      to,
      `Your package #${reference} is now ${label}`,
      `<p>Update on your special-order list <b>#${reference}</b>: the status is now <b>${label}</b>.</p>`
    );
  }

  static async sendPackageEditDecision(
    to: string,
    reference: string,
    decision: 'approved' | 'denied'
  ) {
    await this.send(
      to,
      decision === 'approved'
        ? `Edit approved for #${reference}`
        : `Edit request declined for #${reference}`,
      decision === 'approved'
        ? `<p>Your edit request for <b>#${reference}</b> was approved. You can now update the list.</p>`
        : `<p>Your edit request for <b>#${reference}</b> was declined. Check the chat for details.</p>`
    );
  }

'''

def add_email_methods(c):
    if 'sendPackageStatus' in c:
        return c
    # Insert methods right before the final closing brace of the class
    # Find the last "}" in the file (the class close) and insert before it.
    idx = c.rstrip().rfind('}')
    if idx == -1:
        return c
    return c[:idx] + EMAIL_METHODS + c[idx:]

patch('src/services/email.service.ts', [
    ('add sendPackageStatus + sendPackageEditDecision', add_email_methods),
])

print('\n✅ All patches attempted. Backups written as *.bak')
print('   Next: create the new files (Step 2).\n')

#!/usr/bin/env python3
"""
Add POST /api/public/payout to save the customer's default payout account.
Stores on UserProfile (payoutBankCode, payoutAccountNumber, payoutAccountName).
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path.cwd()

print("═" * 60)
print(" Add Payout Save Endpoint")
print("═" * 60)

# ═══════════════════════════════════════════════════════════════
# 1. Prisma — add payout fields to UserProfile
# ═══════════════════════════════════════════════════════════════
print("\n[1] Prisma schema")
schema = ROOT / "prisma/schema.prisma"
src = schema.read_text(encoding="utf-8")

if "payoutAccountNumber" not in src:
    # Insert after deliveryAddress in UserProfile
    pattern = r'(deliveryAddress\s+String\?\s+@map\("delivery_address"\))'
    if re.search(pattern, src):
        src = re.sub(
            pattern,
            r'\1\n  payoutBankCode       String?   @map("payout_bank_code") @db.VarChar(10)\n'
            r'  payoutAccountNumber  String?   @map("payout_account_number") @db.VarChar(10)\n'
            r'  payoutAccountName    String?   @map("payout_account_name") @db.VarChar(120)',
            src, count=1,
        )
        schema.write_text(src, encoding="utf-8")
        print("   ✅ Added 3 payout fields to UserProfile")
    else:
        print("   ⚠️  Could not find deliveryAddress — check schema")
        sys.exit(1)
else:
    print("   ℹ️  payout fields already present")

# ═══════════════════════════════════════════════════════════════
# 2. Validator — add payout save schema
# ═══════════════════════════════════════════════════════════════
print("\n[2] Validator")
v = ROOT / "src/validators/payout.validator.ts"
src = v.read_text(encoding="utf-8")

if "savePayoutSchema" not in src:
    src += """
export const savePayoutSchema = z.object({
  body: z.object({
    bankCode: z.string().min(3).max(10),
    accountNumber: z.string().regex(/^\\d{10}$/, 'Account number must be 10 digits'),
    accountName: z.string().min(2).max(120),
  }),
});
"""
    v.write_text(src, encoding="utf-8")
    print("   ✅ Added savePayoutSchema")
else:
    print("   ℹ️  savePayoutSchema already exists")

# ═══════════════════════════════════════════════════════════════
# 3. Controller — add savePayout + getPayout
# ═══════════════════════════════════════════════════════════════
print("\n[3] Controller")
ctrl = ROOT / "src/controllers/public/payout.controller.ts"
src = ctrl.read_text(encoding="utf-8")

# Ensure prisma import
if "from '../../config/database'" not in src:
    src = "import { prisma } from '../../config/database';\n" + src

# Ensure ApiError import
if "ApiError" not in src:
    src = "import { ApiError } from '../../utils/ApiError';\n" + src

if "savePayout" not in src:
    src += """
export const savePayout = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { bankCode, accountNumber, accountName } = req.body;

  const updated = await prisma.userProfile.update({
    where: { id: req.user.sub },
    data: {
      payoutBankCode: bankCode,
      payoutAccountNumber: accountNumber,
      payoutAccountName: accountName,
    },
    select: {
      payoutBankCode: true,
      payoutAccountNumber: true,
      payoutAccountName: true,
    },
  });

  return ApiResponse.success(res, updated, 'Payout account saved');
});

export const getPayout = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const profile = await prisma.userProfile.findUnique({
    where: { id: req.user.sub },
    select: {
      payoutBankCode: true,
      payoutAccountNumber: true,
      payoutAccountName: true,
    },
  });

  return ApiResponse.success(res, profile ?? {});
});
"""
    ctrl.write_text(src, encoding="utf-8")
    print("   ✅ Added savePayout + getPayout controllers")
else:
    print("   ℹ️  controllers already present")

# ═══════════════════════════════════════════════════════════════
# 4. Route — add POST / and GET /
# ═══════════════════════════════════════════════════════════════
print("\n[4] Route")
routes = ROOT / "src/routes/public/payout.routes.ts"
src = routes.read_text(encoding="utf-8")

if "router.post('/'" not in src and "router.post('/'" not in src.replace('"', "'"):
    # Add imports
    if "savePayoutSchema" not in src:
        src = src.replace(
            "import { verifyAccountQuery } from '../../validators/payout.validator';",
            "import { verifyAccountQuery, savePayoutSchema } from '../../validators/payout.validator';",
        )
    # Add routes before `export default`
    src = src.replace(
        "export default router;",
        """router.get('/', payoutController.getPayout);
router.post('/', validate(savePayoutSchema), payoutController.savePayout);

export default router;""",
    )
    routes.write_text(src, encoding="utf-8")
    print("   ✅ Added GET / + POST / routes")
else:
    print("   ℹ️  routes already added")

# ═══════════════════════════════════════════════════════════════
# 5. Run migration + generate
# ═══════════════════════════════════════════════════════════════
print("\n[5] Migration")
result = subprocess.run(
    ["npx", "prisma", "migrate", "dev", "--name", "add_payout_fields", "--skip-generate"],
    cwd=ROOT, capture_output=True, text=True,
)
if result.returncode == 0:
    print("   ✅ Migration applied")
elif "already in sync" in (result.stdout + result.stderr):
    print("   ℹ️  Schema already in sync")
else:
    print("   ⚠️  Migration issue:")
    print("     " + (result.stdout + result.stderr).strip()[:300])

# Always regenerate client
gen = subprocess.run(["npx", "prisma", "generate"], cwd=ROOT, capture_output=True, text=True)
if gen.returncode == 0:
    print("   ✅ Prisma client regenerated")
else:
    print("   ⚠️  Generate failed:", gen.stderr[:200])

print("\n" + "═" * 60)
print(" ✅ Done")
print("═" * 60)
print("""
Next:

  npx tsc --noEmit
  # (Ctrl+C the dev server, then:)
  npm run dev

Then in the app:
  1. /payout → pick UBA → enter 10-digit account → Save
  2. Should succeed
  3. Then try withdrawal
""")

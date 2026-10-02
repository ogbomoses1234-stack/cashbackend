#!/usr/bin/env python3
"""
Add GET /api/admin/withdrawals/:id — returns the withdrawal plus
every serial that funded it (via cashback_credit transactions).

Handles:
  • schema uses bankCode (not bankName) → resolves via helper
  • avoids route collision with /:id/approve and /:id/decline
  • idempotent — safe to re-run
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path.cwd()
if not (ROOT / "prisma/schema.prisma").exists():
    sys.exit("❌ Run from ~/qrcashback-backend")

print("═" * 60)
print(" Add Withdrawal Detail Endpoint")
print("═" * 60)

# ═══════════════════════════════════════════════════════════════
# 1. Ensure resolveBankName exists in the withdrawal service
# ═══════════════════════════════════════════════════════════════
print("\n[1] Verify bank name helper")
svc = ROOT / "src/services/withdrawal.service.ts"
svc_src = svc.read_text(encoding="utf-8")

if "resolveBankName" not in svc_src:
    helper = '''
/* ═══════════════════════════════════════════════════════════
   Nigerian bank code → name fallback (from previous update)
═══════════════════════════════════════════════════════════ */
const BANK_NAMES: Record<string, string> = {
  '033': 'UBA', '044': 'Access Bank', '058': 'GTBank', '057': 'Zenith Bank',
  '011': 'First Bank', '214': 'First City Monument Bank', '070': 'Fidelity Bank',
  '076': 'Polaris Bank', '082': 'Keystone Bank', '101': 'Providus Bank',
  '221': 'Stanbic IBTC', '232': 'Sterling Bank', '301': 'Jaiz Bank',
  '302': 'Wema Bank', '303': 'Union Bank', '307': 'Ecobank',
  '100033': 'PalmPay', '999991': 'Moniepoint', '999992': 'OPay',
};

export function resolveBankName(bankCode: string, fallback?: string | null): string {
  if (fallback && fallback.trim()) return fallback;
  return BANK_NAMES[bankCode] ?? `Bank (${bankCode})`;
}
'''
    m = re.search(r"^(import .+\n)+", svc_src, re.MULTILINE)
    if m:
        svc_src = svc_src[:m.end()] + helper + svc_src[m.end():]
    else:
        svc_src = helper + svc_src
    svc.write_text(svc_src, encoding="utf-8")
    print("   ✅ Added resolveBankName helper")
else:
    print("   ℹ️  resolveBankName already present")

# ═══════════════════════════════════════════════════════════════
# 2. Append getWithdrawalDetail to the controller
# ═══════════════════════════════════════════════════════════════
print("\n[2] Add controller method")
ctrl = ROOT / "src/controllers/admin/withdrawal.controller.ts"
backup = ctrl.with_suffix(".ts.bak")

if ctrl.exists() and not backup.exists():
    shutil.copy2(ctrl, backup)
    print(f"   ✅ Backed up to {backup.name}")

src = ctrl.read_text(encoding="utf-8")

if "getWithdrawalDetail" in src:
    print("   ℹ️  controller already has getWithdrawalDetail")
else:
    method = '''

/* ═══════════════════════════════════════════════════════════
   GET /api/admin/withdrawals/:id
   Returns the withdrawal + every serial that funded it.

   For each cashback_credit transaction tied to this user
   BEFORE the withdrawal was created, we look up the serial
   via `reference` (which stores the serial number) and
   include its dispatcher + redeemer details.
═══════════════════════════════════════════════════════════ */
export const getWithdrawalDetail = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  /* ─── 1. Load withdrawal + customer ─────────────────── */
  const withdrawal = await prisma.withdrawalRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, fullName: true, email: true, phoneNumber: true },
      },
    },
  });

  if (!withdrawal) {
    return res.status(404).json({
      success: false,
      error: { code: 'WITHDRAWAL_NOT_FOUND', message: 'Withdrawal not found' },
    });
  }

  /* ─── 2. Find cashback credits BEFORE this withdrawal ─── */
  const credits = await prisma.transaction.findMany({
    where: {
      userId: withdrawal.userId,
      type: 'cashback_credit',
      createdAt: { lte: withdrawal.createdAt },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  /* ─── 3. Collect serial numbers from references ──────── */
  const serialNumbers = credits
    .map((c) => c.reference)
    .filter((s): s is string => !!s);

  /* ─── 4. Load those serials with dispatch + redeem ───── */
  const serials = serialNumbers.length
    ? await prisma.productSerial.findMany({
        where: { serialNumber: { in: serialNumbers } },
        include: {
          product: { select: { id: true, title: true } },
          dispatcher: {
            select: {
              id: true, fullName: true, email: true,
              phoneNumber: true, role: true, staffCode: true,
            },
          },
          redeemer: {
            select: {
              id: true, fullName: true, email: true,
              phoneNumber: true, role: true,
            },
          },
        },
      })
    : [];

  const serialMap = new Map(serials.map((s) => [s.serialNumber, s]));

  /* ─── 5. Build the linkedSerials array ───────────────── */
  const linkedSerials = credits.map((c) => {
    const serial = c.reference ? serialMap.get(c.reference) : undefined;

    if (!serial) {
      return {
        serialNumber: c.reference ?? '—',
        creditedAt: c.createdAt.toISOString(),
        creditedAmount: c.amount.toString(),
        serialFound: false,
      };
    }

    let timeToRedeemSeconds: number | null = null;
    if (serial.dispatchedAt && serial.redeemedAt) {
      const diff =
        new Date(serial.redeemedAt).getTime() -
        new Date(serial.dispatchedAt).getTime();
      if (isFinite(diff) && diff >= 0) {
        timeToRedeemSeconds = Math.round(diff / 1000);
      }
    }

    return {
      serialNumber: serial.serialNumber,
      productTitle: serial.product?.title ?? '—',
      serialStatus: serial.status,
      creditedAt: c.createdAt.toISOString(),
      creditedAmount: c.amount.toString(),
      serialFound: true,
      dispatchedBy: serial.dispatcher ?? null,
      dispatchedAt: serial.dispatchedAt?.toISOString() ?? null,
      redeemedBy: serial.redeemer ?? null,
      redeemedAt: serial.redeemedAt?.toISOString() ?? null,
      timeToRedeemSeconds,
    };
  });

  /* ─── 6. Summary ─────────────────────────────────────── */
  const withStaff = linkedSerials.filter(
    (s) => s.serialFound && (s as { dispatchedBy?: unknown }).dispatchedBy
  ).length;
  const withoutStaff = linkedSerials.filter(
    (s) => s.serialFound && !(s as { dispatchedBy?: unknown }).dispatchedBy
  ).length;
  const totalCredited = linkedSerials.reduce(
    (sum, s) => sum + parseFloat(s.creditedAmount || '0'),
    0
  );

  /* ─── 7. Resolve bankName from the code ──────────────── */
  const { resolveBankName } = await import('../../services/withdrawal.service');
  const bankName = resolveBankName(
    withdrawal.bankCode,
    (withdrawal as unknown as { bankName?: string | null }).bankName ?? null
  );

  /* ─── 8. Response ────────────────────────────────────── */
  return ApiResponse.success(res, {
    id: withdrawal.id,
    amount: withdrawal.amount.toString(),
    status: withdrawal.status,
    bankCode: withdrawal.bankCode,
    bankName,
    accountNumber: withdrawal.accountNumber,
    accountName: withdrawal.accountName,
    declineReason: withdrawal.declineReason ?? null,
    processedBy: withdrawal.processedBy ?? null,
    processedAt: (withdrawal as unknown as { updatedAt?: Date }).updatedAt?.toISOString?.() ?? null,
    createdAt: withdrawal.createdAt.toISOString(),
    customer: {
      id: withdrawal.user.id,
      fullName: withdrawal.user.fullName ?? '—',
      email: withdrawal.user.email,
      phoneNumber: withdrawal.user.phoneNumber ?? null,
    },
    linkedSerials,
    summary: {
      totalSerials: linkedSerials.length,
      withStaffDispatch: withStaff,
      withoutStaffDispatch: withoutStaff,
      totalCredited: totalCredited.toFixed(2),
    },
  });
});
'''
    src = src.rstrip() + method
    ctrl.write_text(src, encoding="utf-8")
    print("   ✅ Added getWithdrawalDetail")

# ═══════════════════════════════════════════════════════════════
# 3. Register the route — MUST come after any specific route
# ═══════════════════════════════════════════════════════════════
print("\n[3] Register route")
routes = ROOT / "src/routes/admin/withdrawal.routes.ts"
src = routes.read_text(encoding="utf-8")

if "getWithdrawalDetail" not in src:
    # Add to the end (after approve/decline routes)
    src = src.replace(
        "export default router;",
        "router.get('/:id', withdrawalController.getWithdrawalDetail);\n\nexport default router;",
    )
    routes.write_text(src, encoding="utf-8")
    print("   ✅ Registered GET /:id")
else:
    print("   ℹ️  route already registered")

# ═══════════════════════════════════════════════════════════════
# 4. Type check
# ═══════════════════════════════════════════════════════════════
print("\n[4] TypeScript check")
tsc = subprocess.run(["npx", "tsc", "--noEmit"], cwd=ROOT, capture_output=True, text=True)
if tsc.returncode == 0:
    print("   ✅ TypeScript clean")
else:
    print("   ⚠️  TS errors:")
    print(tsc.stdout)
    print(tsc.stderr)

print("\n" + "═" * 60)
print(" ✅ Done")
print("═" * 60)
print("""
Next:

  # Ctrl+C the dev server, then:
  npm run dev

Test:

  # Find a withdrawal ID
  docker compose exec -T postgres psql -U qrcb -d qrcb_db -t -A -c \\
    "SELECT id, amount, status FROM withdrawal_requests ORDER BY created_at DESC LIMIT 3;"

  # Then test the detail endpoint
  curl -s http://localhost:5001/api/admin/withdrawals/PASTE_WITHDRAWAL_ID \\
    -b /tmp/admin.txt | python3 -m json.tool
""")

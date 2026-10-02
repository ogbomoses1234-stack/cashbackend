#!/usr/bin/env python3
"""
DEV MODE: Auto-dispatch a 'Created' serial when a customer scans it.
This bypasses the staff-scan step for local testing only.

Controlled by DEV_AUTO_DISPATCH=true in .env
"""
import re
from pathlib import Path

ROOT = Path.cwd()

# ═══════════════════════════════════════════════════════════════
# 1. Update .env with the flag
# ═══════════════════════════════════════════════════════════════
print("── 1. .env flag ──")
env = ROOT / ".env"
env_ex = ROOT / ".env.example"

def upsert(path: Path, key: str, value: str):
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    lines = [l for l in lines if not l.startswith(f"{key}=")]
    lines.append(f"{key}={value}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")

if env.exists():
    txt = env.read_text(encoding="utf-8")
    if "DEV_AUTO_DISPATCH" not in txt:
        upsert(env, "DEV_AUTO_DISPATCH", "true")
        print("   ✅ .env — DEV_AUTO_DISPATCH=true")
    else:
        print("   ℹ️  .env already has DEV_AUTO_DISPATCH")

if env_ex.exists():
    upsert(env_ex, "DEV_AUTO_DISPATCH", "false")
    print("   ✅ .env.example — DEV_AUTO_DISPATCH=false")

# ═══════════════════════════════════════════════════════════════
# 2. Update config/index.ts — parse the flag
# ═══════════════════════════════════════════════════════════════
print("\n── 2. config ──")
cfg = ROOT / "src/config/index.ts"
src = cfg.read_text(encoding="utf-8")

if "devAutoDispatch" not in src:
    # Add to zod schema
    src = src.replace(
        "OTP_MAX_ATTEMPTS: z.string().default('5'),",
        "OTP_MAX_ATTEMPTS: z.string().default('5'),\n  DEV_AUTO_DISPATCH: z.string().default('false'),",
        1,
    )
    # Add to business config
    src = src.replace(
        "otpMaxAttempts: parseInt(parsed.data.OTP_MAX_ATTEMPTS, 10),",
        "otpMaxAttempts: parseInt(parsed.data.OTP_MAX_ATTEMPTS, 10),\n    devAutoDispatch: parsed.data.DEV_AUTO_DISPATCH === 'true',",
        1,
    )
    cfg.write_text(src, encoding="utf-8")
    print("   ✅ config/index.ts — added devAutoDispatch flag")
else:
    print("   ℹ️  config already has devAutoDispatch")

# ═══════════════════════════════════════════════════════════════
# 3. Update scan.service.ts — auto-dispatch in dev
# ═══════════════════════════════════════════════════════════════
print("\n── 3. scan.service.redeemSerial ──")
svc = ROOT / "src/services/scan.service.ts"
src = svc.read_text(encoding="utf-8")

# Ensure config is imported
if "import { config }" not in src:
    src = src.replace(
        "import { prisma } from '../config/database';",
        "import { prisma } from '../config/database';\nimport { config } from '../config';",
        1,
    )

old_block = """    if (serial.status === 'Redeemed') {
      throw ApiError.conflict('QR_ALREADY_REDEEMED', 'This voucher has already been claimed');
    }
    if (serial.status !== 'Dispatched') {
      throw ApiError.badRequest('QR_NOT_DISPATCHED', 'Product not yet released for sale');
    }"""

new_block = """    if (serial.status === 'Redeemed') {
      throw ApiError.conflict('QR_ALREADY_REDEEMED', 'This voucher has already been claimed');
    }

    // ─── DEV MODE: auto-dispatch a 'Created' serial ───
    // In production this is disabled so staff MUST scan first.
    // In dev, this lets you test the full cashback flow without
    // manually running the staff scan step.
    if (serial.status === 'Created' && config.business.devAutoDispatch) {
      logger.warn('DEV: auto-dispatching Created serial on customer scan', {
        serialNumber,
        customerId,
      });

      await prisma.productSerial.update({
        where: { serialNumber },
        data: {
          status: 'Dispatched',
          dispatchedAt: new Date(),
        },
      });

      await prisma.serialScanLog.create({
        data: {
          serialNumber,
          scannedBy: customerId,
          scanType: 'staff_dispatch',
          ipAddress: ip,
          userAgent,
          geoLat: null,
          geoLng: null,
        } as any,
      });

      // Refresh in-memory serial
      serial.status = 'Dispatched';
    } else if (serial.status !== 'Dispatched') {
      throw ApiError.badRequest('QR_NOT_DISPATCHED', 'Product not yet released for sale');
    }"""

if "DEV: auto-dispatching" in src:
    print("   ℹ️  redeem already has dev auto-dispatch")
elif old_block in src:
    src = src.replace(old_block, new_block, 1)
    svc.write_text(src, encoding="utf-8")
    print("   ✅ scan.service.ts — dev auto-dispatch added")
else:
    # Try looser pattern
    pattern = re.compile(
        r"if\s*\(serial\.status\s*===\s*'Redeemed'\)\s*\{[\s\S]*?if\s*\(serial\.status\s*!==\s*'Dispatched'\)\s*\{[\s\S]*?\}",
        re.MULTILINE,
    )
    m = pattern.search(src)
    if m:
        src = src[:m.start()] + new_block + src[m.end():]
        svc.write_text(src, encoding="utf-8")
        print("   ✅ scan.service.ts — dev auto-dispatch added (regex)")
    else:
        print("   ⚠️  Could not find the status check block — MANUAL patch needed")
        m2 = re.search(r"if\s*\(serial\.status\s*===\s*'Redeemed'\)[\s\S]{0,400}", src)
        if m2:
            print("   Printing the block for inspection:")
            print(m2.group(0))

print("\n" + "═" * 60)
print(" ✅ Done")
print("═" * 60)
print("""
Next:

  npx tsc --noEmit
  # (Ctrl+C the dev server, then:)
  npm run dev

  # Then scan the QR again with your phone
  # The backend will log:
  #   "DEV: auto-dispatching Created serial on customer scan"
  # And the customer will see cashback credited.

To turn off in production:
  Set DEV_AUTO_DISPATCH=false in .env
""")

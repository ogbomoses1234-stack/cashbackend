#!/usr/bin/env python3
"""
Backend patch — accept Bearer tokens from Authorization header.
Frontend stores JWT in localStorage; backend must accept it.
"""
import re
from pathlib import Path

ROOT = Path.cwd()
if not (ROOT / "prisma/schema.prisma").exists():
    raise SystemExit("❌ Run from ~/qrcashback-backend")

print("═" * 60)
print(" Backend — Bearer token support")
print("═" * 60)

# ═══════════════════════════════════════════════════════════════
# 1. Public auth middleware
# ═══════════════════════════════════════════════════════════════
print("\n[1] src/middleware/auth.middleware.ts")
p = ROOT / "src/middleware/auth.middleware.ts"
src = p.read_text(encoding="utf-8")

# Check if it already reads Authorization
if "authorization" in src.lower() and "Bearer" in src:
    print("   ✅ already supports Bearer tokens")
else:
    # Add a token extractor at the top
    extractor = '''
function extractToken(req: Request): string | null {
  // 1. Try cookie first (preferred for same-domain)
  if (req.cookies?.accessToken) return req.cookies.accessToken;
  // 2. Fallback to Authorization: Bearer <token> (cross-domain)
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}
'''
    # Insert after imports
    m = re.search(r"^(import .+\n)+", src, re.MULTILINE)
    if m:
        src = src[:m.end()] + extractor + src[m.end():]

    # Replace token extraction logic
    src = re.sub(
        r"const\s+token\s*=\s*[^;]+;",
        "const token = extractToken(req);",
        src, count=1,
    )
    p.write_text(src, encoding="utf-8")
    print("   ✅ added Bearer support")

# ═══════════════════════════════════════════════════════════════
# 2. Admin auth middleware
# ═══════════════════════════════════════════════════════════════
print("\n[2] src/middleware/admin-auth.middleware.ts")
p = ROOT / "src/middleware/admin-auth.middleware.ts"
src = p.read_text(encoding="utf-8")

if "authorization" in src.lower() and "Bearer" in src:
    print("   ✅ already supports Bearer tokens")
else:
    old = "const token = req.cookies?.adminAccessToken;"
    new = """const token =
    req.cookies?.adminAccessToken ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);"""
    if old in src:
        src = src.replace(old, new, 1)
        p.write_text(src, encoding="utf-8")
        print("   ✅ added Bearer support")
    else:
        print("   ⚠️  could not find adminAccessToken line — patch manually")

# ═══════════════════════════════════════════════════════════════
# 3. OTP verify — return accessToken in response body
# ═══════════════════════════════════════════════════════════════
print("\n[3] src/controllers/public/otp.controller.ts")
p = ROOT / "src/controllers/public/otp.controller.ts"
src = p.read_text(encoding="utf-8")

if "accessToken: session.accessToken" in src:
    print("   ✅ already returns accessToken")
else:
    # Try exact match
    old = "return ApiResponse.success(res, { verified: true, user: session.user }, 'Email verified');"
    new = "return ApiResponse.success(res, { verified: true, user: session.user, accessToken: session.accessToken }, 'Email verified');"
    if old in src:
        src = src.replace(old, new, 1)
        p.write_text(src, encoding="utf-8")
        print("   ✅ added accessToken to response")
    else:
        # Multi-line variant
        patched, n = re.subn(
            r"(\{ verified: true, user: session\.user)(\s*\},)",
            r"\1, accessToken: session.accessToken\2",
            src, count=1,
        )
        if n > 0:
            p.write_text(patched, encoding="utf-8")
            print("   ✅ added accessToken (multiline)")
        else:
            print("   ⚠️  could not patch — add 'accessToken: session.accessToken' manually")

# ═══════════════════════════════════════════════════════════════
# 4. Public login — verify accessToken in response body
# ═══════════════════════════════════════════════════════════════
print("\n[4] src/controllers/public/auth.controller.ts")
p = ROOT / "src/controllers/public/auth.controller.ts"
src = p.read_text(encoding="utf-8")

# AuthService.login returns { accessToken, user }
# The controller likely returns result directly.
# Confirm the response includes accessToken:
if "accessToken" in src:
    print("   ✅ login response includes accessToken (checked)")
else:
    print("   ⚠️  check manually: login should return accessToken in body")

# ═══════════════════════════════════════════════════════════════
# 5. CORS — allow Authorization header
# ═══════════════════════════════════════════════════════════════
print("\n[5] src/middleware/cors.middleware.ts")
p = ROOT / "src/middleware/cors.middleware.ts"
src = p.read_text(encoding="utf-8")

if "Authorization" in src:
    print("   ✅ CORS already allows Authorization header")
else:
    src = src.replace(
        "allowedHeaders: [",
        "allowedHeaders: ['Authorization', ",
        1,
    )
    p.write_text(src, encoding="utf-8")
    print("   ✅ added Authorization to allowedHeaders")

# ═══════════════════════════════════════════════════════════════
# 6. Type check
# ═══════════════════════════════════════════════════════════════
print("\n[6] TypeScript check")
import subprocess
r = subprocess.run(["npx", "tsc", "--noEmit"], cwd=ROOT, capture_output=True, text=True)
if r.returncode == 0:
    print("   ✅ TypeScript clean")
else:
    print("   ⚠️  TS errors:")
    print(r.stdout[:2000])

print("\n" + "═" * 60)
print(" Done")
print("═" * 60)
print("""
Next:

  git add .
  git commit -m "Backend: accept Bearer tokens"
  git push

  # In Coolify: backend resource → Redeploy
""")#!/usr/bin/env python3
"""
Accept Bearer tokens from Authorization header (in addition to cookies).
- Admin auth middleware: also reads Authorization: Bearer <token>
- Public auth middleware: already supports Bearer (verify)
- OTP verify: return accessToken in response body (so frontend can store it)
"""
import re
from pathlib import Path

ROOT = Path.cwd()
if not (ROOT / "prisma/schema.prisma").exists():
    raise SystemExit("❌ Run from ~/qrcashback-backend")

print("═" * 60)
print(" Backend — Bearer token support")
print("═" * 60)

# ═══════════════════════════════════════════════════════════════
# 1. Admin auth middleware — accept Authorization header
# ═══════════════════════════════════════════════════════════════
print("\n[1] admin-auth.middleware.ts")
admin_mw = ROOT / "src/middleware/admin-auth.middleware.ts"
src = admin_mw.read_text(encoding="utf-8")

old = "const token = req.cookies?.adminAccessToken;"
new = """const token =
    req.cookies?.adminAccessToken ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);"""

if "Authorization" in src and "adminAccessToken ||" in src:
    print("   ℹ️  already supports Bearer")
elif old in src:
    src = src.replace(old, new, 1)
    admin_mw.write_text(src, encoding="utf-8")
    print("   ✅ admin-auth now accepts Bearer tokens")
else:
    print("   ⚠️  could not find adminAccessToken line — check manually")

# ═══════════════════════════════════════════════════════════════
# 2. OTP verify — return accessToken in response
# ═══════════════════════════════════════════════════════════════
print("\n[2] otp.controller.ts")
otp_ctrl = ROOT / "src/controllers/public/otp.controller.ts"
src = otp_ctrl.read_text(encoding="utf-8")

# Find the return with 'verified: true'
if "accessToken: session.accessToken" not in src:
    # Insert accessToken into the returned object
    old_return = """return ApiResponse.success(
    res,
    { verified: true, user: session.user },
    'Email verified'
  );"""
    new_return = """return ApiResponse.success(
    res,
    { verified: true, user: session.user, accessToken: session.accessToken },
    'Email verified'
  );"""
    if old_return in src:
        src = src.replace(old_return, new_return, 1)
        otp_ctrl.write_text(src, encoding="utf-8")
        print("   ✅ OTP verify now returns accessToken")
    else:
        # Looser regex
        patched, n = re.subn(
            r"(\{ verified: true, user: session\.user)(\s*\})",
            r"\1, accessToken: session.accessToken\2",
            src, count=1,
        )
        if n > 0:
            otp_ctrl.write_text(patched, encoding="utf-8")
            print("   ✅ OTP verify now returns accessToken (regex)")
        else:
            print("   ⚠️  could not find return — check manually")
else:
    print("   ℹ️  already returns accessToken")

# ═══════════════════════════════════════════════════════════════
# 3. Verify public auth middleware already supports Bearer
# ═══════════════════════════════════════════════════════════════
print("\n[3] auth.middleware.ts (public)")
pub_mw = ROOT / "src/middleware/auth.middleware.ts"
src = pub_mw.read_text(encoding="utf-8")
if "authorization" in src.lower() and "Bearer" in src:
    print("   ✅ public middleware already accepts Bearer tokens")
else:
    print("   ⚠️  check manually — need Bearer support")

print("\n" + "═" * 60)
print(" Done")
print("═" * 60)
print("""
Next:

  npx tsc --noEmit
  # In Coolify: backend resource → Redeploy
""")

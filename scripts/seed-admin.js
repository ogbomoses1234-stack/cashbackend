#!/usr/bin/env node
/**
 * Convenience wrapper — runs the Prisma seed from the host machine.
 *   node scripts/seed-admin.js
 */
require('child_process').execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });

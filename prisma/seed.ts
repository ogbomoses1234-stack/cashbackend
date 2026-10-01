import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@qrcashback.local').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  const fullName = process.env.SEED_ADMIN_NAME || 'Super Admin';

  const existing = await prisma.authUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`ℹ️  Admin already exists: ${email}`);
    return;
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const authUser = await prisma.authUser.create({
    data: {
      email,
      passwordHash,
      profile: {
        create: {
          email,
          role: 'admin',
          fullName,
          emailVerified: true,
        },
      },
    },
  });

  console.log('✅ Admin seeded');
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   AuthID:   ${authUser.id}`);

  // Optional: seed sample products
  const sampleProducts = [
    {
      title: 'Glow Body Lotion 400ml',
      description: 'Deep moisturising body lotion with shea butter.',
      price: 4500,
      category: 'Skincare',
      stockCount: 120,
    },
    {
      title: 'Silk Hair Shampoo 250ml',
      description: 'Sulphate-free shampoo for all hair types.',
      price: 3200,
      category: 'Haircare',
      stockCount: 80,
    },
    {
      title: 'Radiance Bundle',
      description: 'Body lotion + face serum + hand cream.',
      price: 12000,
      category: 'Bundles',
      stockCount: 40,
    },
  ];

  for (const p of sampleProducts) {
    const slug = p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    await prisma.product.upsert({
      where: { slug },
      update: {},
      create: { ...p, slug },
    });
  }

  console.log(`✅ Seeded ${sampleProducts.length} sample products`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn('ADMIN_EMAIL/ADMIN_PASSWORD not set. Skip admin seed.');
    return;
  }

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.admin.create({
    data: {
      email,
      passwordHash,
      role: 'admin',
    },
  });
}

async function seedEvent() {
  const existing = await prisma.event.findFirst({
    where: { title: 'Sample Live Event' },
  });

  if (existing) {
    return;
  }

  const event = await prisma.event.create({
    data: {
      title: 'Sample Live Event',
      status: 'draft',
      streamKey: crypto.randomBytes(8).toString('hex'),
    },
  });

  await prisma.event.update({
    where: { id: event.id },
    data: {
      hlsPath: `live/${event.streamKey}/index.m3u8`,
    },
  });
}

async function main() {
  await seedEvent();
  await seedAdmin();
  console.log('Seed complete');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

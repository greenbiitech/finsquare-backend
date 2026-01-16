import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || '';
const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new pg.Pool({
  connectionString,
  // Enable SSL for non-localhost connections, accept self-signed certs
  ssl: isLocalhost ? false : { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // Create system user for default community
  const systemUser = await prisma.user.upsert({
    where: { email: 'system@finsquare.app' },
    update: {},
    create: {
      id: 'finsquare-system-user',
      email: 'system@finsquare.app',
      phoneNumber: '+0000000000',
      password: 'SYSTEM_USER_NO_LOGIN',
      firstName: 'FinSquare',
      lastName: 'System',
      fullName: 'FinSquare System',
      isVerified: true,
    },
  });

  console.log('Created system user:', systemUser.email);

  // Create FinSquare Community (default community)
  const finsquareCommunity = await prisma.community.upsert({
    where: { id: 'finsquare-default-community' },
    update: {},
    create: {
      id: 'finsquare-default-community',
      name: 'FinSquare Community',
      description: 'The default FinSquare community for all users',
      isDefault: true,
      createdById: systemUser.id,
    },
  });

  console.log('Created FinSquare Community:', finsquareCommunity.name);
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

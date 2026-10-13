import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const tursoUrl = 'libsql://phishing-detector-db-layce.aws-eu-north-1.turso.io';
const tursoAuthToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTE5MjAxODgsImlkIjoiMDFhMTM2YzItYWIwMS03YjJhLTg0YjEtZTExNGU0ZTdhYmQ2Iiwia2lkIjoieTF5UkJ6cnpyQXRodVBKcVhMQ3JiX1ZkanFBWktCejU3QUkwVjY0b2tZdyIsInJpZCI6Ijg5MThjNjA1LTJkY2QtNDYzMS05NmI2LTM0ZDI1M2FiYTU0ZCJ9.7XzcMAFcPFMI4Gcd9VrVkiy73Uy25oqPJROM7EtRnzYxCxeM1PS2Rnr6px7Ss9Ceay1s3H7zuGK6ooP08WpMCw';

const libsql = createClient({
  url: tursoUrl,
  authToken: tursoAuthToken,
});

const adapter = new PrismaLibSQL(libsql);
const prisma = new PrismaClient({ adapter });

async function testPrisma() {
  console.log('Testing Prisma queries via LibSQL on Turso...');
  
  // Test 1: Count users
  const userCount = await prisma.user.count();
  console.log('User count in Turso:', userCount);

  // Test 2: Upsert a test user to ensure writes and reads work perfectly
  const testEmail = 'cloud-check@turso.io';
  const testUser = await prisma.user.upsert({
    where: { email: testEmail },
    update: { name: 'Turso Cloud Tester' },
    create: {
      email: testEmail,
      name: 'Turso Cloud Tester',
      totpEnabled: false
    }
  });
  console.log('Successfully upserted user into Turso:', testUser.id, testUser.name);

  // Test 3: Query user back
  const fetchedUser = await prisma.user.findUnique({
    where: { id: testUser.id }
  });
  console.log('Successfully fetched user from Turso:', fetchedUser?.email);

  // Cleanup test user
  await prisma.user.delete({
    where: { id: testUser.id }
  });
  console.log('Successfully cleaned up test user from Turso.');

  console.log('TURSO_PRISMA_TEST_PASSED');
}

testPrisma()
  .catch((err) => {
    console.error('Prisma Turso test failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

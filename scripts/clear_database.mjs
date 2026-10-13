import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';

// Helper to load .env or .env.local
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  const envVars = {};

  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...rest] = trimmed.split('=');
          const val = rest.join('=').replace(/^["']|["']$/g, '').trim();
          if (!envVars[key.trim()]) {
            envVars[key.trim()] = val;
          }
        }
      }
    }
  }
  return envVars;
}

const env = loadEnv();

const TURSO_URL = process.env.TURSO_DATABASE_URL || env.TURSO_DATABASE_URL || 'libsql://phishing-detector-db-layce.aws-eu-north-1.turso.io';
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTE5MjAxODgsImlkIjoiMDFhMTM2YzItYWIwMS03YjJhLTg0YjEtZTExNGU0ZTdhYmQ2Iiwia2lkIjoieTF5UkJ6cnpyQXRodVBKcVhMQ3JiX1ZkanFBWktCejU3QUkwVjY0b2tZdyIsInJpZCI6Ijg5MThjNjA1LTJkY2QtNDYzMS05NmI2LTM0ZDI1M2FiYTU0ZCJ9.7XzcMAFcPFMI4Gcd9VrVkiy73Uy25oqPJROM7EtRnzYxCxeM1PS2Rnr6px7Ss9Ceay1s3H7zuGK6ooP08WpMCw';

const client = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH_TOKEN
});

const TABLES_TO_CLEAR = [
  'ScannedEmail',
  'Account',
  'Session',
  'VerificationToken',
  'User'
];

async function clearRemoteDatabase() {
  console.log('====================================================');
  console.log('   TURSO REMOTE DATABASE CLEANUP TOOL');
  console.log('   Target DB:', TURSO_URL);
  console.log('====================================================\n');

  try {
    // 1. Check existing tables and counts before cleanup
    console.log('[1/3] Перевірка поточної кількості записів перед очищенням:');
    for (const table of TABLES_TO_CLEAR) {
      try {
        const res = await client.execute(`SELECT COUNT(*) as count FROM "${table}"`);
        const count = res.rows[0]?.count ?? 0;
        console.log(`  - Таблиця "${table}": ${count} записів`);
      } catch {
        console.log(`  - Таблиця "${table}": ще не створена`);
      }
    }

    console.log('\n[2/3] Очищення таблиць (DELETE FROM)...');
    await client.execute('PRAGMA foreign_keys = OFF;');

    for (const table of TABLES_TO_CLEAR) {
      await client.execute(`DELETE FROM "${table}";`);
    }

    await client.execute('PRAGMA foreign_keys = ON;');
    console.log('  Всі записи успішно видалено.');

    // 2. Verify all tables are empty
    console.log('\n[3/3] Верифікація порожнього стану:');
    let allClean = true;
    for (const table of TABLES_TO_CLEAR) {
      const res = await client.execute(`SELECT COUNT(*) as count FROM "${table}"`);
      const count = Number(res.rows[0]?.count ?? 0);
      console.log(`  - Таблиця "${table}": ${count} записів (ОЧИЩЕНО)`);
      if (count !== 0) allClean = false;
    }

    console.log('\n====================================================');
    if (allClean) {
      console.log(' УСПІХ: База даних Turso повністю очищена!');
      console.log(' Усі таблиці збережені та готові до нових даних.');
    } else {
      console.log(' УВАГА: Деякі записи не вдалося видалити.');
    }
    console.log('====================================================');
  } catch (err) {
    console.error('\nПОМИЛКА при очищенні бази даних:', err);
    process.exit(1);
  }
}

clearRemoteDatabase();

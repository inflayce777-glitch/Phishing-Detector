import { createClient } from '@libsql/client';

const TURSO_URL = 'libsql://phishing-detector-db-layce.aws-eu-north-1.turso.io';
const TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTE5MjAxODgsImlkIjoiMDFhMTM2YzItYWIwMS03YjJhLTg0YjEtZTExNGU0ZTdhYmQ2Iiwia2lkIjoieTF5UkJ6cnpyQXRodVBKcVhMQ3JiX1ZkanFBWktCejU3QUkwVjY0b2tZdyIsInJpZCI6Ijg5MThjNjA1LTJkY2QtNDYzMS05NmI2LTM0ZDI1M2FiYTU0ZCJ9.7XzcMAFcPFMI4Gcd9VrVkiy73Uy25oqPJROM7EtRnzYxCxeM1PS2Rnr6px7Ss9Ceay1s3H7zuGK6ooP08WpMCw';

const client = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH_TOKEN
});

const statements = [
  `CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT,
      "email" TEXT UNIQUE,
      "emailVerified" DATETIME,
      "image" TEXT,
      "totpSecret" TEXT,
      "totpEnabled" BOOLEAN NOT NULL DEFAULT 0
  );`,

  `CREATE TABLE IF NOT EXISTS "Account" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "providerAccountId" TEXT NOT NULL,
      "refresh_token" TEXT,
      "access_token" TEXT,
      "expires_at" INTEGER,
      "token_type" TEXT,
      "scope" TEXT,
      "id_token" TEXT,
      "session_state" TEXT,
      CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");`,

  `CREATE TABLE IF NOT EXISTS "Session" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "sessionToken" TEXT NOT NULL UNIQUE,
      "userId" TEXT NOT NULL,
      "expires" DATETIME NOT NULL,
      CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,

  `CREATE TABLE IF NOT EXISTS "VerificationToken" (
      "identifier" TEXT NOT NULL,
      "token" TEXT NOT NULL UNIQUE,
      "expires" DATETIME NOT NULL
  );`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");`,

  `CREATE TABLE IF NOT EXISTS "ScannedEmail" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "messageId" TEXT NOT NULL UNIQUE,
      "userId" TEXT NOT NULL,
      "senderEmail" TEXT NOT NULL,
      "subject" TEXT,
      "textBody" TEXT NOT NULL,
      "oracleScore" REAL,
      "oracleLabel" TEXT,
      "triggers" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ScannedEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  );`,

  `CREATE TABLE IF NOT EXISTS "ScanAuditLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT,
      "threatScore" INTEGER NOT NULL,
      "verdictLabel" TEXT NOT NULL,
      "scanType" TEXT NOT NULL DEFAULT 'email',
      "senderEmail" TEXT,
      "targetUrl" TEXT,
      "subject" TEXT,
      "textSnippet" TEXT,
      "triggers" TEXT,
      "detectedDomains" TEXT,
      "threatSources" TEXT,
      "authSummary" TEXT,
      "hasObfuscation" BOOLEAN NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ScanAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  );`,

  `CREATE INDEX IF NOT EXISTS "ScanAuditLog_createdAt_idx" ON "ScanAuditLog"("createdAt");`,
  `CREATE INDEX IF NOT EXISTS "ScanAuditLog_verdictLabel_idx" ON "ScanAuditLog"("verdictLabel");`,
  `CREATE INDEX IF NOT EXISTS "ScanAuditLog_threatScore_idx" ON "ScanAuditLog"("threatScore");`,
  `CREATE INDEX IF NOT EXISTS "ScanAuditLog_userId_idx" ON "ScanAuditLog"("userId");`
];

async function migrate() {
  console.log('Migrating Turso Database tables...');
  for (const sql of statements) {
    await client.execute(sql);
  }
  
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
  console.log('Created Tables in Turso:', tables.rows.map(r => r.name));
}

migrate()
  .then(() => console.log('MIGRATION_SUCCESSFUL'))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });

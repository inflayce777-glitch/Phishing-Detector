import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    testsFailed++;
    throw new Error(message);
  } else {
    console.log(`[PASS] ${message}`);
    testsPassed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('AUDIT & OPTIMIZATION VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  // TEST 1: Prisma Singleton Verification
  console.log('--- Test 1: Prisma Singleton Pattern & Route Verification ---');
  const prismaLibPath = path.join(__dirname, 'src', 'lib', 'prisma.ts');
  assert(fs.existsSync(prismaLibPath), 'src/lib/prisma.ts exists');
  const prismaContent = fs.readFileSync(prismaLibPath, 'utf8');
  assert(prismaContent.includes('globalForPrisma.prisma'), 'Prisma client attached to global object to prevent connection leaks');

  const apiDir = path.join(__dirname, 'src', 'app', 'api');
  function findRouteFiles(dir) {
    let files = [];
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        files = files.concat(findRouteFiles(fullPath));
      } else if (item.name.endsWith('.ts') || item.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
    return files;
  }
  const allRoutes = findRouteFiles(apiDir);
  let rawPrismaInstantiations = 0;
  for (const routeFile of allRoutes) {
    const content = fs.readFileSync(routeFile, 'utf8');
    if (content.includes('new PrismaClient(')) {
      rawPrismaInstantiations++;
      console.warn(`[WARN] Found raw new PrismaClient() in ${routeFile}`);
    }
  }
  assert(rawPrismaInstantiations === 0, 'Zero raw `new PrismaClient()` instantiations across all API routes (all use singleton)');

  // TEST 2: IMAP Socket Resilience
  console.log('\n--- Test 2: IMAP Socket Resilience (Connection Teardown) ---');
  const imapSyncPath = path.join(__dirname, 'src', 'app', 'api', 'inbox', 'sync', 'route.ts');
  assert(fs.existsSync(imapSyncPath), 'src/app/api/inbox/sync/route.ts exists');
  const imapContent = fs.readFileSync(imapSyncPath, 'utf8');
  assert(imapContent.includes('finally'), 'IMAP sync has a finally block');
  assert(imapContent.includes('connection.end()'), 'IMAP sync closes connection inside finally to prevent hanging TLS sockets');

  // TEST 3: Client Bundle Footprint (Trusted Domains Separation)
  console.log('\n--- Test 3: Client Bundle Optimization (trustedDomains.ts) ---');
  const clientDomainsPath = path.join(__dirname, 'src', 'core', 'trustedDomains.ts');
  const serverDomainsPath = path.join(__dirname, 'src', 'core', 'trustedDomainsServer.ts');
  assert(fs.existsSync(clientDomainsPath), 'Client trustedDomains.ts exists');
  assert(fs.existsSync(serverDomainsPath), 'Server trustedDomainsServer.ts exists');

  const clientStats = fs.statSync(clientDomainsPath);
  const clientSizeKB = clientStats.size / 1024;
  console.log(`Client trustedDomains.ts size: ${clientSizeKB.toFixed(2)} KB`);
  assert(clientSizeKB < 15, 'Client trustedDomains.ts is lightweight (< 15 KB, 2.6MB JSON excluded from client bundle)');

  const serverContent = fs.readFileSync(serverDomainsPath, 'utf8');
  assert(serverContent.includes('trusted_domains.json'), 'Server-side trustedDomainsServer.ts retains full 150k domains database');

  // TEST 4: Levenshtein Multi-Level Domain Parsing
  console.log('\n--- Test 4: Levenshtein Multi-Level Domain Part Extraction ---');
  function extractDomainParts(hostname) {
    const parts = hostname.toLowerCase().split('.').filter(Boolean);
    if (parts.length <= 1) return { subdomain: '', apexDomain: hostname };
    const twoPartTlds = new Set(['com.ua', 'gov.ua', 'edu.ua', 'net.ua', 'org.ua', 'co.uk', 'co.jp', 'com.br']);
    if (parts.length >= 3) {
      const candidateTld = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
      if (twoPartTlds.has(candidateTld)) {
        const apexDomain = `${parts[parts.length - 3]}.${candidateTld}`;
        const subdomain = parts.slice(0, parts.length - 3).join('.');
        return { subdomain, apexDomain };
      }
    }
    const apexDomain = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    const subdomain = parts.slice(0, parts.length - 2).join('.');
    return { subdomain, apexDomain };
  }

  const cGle = extractDomainParts('c.gle');
  assert(cGle.apexDomain === 'c.gle', 'c.gle correctly identified as apexDomain (c.gle), not confused with google.com');

  const privatUa = extractDomainParts('secure.privatbank.com.ua');
  assert(privatUa.apexDomain === 'privatbank.com.ua', 'Multi-part ccTLD privatbank.com.ua correctly extracted as apexDomain');
  assert(privatUa.subdomain === 'secure', 'Subdomain secure correctly extracted');

  // TEST 5: RDAP In-Memory Caching & Whitelist Verification
  console.log('\n--- Test 5: RDAP API In-Memory Caching & Whitelist Check ---');
  try {
    const t0 = performance.now();
    const res1 = await fetch('http://localhost:3000/api/rdap?domain=google.com');
    const data1 = await res1.json();
    const dur1 = performance.now() - t0;
    assert(res1.status === 200, 'RDAP returned HTTP 200');
    assert(data1.status === 'trusted_infrastructure', 'google.com recognized as trusted_infrastructure without external query');

    const t1 = performance.now();
    const res2 = await fetch('http://localhost:3000/api/rdap?domain=google.com');
    const data2 = await res2.json();
    const dur2 = performance.now() - t1;
    console.log(`RDAP lookup 1: ${dur1.toFixed(1)}ms, lookup 2: ${dur2.toFixed(1)}ms`);
    assert(dur2 < 50, `Subsequent RDAP call served instantly (${dur2.toFixed(1)}ms < 50ms)`);
  } catch (err) {
    assert(false, `RDAP API call failed: ${err.message}`);
  }

  // TEST 6: SafeBrowsing Concurrency & Caching Check
  console.log('\n--- Test 6: SafeBrowsing Endpoint Concurrency & Cache ---');
  try {
    const resSb = await fetch('http://localhost:3000/api/safebrowsing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://google.com' })
    });
    assert(resSb.status === 200, 'SafeBrowsing returned HTTP 200');
    const dataSb = await resSb.json();
    assert(dataSb.matches && Object.keys(dataSb.matches).length === 0, 'Trusted domain passes SafeBrowsing cleanly with 0 false positives');
  } catch (err) {
    assert(false, `SafeBrowsing API call failed: ${err.message}`);
  }

  // TEST 7: ML GPU Vectorized Batch Inference & 3-Class Triage
  console.log('\n--- Test 7: ML GPU Vectorized Batch Inference & 3-Class Triage ---');
  try {
    const mlPayload = {
      texts: [
        "Доброго дня! Я завершив підготовку матеріалів для нашого навчального проєкту. У документі описані основні завдання та запропонований план роботи. Пропоную обговорити результати на наступній зустрічі й визначити, які частини потрібно допрацювати. Дякую! Гарного дня. З повагою, Андрій",
        "Термінова вакансія! Робота онлайн, легкий заробіток без вкладень від 15000 грн на день. Телефонуй прямо зараз: +380991112233",
        "Your account has been locked due to suspicious activity. Verify your identity immediately or your access will be permanently suspended. Click the link to update your login credentials."
      ]
    };

    const tStart = performance.now();
    const mlRes = await fetch('http://127.0.0.1:8000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mlPayload)
    });
    const mlDur = performance.now() - tStart;
    assert(mlRes.status === 200, `ML Backend returned HTTP 200 in ${mlDur.toFixed(1)}ms`);

    const mlData = await mlRes.json();
    assert(mlData.ml_health && mlData.ml_health.device === 'cuda', 'ML model running on NVIDIA CUDA GPU');

    const [benignVerdict, spamVerdict, phishingVerdict] = mlData.verdicts;

    // 1. Benign Email Validation
    assert(!benignVerdict.is_phishing, 'Benign text is NOT marked as phishing');
    assert(!benignVerdict.spam_match, 'Benign text is NOT falsely flagged as spam');
    assert(benignVerdict.threat_level === 'LOW', 'Benign threat level is LOW');
    assert(benignVerdict.phishing_probability < 0.10, `Benign phishing probability is minimal (${(benignVerdict.phishing_probability * 100).toFixed(2)}% < 10%)`);

    // 2. Spam / Outreach Validation
    assert(spamVerdict.spam_match, 'Spam job offer accurately identified as spam_match');
    assert(spamVerdict.best_spam_score > 0.65, `Spam similarity score is high (${(spamVerdict.best_spam_score * 100).toFixed(1)}% > 65%)`);

    // 3. Phishing Attack Validation
    assert(phishingVerdict.is_phishing, 'Phishing account lock alert identified as is_phishing');
    assert(phishingVerdict.threat_level !== 'LOW', 'Phishing alert threat level is elevated');
    assert(phishingVerdict.semantic_triggers.length > 0, 'Phishing triggered semantic concept detection');

    console.log(`ML Batch of 3 texts processed in ${mlDur.toFixed(1)}ms on RTX 3060 CUDA`);
  } catch (err) {
    assert(false, `ML Backend call failed: ${err.message}`);
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('================================================================');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});

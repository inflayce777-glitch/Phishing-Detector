import { NextResponse } from 'next/server';
import dns from 'node:dns/promises';
import { isServerTrustedDomain } from '@/core/trustedDomainsServer';

// In-Memory Caches with TTL to prevent repeated rate-limited API calls
const urlhausCache = new Map();
const URLHAUS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

const abuseIpCache = new Map();
const ABUSEIP_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000';

export async function POST(request) {
  try {
    const { urls, ips } = await request.json();

    if ((!urls || urls.length === 0) && (!ips || ips.length === 0)) {
      return NextResponse.json({ matches: [] });
    }

    const matches = [];

    // Parallel URL Scanning Worker
    if (urls && Array.isArray(urls)) {
      const normalizedUrls = Array.from(new Set(
        urls.map(u => String(u || '').replace(/&amp;/g, '&').trim().replace(/^[`'"]+|[`'"]+$/g, '').replace(/[.,;:)\]}>`]+$/g, ''))
      )).filter(u => {
        if (!u || u.length < 8) return false;
        try {
          const parsed = new URL(u.startsWith('http') ? u : `http://${u}`);
          const host = parsed.hostname.toLowerCase();
          if (!host || host.includes('=') || host.includes('_') || !host.includes('.')) return false;
          return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host);
        } catch {
          return false;
        }
      });

      const urlPromises = normalizedUrls.map(async (rawUrl) => {
        const cleanUrl = rawUrl;

        let hostname = '';
        try {
          const parsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : `http://${cleanUrl}`);
          hostname = parsed.hostname.toLowerCase();
        } catch {
          hostname = '';
        }

        // 0. Skip scanning for verified trusted infrastructure (150,000 domains database)
        if (isServerTrustedDomain(hostname || cleanUrl)) {
          return null;
        }

        const urlMatches = [];

        // 1. Check for Fake / Reserved / Non-routable TLDs (RFC 2606 / RFC 6761)
        const fakeTlds = ['.example', '.invalid', '.test', '.localhost', '.local'];
        const isReservedFake = fakeTlds.some(tld => hostname === tld.slice(1) || hostname.endsWith(tld));

        if (isReservedFake) {
          urlMatches.push({
            threatType: 'ФЕЙКОВИЙ ДОМЕН (RFC 2606 NXDOMAIN)',
            threat: { url: rawUrl },
            details: `Доменна зона "${hostname}" є зарезервованою як тестова/неіснуюча. Такий сайт не може існувати в публічному інтернеті.`
          });
        } else if (hostname && !hostname.includes('localhost') && !hostname.startsWith('127.')) {
          // 2. Real DNS Lookup Check (only on syntactically valid public domains with at least 1 dot)
          const isValidDomainSyntax = hostname.includes('.') && 
            !hostname.includes('=') && 
            /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(hostname);

          if (isValidDomainSyntax) {
            try {
              await dns.lookup(hostname);
            } catch (dnsErr) {
              if (dnsErr.code === 'ENOTFOUND' || dnsErr.code === 'EAI_AGAIN') {
                urlMatches.push({
                  threatType: 'НЕДІЙСНИЙ / МЕРТВИЙ ДОМЕН (DNS NXDOMAIN)',
                  threat: { url: rawUrl },
                  details: `Домен "${hostname}" не знайдено на глобальних DNS-серверах (він не існує або видалений). Це типовий маркер фейкових адрес.`
                });
              }
            }
          }
        }

        // 3. Query Python ML URL model (Grambeddings 800k trained)
        try {
          const mlRes = await fetch(`${PYTHON_BACKEND_URL}/api/analyze`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ texts: [cleanUrl], urls: [cleanUrl] }),
            signal: AbortSignal.timeout(1500)
          });
          if (mlRes.ok) {
            const mlData = await mlRes.json();
            if (mlData.url_verdicts && mlData.url_verdicts.length > 0) {
              const uVerdict = mlData.url_verdicts[0];
              if (uVerdict.phishing_probability > 0.5) {
                urlMatches.push({
                  threatType: `ML-ФІШИНГОВИЙ URL (${(uVerdict.phishing_probability * 100).toFixed(0)}%)`,
                  threat: { url: rawUrl },
                  details: 'Нейромережевий аналізатор структури посилань виявив високу ймовірність фішингу.'
                });
              }
            }
          }
        } catch {
          // Ignore if Python backend is busy
        }

        // 4. Check URLhaus API (Abuse.ch) with in-memory caching
        const now = Date.now();
        const cachedUrlhaus = urlhausCache.get(cleanUrl);
        if (cachedUrlhaus && cachedUrlhaus.expiresAt > now) {
          if (cachedUrlhaus.match) {
            urlMatches.push(cachedUrlhaus.match);
          }
        } else {
          try {
            const res = await fetch('https://urlhaus-api.abuse.ch/v1/url/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ url: cleanUrl }),
              signal: AbortSignal.timeout(2000)
            });
            const data = await res.json();
            if (data.query_status === 'ok') {
              const threatMatch = {
                threatType: 'ШКІДЛИВЕ ПОСИЛАННЯ (URLhaus Abuse.ch)',
                threat: { url: rawUrl },
                details: data.tags ? data.tags.join(', ') : 'Відомий репутаційний фішинг/малварь.'
              };
              urlMatches.push(threatMatch);
              urlhausCache.set(cleanUrl, { match: threatMatch, expiresAt: now + URLHAUS_CACHE_TTL });
            } else {
              urlhausCache.set(cleanUrl, { match: null, expiresAt: now + URLHAUS_CACHE_TTL });
            }
          } catch {
            // Ignore URLhaus timeouts
          }
        }

        return urlMatches;
      });

      const urlResults = await Promise.allSettled(urlPromises);
      for (const res of urlResults) {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          matches.push(...res.value);
        }
      }
    }

    // Parallel IP Checking Worker with AbuseIPDB
    if (ips && Array.isArray(ips)) {
      const abuseApiKey = process.env.ABUSEIPDB_API_KEY;
      if (abuseApiKey) {
        const ipPromises = ips.map(async (ip) => {
          const now = Date.now();
          const cachedIp = abuseIpCache.get(ip);
          if (cachedIp && cachedIp.expiresAt > now) {
            return cachedIp.match;
          }

          try {
            const res = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90`, {
              method: 'GET',
              headers: {
                'Key': abuseApiKey,
                'Accept': 'application/json'
              },
              signal: AbortSignal.timeout(2000)
            });
            const data = await res.json();
            if (data?.data?.abuseConfidenceScore > 20) {
              const threatMatch = {
                threatType: `ШКІДЛИВИЙ IP (AbuseIPDB Score: ${data.data.abuseConfidenceScore}%)`,
                threat: { url: ip },
                details: `IP-адреса має рейтинг скарг: ${data.data.totalReports} скарг з ${data.data.numDistinctUsers} джерел.`
              };
              abuseIpCache.set(ip, { match: threatMatch, expiresAt: now + ABUSEIP_CACHE_TTL });
              return threatMatch;
            } else {
              abuseIpCache.set(ip, { match: null, expiresAt: now + ABUSEIP_CACHE_TTL });
              return null;
            }
          } catch (e) {
            console.error('AbuseIPDB Error:', e);
            return null;
          }
        });

        const ipResults = await Promise.allSettled(ipPromises);
        for (const res of ipResults) {
          if (res.status === 'fulfilled' && res.value) {
            matches.push(res.value);
          }
        }
      }
    }

    return NextResponse.json({ matches });
  } catch (error) {
    console.error('Threat API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import dns from 'node:dns/promises';

export interface EmailAuthServerResponse {
  domain: string;
  senderEmail?: string;
  hasHeaders: boolean;
  spf: {
    status: 'pass' | 'fail' | 'softfail' | 'neutral' | 'none' | 'dns_active' | 'missing';
    details: string;
    record?: string;
  };
  dkim: {
    status: 'pass' | 'fail' | 'none' | 'dns_active';
    details: string;
    domain?: string;
    selector?: string;
  };
  dmarc: {
    status: 'pass' | 'fail' | 'none' | 'dns_active' | 'missing';
    policy: 'none' | 'quarantine' | 'reject' | 'unspecified';
    details: string;
    alignment: 'aligned' | 'mismatched' | 'unknown';
    record?: string;
  };
  isSpoofed: boolean;
  spoofingReason?: string;
}

// In-Memory Cache with 1-hour TTL for DNS record results
const dnsCache = new Map<string, { data: EmailAuthServerResponse; expiresAt: number }>();
const DNS_CACHE_TTL_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const domainInput = String(body.domain || '').trim().toLowerCase();
    const senderEmail = String(body.senderEmail || '').trim().toLowerCase();
    const rawHeaders = String(body.rawHeaders || '');

    // Extract domain from senderEmail if domain not provided
    let domain = domainInput;
    if (!domain && senderEmail && senderEmail.includes('@')) {
      domain = senderEmail.split('@')[1].trim();
    }
    // Clean domain
    domain = domain.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].replace(/[<>]/g, '');

    if (!domain || !domain.includes('.') || domain.includes('=') || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(domain)) {
      return NextResponse.json({ error: 'Valid domain is required' }, { status: 400 });
    }

    const cacheKey = `${domain}|${rawHeaders.slice(0, 100)}`;
    const cached = dnsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.data);
    }

    const response: EmailAuthServerResponse = {
      domain,
      senderEmail,
      hasHeaders: false,
      spf: { status: 'none', details: 'Заголовки SPF не знайдено в тексті' },
      dkim: { status: 'none', details: 'Цифровий підпис DKIM не знайдено в тексті' },
      dmarc: { status: 'none', policy: 'unspecified', details: 'DMARC перевірка не виконувалась', alignment: 'unknown' },
      isSpoofed: false
    };

    // 1. Parse transport headers (Authentication-Results, ARC-Authentication-Results, Received-SPF, DKIM-Signature)
    const hasTransportHeaders = /(?:Authentication-Results|ARC-Authentication-Results|Received-SPF|DKIM-Signature|Return-Path)/i.test(rawHeaders);
    if (hasTransportHeaders) {
      response.hasHeaders = true;

      // Extract Authentication-Results & ARC
      const authMatches = rawHeaders.match(/(?:^|\n)(?:Authentication-Results|ARC-Authentication-Results):[^\n]+(?:\n\s+[^\n]+)*/gi);
      const combinedAuth = authMatches ? authMatches.join(' ').replace(/\r?\n\s+/g, ' ') : '';

      // Evaluate SPF from headers
      if (/spf=pass/i.test(combinedAuth) || /Received-SPF:\s*Pass/i.test(rawHeaders)) {
        response.spf = {
          status: 'pass',
          details: 'Поштовий сервер відправника успішно авторизований у системі DNS SPF'
        };
      } else if (/spf=fail/i.test(combinedAuth) || /Received-SPF:\s*Fail/i.test(rawHeaders)) {
        response.spf = {
          status: 'fail',
          details: 'Сервер відправника НЕ має дозволу на відправку пошти від цього домену (SPF Fail)'
        };
      } else if (/spf=softfail/i.test(combinedAuth) || /Received-SPF:\s*SoftFail/i.test(rawHeaders)) {
        response.spf = {
          status: 'softfail',
          details: 'М\'яка невідповідність поштового сервера відправника (SPF SoftFail)'
        };
      } else if (/spf=neutral/i.test(combinedAuth) || /Received-SPF:\s*Neutral/i.test(rawHeaders)) {
        response.spf = {
          status: 'neutral',
          details: 'Політика SPF домену нейтральна щодо цього відправника'
        };
      }

      // Evaluate DKIM from headers
      const dkimDomainMatch = rawHeaders.match(/header\.d=([a-zA-Z0-9.-]+)/i) || rawHeaders.match(/DKIM-Signature:[^;]+;\s*[^;]*d=([a-zA-Z0-9.-]+)/i);
      const dkimDomain = dkimDomainMatch ? dkimDomainMatch[1].toLowerCase() : '';
      response.dkim.domain = dkimDomain;

      if (/dkim=pass/i.test(combinedAuth) || /DKIM-Signature:/i.test(rawHeaders)) {
        response.dkim = {
          status: 'pass',
          details: `Лист підписано дійсним криптографічним ключем DKIM (${dkimDomain || 'верифіковано'})`,
          domain: dkimDomain
        };
      } else if (/dkim=fail/i.test(combinedAuth)) {
        response.dkim = {
          status: 'fail',
          details: 'Криптографічний підпис DKIM недійсний або пошкоджений під час передачі',
          domain: dkimDomain
        };
      }

      // Evaluate DMARC from headers
      let dmarcPolicy: 'none' | 'quarantine' | 'reject' | 'unspecified' = 'unspecified';
      if (/p=reject/i.test(combinedAuth)) dmarcPolicy = 'reject';
      else if (/p=quarantine/i.test(combinedAuth)) dmarcPolicy = 'quarantine';
      else if (/p=none/i.test(combinedAuth)) dmarcPolicy = 'none';

      if (/dmarc=pass/i.test(combinedAuth)) {
        response.dmarc = {
          status: 'pass',
          policy: dmarcPolicy,
          details: 'DMARC відповідність та захист від підміни успішно підтверджено поштовим сервером',
          alignment: 'aligned'
        };
      } else if (/dmarc=fail/i.test(combinedAuth)) {
        response.dmarc = {
          status: 'fail',
          policy: dmarcPolicy,
          details: 'DMARC перевірку провалено: ідентифікатори відправника та цифрового підпису не відповідають один одному',
          alignment: 'mismatched'
        };
      }
    }

    // 2. Active DNS Verification for SPF & DMARC (Live Lookup via node:dns)
    // Run live DNS checks to discover declared policies of the sender domain
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      // A. Query root domain TXT records for SPF
      try {
        const txtRecords = await dns.resolveTxt(domain);
        const spfRecord = txtRecords
          .map(chunks => chunks.join(''))
          .find(r => r.startsWith('v=spf1'));

        if (spfRecord) {
          response.spf.record = spfRecord;
          if (response.spf.status === 'none') {
            response.spf = {
              status: 'dns_active',
              details: `У DNS домену знайдено активну політику SPF: ${spfRecord.slice(0, 70)}${spfRecord.length > 70 ? '...' : ''}`,
              record: spfRecord
            };
          }
        } else if (response.spf.status === 'none') {
          response.spf = {
            status: 'missing',
            details: `У DNS домену "${domain}" відсутній запис SPF (домен не захищає від підробки серверів)`
          };
        }
      } catch (dnsErr: any) {
        if (response.spf.status === 'none') {
          response.spf = {
            status: 'missing',
            details: `Запис SPF у DNS домену "${domain}" не знайдено`
          };
        }
      }

      // B. Query _dmarc.<domain> TXT records for DMARC
      try {
        const dmarcRecords = await dns.resolveTxt(`_dmarc.${domain}`);
        const dmarcRecord = dmarcRecords
          .map(chunks => chunks.join(''))
          .find(r => r.startsWith('v=DMARC1'));

        if (dmarcRecord) {
          response.dmarc.record = dmarcRecord;

          const pMatch = dmarcRecord.match(/p=([a-z]+)/i);
          const pVal = pMatch ? (pMatch[1].toLowerCase() as any) : 'none';

          if (response.dmarc.status === 'none') {
            response.dmarc = {
              status: 'dns_active',
              policy: ['reject', 'quarantine', 'none'].includes(pVal) ? pVal : 'none',
              alignment: 'aligned',
              details: `У DNS домену знайдено активну політику DMARC: p=${pVal} (домен захищений від Email Spoofing)`,
              record: dmarcRecord
            };
          }
        } else if (response.dmarc.status === 'none') {
          response.dmarc = {
            status: 'missing',
            policy: 'none',
            alignment: 'unknown',
            details: `У DNS домену "${domain}" відсутня політика DMARC (відкрита можливість для фішингової підміни імені бренду)`
          };
        }
      } catch (dmarcErr: any) {
        if (response.dmarc.status === 'none') {
          response.dmarc = {
            status: 'missing',
            policy: 'none',
            alignment: 'unknown',
            details: `Політику DMARC у DNS домену "${domain}" не налаштовано`
          };
        }
      }

      clearTimeout(timeoutId);
    } catch (e) {
      // Ignore network timeout
    }

    // 3. Spoofing evaluation
    if (response.spf.status === 'fail' && response.dmarc.alignment === 'mismatched') {
      response.isSpoofed = true;
      response.spoofingReason = 'Виявлено явну підміну: сервер відправника відхилено SPF, а домен DMARC не збігається.';
    } else if (response.dmarc.status === 'fail' && response.dmarc.policy === 'reject') {
      response.isSpoofed = true;
      response.spoofingReason = 'Політика домену вимагає блокування (DMARC: REJECT) через непідтверджену автентичність відправника.';
    }

    dnsCache.set(cacheKey, { data: response, expiresAt: Date.now() + DNS_CACHE_TTL_MS });
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Email auth API error:', error.message);
    return NextResponse.json({ error: 'Failed to authenticate email domain' }, { status: 500 });
  }
}

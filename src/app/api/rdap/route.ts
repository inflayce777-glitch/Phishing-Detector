import { NextRequest, NextResponse } from 'next/server';
import { isServerTrustedDomain } from '@/core/trustedDomainsServer';

export interface RdapDomainResponse {
  domain: string;
  ageDays: number | null;
  registrationDate: string | null;
  expirationDate: string | null;
  isNewlyRegistered: boolean;
  isCritical0Day: boolean;
  registrar: string | null;
  status: 'mature' | 'newly_registered' | 'critical_0day' | 'unknown' | 'trusted_infrastructure';
  details: string;
  source?: 'rdap' | 'domainee' | 'trusted_fallback' | 'cache';
  cached?: boolean;
}

// In-Memory Cache with 24-Hour TTL to prevent rate-limiting from registry servers
const rdapCache = new Map<string, { data: RdapDomainResponse; expiresAt: number }>();
const RDAP_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const domainParam = searchParams.get('domain');

  if (!domainParam) {
    return NextResponse.json({ error: 'Domain parameter is required' }, { status: 400 });
  }

  // Clean domain name
  let cleanDomain = domainParam.trim().toLowerCase();
  cleanDomain = cleanDomain.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];

  if (!cleanDomain || !cleanDomain.includes('.') || cleanDomain.includes('=') || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(cleanDomain)) {
    return NextResponse.json({ error: 'Invalid domain name' }, { status: 400 });
  }

  // 1. Check in-memory cache
  const cached = rdapCache.get(cleanDomain);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ ...cached.data, cached: true });
  }

  const isTrusted = isServerTrustedDomain(cleanDomain);
  let registrationDateStr: string | null = null;
  let expirationDateStr: string | null = null;
  let registrarName: string | null = null;
  let resolvedSource: RdapDomainResponse['source'] = undefined;

  // 2. Primary Engine: Official ICANN RDAP (rdap.org with proper User-Agent)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const rdapUrl = `https://rdap.org/domain/${cleanDomain}`;
    const response = await fetch(rdapUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/rdap+json, application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (PhishingDetector/1.0)'
      }
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const events: Array<{ eventAction: string; eventDate: string }> = data.events || [];

      for (const ev of events) {
        const action = (ev.eventAction || '').toLowerCase();
        if (action === 'registration' || action === 'registered') {
          registrationDateStr = ev.eventDate;
        } else if (action === 'expiration' || action === 'expires') {
          expirationDateStr = ev.eventDate;
        }
      }

      if (Array.isArray(data.entities)) {
        for (const ent of data.entities) {
          if (Array.isArray(ent.roles) && ent.roles.includes('registrar')) {
            registrarName = ent.vcardArray?.[1]?.find((item: any) => item[0] === 'fn')?.[3] || ent.handle || null;
            break;
          }
        }
      }

      if (registrationDateStr) {
        resolvedSource = 'rdap';
      }
    }
  } catch (err: any) {
    // Continue to fallback
  }

  // 3. Secondary Engine: Fast Keyless Domain Age API (domainee.dev fallback)
  if (!registrationDateStr) {
    try {
      const domaineeRes = await fetch(`https://api.domainee.dev/v1/tools/domain-age-checker?domain=${encodeURIComponent(cleanDomain)}`, {
        signal: AbortSignal.timeout(3500),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (PhishingDetector/1.0)'
        }
      });
      if (domaineeRes.ok) {
        const dJson = await domaineeRes.json();
        if (dJson?.ok && dJson?.data?.created) {
          registrationDateStr = dJson.data.created;
          expirationDateStr = dJson.data.expires || expirationDateStr;
          resolvedSource = 'domainee';
        }
      }
    } catch (e) {
      // Continue
    }
  }

  // 4. If date resolved, calculate true age
  if (registrationDateStr) {
    const regDate = new Date(registrationDateStr);
    const now = new Date();
    const diffMs = now.getTime() - regDate.getTime();
    const ageDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

    const isCritical0Day = ageDays <= 14;
    const isNewlyRegistered = ageDays <= 30;

    let status: RdapDomainResponse['status'] = isTrusted ? 'trusted_infrastructure' : 'mature';
    let details = `Домен створено ${ageDays} днів тому (${regDate.toISOString().split('T')[0]}).`;

    if (isCritical0Day && !isTrusted) {
      status = 'critical_0day';
      details = `Критичний ризик: домен зареєстровано лише ${ageDays} днів тому. Понад 80% свіжих фішингових кампаній використовують домени віком до 14 днів!`;
    } else if (isNewlyRegistered && !isTrusted) {
      status = 'newly_registered';
      details = `Підвищений ризик: домен створено нещодавно (${ageDays} днів тому). Вік менше 30 днів є класичним маркером тимчасових дроп-доменів.`;
    } else if (isTrusted) {
      details = `Домен створено ${ageDays} днів тому (${regDate.toISOString().split('T')[0]}). Верифікована глобальна інфраструктура.`;
    }

    const finalRes: RdapDomainResponse = {
      domain: cleanDomain,
      ageDays,
      registrationDate: registrationDateStr,
      expirationDate: expirationDateStr,
      isNewlyRegistered: !isTrusted && isNewlyRegistered,
      isCritical0Day: !isTrusted && isCritical0Day,
      registrar: registrarName || (isTrusted ? 'Верифікована глобальна інфраструктура' : 'Офіційний реєстратор'),
      status,
      details,
      source: resolvedSource
    };

    rdapCache.set(cleanDomain, { data: finalRes, expiresAt: Date.now() + RDAP_CACHE_TTL_MS });
    return NextResponse.json(finalRes);
  }

  // 5. Fallback for trusted infrastructure when RDAP registry has strict rate-limiting
  if (isTrusted) {
    const trustedFallback: RdapDomainResponse = {
      domain: cleanDomain,
      ageDays: null,
      registrationDate: null,
      expirationDate: null,
      isNewlyRegistered: false,
      isCritical0Day: false,
      registrar: 'Верифікована глобальна інфраструктура',
      status: 'trusted_infrastructure',
      details: 'Домен підтверджено у базі довіреної глобальної інфраструктури (реєстраційні сервери тимчасово обмежили зовнішні запити).',
      source: 'trusted_fallback'
    };
    rdapCache.set(cleanDomain, { data: trustedFallback, expiresAt: Date.now() + 2 * 60 * 60 * 1000 });
    return NextResponse.json(trustedFallback);
  }

  // 6. Unknown domain fallback
  const unknownRes: RdapDomainResponse = {
    domain: cleanDomain,
    ageDays: null,
    registrationDate: null,
    expirationDate: null,
    isNewlyRegistered: false,
    isCritical0Day: false,
    registrar: null,
    status: 'unknown',
    details: 'Реєстраційні дані RDAP недоступні або TLD не підтримує публічний протокол RDAP.',
    source: 'rdap'
  };
  rdapCache.set(cleanDomain, { data: unknownRes, expiresAt: Date.now() + 30 * 60 * 1000 });
  return NextResponse.json(unknownRes);
}

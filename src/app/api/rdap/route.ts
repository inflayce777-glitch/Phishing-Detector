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
  cached?: boolean;
}

// In-Memory Cache with 24-Hour TTL to prevent rate-limiting (HTTP 429) from ICANN RDAP servers
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

  // 1. Check in-memory cache
  const cached = rdapCache.get(cleanDomain);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ ...cached.data, cached: true });
  }

  // 2. Fast check for trusted infrastructure (Google, Microsoft, 150k dataset, etc.)
  if (isServerTrustedDomain(cleanDomain)) {
    const res: RdapDomainResponse = {
      domain: cleanDomain,
      ageDays: 7300, // 20+ years
      registrationDate: '1997-01-01T00:00:00Z',
      expirationDate: '2030-01-01T00:00:00Z',
      isNewlyRegistered: false,
      isCritical0Day: false,
      registrar: 'Верифікована глобальна інфраструктура',
      status: 'trusted_infrastructure',
      details: 'Домен належить до верифікованої глобальної інфраструктури з багаторічною історією.'
    };
    rdapCache.set(cleanDomain, { data: res, expiresAt: Date.now() + RDAP_CACHE_TTL_MS });
    return NextResponse.json(res);
  }

  // 3. Query ICANN Universal RDAP router
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const rdapUrl = `https://rdap.org/domain/${cleanDomain}`;
    const response = await fetch(rdapUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/rdap+json, application/json'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const fallbackRes: RdapDomainResponse = {
        domain: cleanDomain,
        ageDays: null,
        registrationDate: null,
        expirationDate: null,
        isNewlyRegistered: false,
        isCritical0Day: false,
        registrar: null,
        status: 'unknown',
        details: `Реєстраційні дані RDAP недоступні або реєстр повернув статус ${response.status}.`
      };
      // Cache unknown status for 15 minutes to prevent rapid retry spamming
      rdapCache.set(cleanDomain, { data: fallbackRes, expiresAt: Date.now() + 15 * 60 * 1000 });
      return NextResponse.json(fallbackRes);
    }

    const data = await response.json();
    const events: Array<{ eventAction: string; eventDate: string }> = data.events || [];

    let registrationDateStr: string | null = null;
    let expirationDateStr: string | null = null;

    for (const ev of events) {
      const action = (ev.eventAction || '').toLowerCase();
      if (action === 'registration' || action === 'registered') {
        registrationDateStr = ev.eventDate;
      } else if (action === 'expiration' || action === 'expires') {
        expirationDateStr = ev.eventDate;
      }
    }

    // Try finding registrar entity name
    let registrarName: string | null = null;
    if (Array.isArray(data.entities)) {
      for (const ent of data.entities) {
        if (Array.isArray(ent.roles) && ent.roles.includes('registrar')) {
          registrarName = ent.vcardArray?.[1]?.find((item: any) => item[0] === 'fn')?.[3] || ent.handle || null;
          break;
        }
      }
    }

    if (!registrationDateStr) {
      const noDateRes: RdapDomainResponse = {
        domain: cleanDomain,
        ageDays: null,
        registrationDate: null,
        expirationDate: expirationDateStr,
        isNewlyRegistered: false,
        isCritical0Day: false,
        registrar: registrarName,
        status: 'unknown',
        details: 'У відповіді RDAP відсутня точна дата первинної реєстрації.'
      };
      rdapCache.set(cleanDomain, { data: noDateRes, expiresAt: Date.now() + 60 * 60 * 1000 });
      return NextResponse.json(noDateRes);
    }

    // Calculate age in days
    const regDate = new Date(registrationDateStr);
    const now = new Date();
    const diffMs = now.getTime() - regDate.getTime();
    const ageDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

    const isCritical0Day = ageDays <= 14;
    const isNewlyRegistered = ageDays <= 30;

    let status: RdapDomainResponse['status'] = 'mature';
    let details = `Домен створено ${ageDays} днів тому (${regDate.toISOString().split('T')[0]}).`;

    if (isCritical0Day) {
      status = 'critical_0day';
      details = `Критичний ризик: Домен зареєстровано лише ${ageDays} днів тому. Понад 80% свіжих фішингових кампаній використовують домени віком до 14 днів!`;
    } else if (isNewlyRegistered) {
      status = 'newly_registered';
      details = `Підвищений ризик: Домен створено нещодавно (${ageDays} днів тому). Вік менше 30 днів є класичним маркером тимчасових дроп-доменів.`;
    }

    const finalRes: RdapDomainResponse = {
      domain: cleanDomain,
      ageDays,
      registrationDate: registrationDateStr,
      expirationDate: expirationDateStr,
      isNewlyRegistered,
      isCritical0Day,
      registrar: registrarName,
      status,
      details
    };

    rdapCache.set(cleanDomain, { data: finalRes, expiresAt: Date.now() + RDAP_CACHE_TTL_MS });
    return NextResponse.json(finalRes);
  } catch (err: any) {
    console.error('RDAP lookup error:', err.message);
    return NextResponse.json({
      domain: cleanDomain,
      ageDays: null,
      registrationDate: null,
      expirationDate: null,
      isNewlyRegistered: false,
      isCritical0Day: false,
      registrar: null,
      status: 'unknown',
      details: 'Таймаут або мережева помилка під час звернення до серверів RDAP.'
    } as RdapDomainResponse);
  }
}

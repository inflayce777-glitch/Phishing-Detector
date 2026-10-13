/**
 * Typosquatting, Combosquatting & Brand Impersonation Forensic Detection Engine
 * Integrates directly with the 150,000+ Verified Domain Infrastructure (trusted_domains.json)
 * Uses Damerau-Levenshtein distance, Public Suffix SLD extraction, Brand Combosquatting Matrix,
 * and IDN Homoglyphs (Punycode) to detect unauthorized lookalike domains.
 * Note: Zero UTF emoji stickers used; all icons rendered via React Lucide components.
 */

import { isTrustedDomain, TRUSTED_APEX_DOMAINS } from './trustedDomains';

export interface ProtectedBrand {
  id: string;
  name: string;
  category: 'Банкінг / Фінанси' | 'Державні сервіси' | 'Логістика / Доставка' | 'Глобальні платформи' | 'Оборона / ЗСУ' | 'Електронна комерція';
  primaryDomains: string[];
  keywords: string[];
}

export interface BrandImpersonationResult {
  isImpersonation: boolean;
  targetBrand?: ProtectedBrand;
  technique?: 'Typosquatting' | 'Combosquatting' | 'IDN Homoglyph' | 'Subdomain Spoofing' | 'Legitimate';
  similarityScore: number;
  explanation: string;
  candidateDomain: string;
  legitimateDomain?: string;
}

// Multi-part country code TLDs to correctly extract the Second-Level Domain (SLD)
const MULTI_PART_TLDS = new Set([
  'com.ua', 'gov.ua', 'edu.ua', 'org.ua', 'net.ua', 'in.ua',
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'ltd.uk', 'me.uk',
  'com.pl', 'org.pl', 'co.jp', 'ne.jp', 'com.au', 'net.au', 'org.au',
  'com.br', 'org.br', 'co.nz', 'org.nz', 'com.tr', 'co.za', 'com.sg'
]);

export const PROTECTED_BRANDS: ProtectedBrand[] = [
  // 1. Ukrainian Banking & Finance
  {
    id: 'privatbank',
    name: 'ПриватБанк (Privat24)',
    category: 'Банкінг / Фінанси',
    primaryDomains: ['privatbank.ua', 'privat24.ua', 'pb.ua'],
    keywords: ['privat', 'privat24', 'privatbank']
  },
  {
    id: 'monobank',
    name: 'Монобанк (Monobank)',
    category: 'Банкінг / Фінанси',
    primaryDomains: ['monobank.ua', 'mono.me'],
    keywords: ['monobank', 'mono']
  },
  {
    id: 'oschadbank',
    name: 'Ощадбанк (Oschadbank)',
    category: 'Банкінг / Фінанси',
    primaryDomains: ['oschadbank.ua'],
    keywords: ['oschad', 'oschadbank']
  },
  {
    id: 'raiffeisen',
    name: 'Райффайзен Банк',
    category: 'Банкінг / Фінанси',
    primaryDomains: ['raiffeisen.ua', 'aval.ua'],
    keywords: ['raiffeisen', 'aval']
  },
  {
    id: 'binance',
    name: 'Binance',
    category: 'Банкінг / Фінанси',
    primaryDomains: ['binance.com', 'binance.info'],
    keywords: ['binance']
  },
  {
    id: 'paypal',
    name: 'PayPal',
    category: 'Банкінг / Фінанси',
    primaryDomains: ['paypal.com', 'paypal.me'],
    keywords: ['paypal']
  },

  // 2. State & Government (Ukraine)
  {
    id: 'diia',
    name: 'Портал Дія (Мінцифра)',
    category: 'Державні сервіси',
    primaryDomains: ['diia.gov.ua', 'diiagov.ua', 'e-aid.diia.gov.ua'],
    keywords: ['diia', 'diya', 'diiagov']
  },
  {
    id: 'eaid',
    name: 'ЄПідтримка / ЄДопомога',
    category: 'Державні сервіси',
    primaryDomains: ['e-aid.diia.gov.ua', 'edopomoga.gov.ua'],
    keywords: ['epidtrymka', 'edopomoga', 'e-pidtrymka', 'e-aid']
  },
  {
    id: 'mvs',
    name: 'МВС України',
    category: 'Державні сервіси',
    primaryDomains: ['mvs.gov.ua', 'hsc.gov.ua'],
    keywords: ['mvs', 'hsc-gov']
  },
  {
    id: 'zsu',
    name: 'Збройні Сили України / Оборона',
    category: 'Оборона / ЗСУ',
    primaryDomains: ['mil.gov.ua', 'mod.gov.ua', 'zsu.gov.ua', '33polk.army'],
    keywords: ['milgov', 'zsu', 'landforces']
  },

  // 3. Logistics & E-Commerce
  {
    id: 'novaposhta',
    name: 'Нова Пошта (Nova Post)',
    category: 'Логістика / Доставка',
    primaryDomains: ['novaposhta.ua', 'novapost.com', 'npost.page'],
    keywords: ['novaposhta', 'novapost']
  },
  {
    id: 'ukrposhta',
    name: 'Укрпошта (Ukrposhta)',
    category: 'Логістика / Доставка',
    primaryDomains: ['ukrposhta.ua', 'post.ukrposhta.ua'],
    keywords: ['ukrposhta']
  },
  {
    id: 'olx',
    name: 'OLX Україна',
    category: 'Електронна комерція',
    primaryDomains: ['olx.ua'],
    keywords: ['olx']
  },
  {
    id: 'rozetka',
    name: 'Rozetka',
    category: 'Електронна комерція',
    primaryDomains: ['rozetka.com.ua', 'rozetka.ua'],
    keywords: ['rozetka']
  },

  // 4. Global Platforms & Infrastructure
  {
    id: 'google',
    name: 'Google',
    category: 'Глобальні платформи',
    primaryDomains: [
      'google.com', 'gmail.com', 'google.com.ua', 'c.gle', 'goo.gl',
      'gstatic.com', 'googleusercontent.com', 'youtube.com', 'youtu.be'
    ],
    keywords: ['google', 'gmail']
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    category: 'Глобальні платформи',
    primaryDomains: ['microsoft.com', 'live.com', 'outlook.com', 'office.com', 'microsoftonline.com', 'windows.net'],
    keywords: ['microsoft', 'outlook', 'office365']
  },
  {
    id: 'apple',
    name: 'Apple',
    category: 'Глобальні платформи',
    primaryDomains: ['apple.com', 'icloud.com', 'me.com'],
    keywords: ['apple', 'icloud']
  },
  {
    id: 'telegram',
    name: 'Telegram',
    category: 'Глобальні платформи',
    primaryDomains: ['telegram.org', 't.me'],
    keywords: ['telegram', 'tme']
  },
  {
    id: 'meta',
    name: 'Meta / Facebook / Instagram / WhatsApp',
    category: 'Глобальні платформи',
    primaryDomains: ['meta.com', 'facebook.com', 'instagram.com', 'whatsapp.com', 'fb.com'],
    keywords: ['facebook', 'instagram', 'whatsapp']
  }
];

// Keywords commonly combined with brands in Combosquatting attacks
const PHISHING_COMBOS_KEYWORDS = [
  'login', 'verify', 'auth', 'support', 'card', 'aid', 'bonus', 'pay', 'payment',
  'track', 'tracking', 'cabinet', 'secure', 'service', 'confirm', 'help', 'id',
  'security', 'dopomoga', 'vyplata', 'groshi', 'account', 'check', 'online', 'portal',
  'update', 'safety', 'access', 'wallet'
];

function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // deletion
        dp[i][j - 1] + 1,       // insertion
        dp[i - 1][j - 1] + cost // substitution
      );

      // Damerau transposition check
      if (i > 1 && j > 1 && s1[i - 1] === s2[j - 2] && s1[i - 2] === s2[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }

  return dp[m][n];
}

export function extractHostname(rawUrl: string): string {
  try {
    let clean = rawUrl.trim().toLowerCase();
    if (!/^https?:\/\//i.test(clean)) {
      clean = 'http://' + clean;
    }
    const parsed = new URL(clean);
    return parsed.hostname.toLowerCase();
  } catch {
    return rawUrl.trim().toLowerCase().split('/')[0];
  }
}

/**
 * Accurately extracts the Second-Level Domain (SLD) taking into account multi-part TLDs (.com.ua, .co.uk, etc.)
 */
export function extractDomainParts(hostname: string): { sld: string; rootDomain: string; tld: string } {
  const cleanHost = hostname.toLowerCase().trim();
  const parts = cleanHost.split('.');
  if (parts.length <= 1) {
    return { sld: cleanHost, rootDomain: cleanHost, tld: '' };
  }

  // Check multi-part TLDs (e.g. google.com.ua -> lastTwo is 'com.ua', sld is 'google')
  if (parts.length >= 3) {
    const lastTwo = parts.slice(-2).join('.');
    if (MULTI_PART_TLDS.has(lastTwo)) {
      const sld = parts[parts.length - 3];
      const rootDomain = `${sld}.${lastTwo}`;
      return { sld, rootDomain, tld: lastTwo };
    }
  }

  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];
  const rootDomain = `${sld}.${tld}`;
  return { sld, rootDomain, tld };
}

export function detectBrandImpersonation(urlOrDomain: string): BrandImpersonationResult {
  const hostname = extractHostname(urlOrDomain);
  const { sld: domainBase, rootDomain } = extractDomainParts(hostname);

  // 1. Direct match with curated protected brands
  for (const brand of PROTECTED_BRANDS) {
    for (const legitDomain of brand.primaryDomains) {
      if (hostname === legitDomain || hostname.endsWith('.' + legitDomain)) {
        return {
          isImpersonation: false,
          targetBrand: brand,
          technique: 'Legitimate',
          similarityScore: 1.0,
          explanation: `Офіційний верифікований ресурс бренду ${brand.name} (${legitDomain}).`,
          candidateDomain: hostname,
          legitimateDomain: legitDomain
        };
      }
    }
  }

  // 2. Integration with 150,000+ Trusted Domains Database & Apex Whitelist
  // If the domain is verified in our global infrastructure list, it CANNOT be a typosquatter.
  if (isTrustedDomain(hostname) || TRUSTED_APEX_DOMAINS.has(hostname) || TRUSTED_APEX_DOMAINS.has(rootDomain)) {
    // Check if this trusted domain is an alias/shortlink of a known brand
    for (const brand of PROTECTED_BRANDS) {
      for (const kw of brand.keywords) {
        if (domainBase === kw || hostname.includes(kw)) {
          return {
            isImpersonation: false,
            targetBrand: brand,
            technique: 'Legitimate',
            similarityScore: 1.0,
            explanation: `Верифікована інфраструктура бренду ${brand.name} (підтверджено в базі довірених доменів).`,
            candidateDomain: hostname,
            legitimateDomain: brand.primaryDomains[0]
          };
        }
      }
    }

    return {
      isImpersonation: false,
      technique: 'Legitimate',
      similarityScore: 1.0,
      explanation: 'Домен підтверджено у глобальному реєстрі довіреної інфраструктури (150k Tranco / Alexa Whitelist).',
      candidateDomain: hostname,
      legitimateDomain: rootDomain
    };
  }

  // 3. Check for IDN Homoglyphs (Punycode xn--)
  if (hostname.includes('xn--')) {
    for (const brand of PROTECTED_BRANDS) {
      for (const keyword of brand.keywords) {
        if (hostname.includes(keyword)) {
          return {
            isImpersonation: true,
            targetBrand: brand,
            technique: 'IDN Homoglyph',
            similarityScore: 0.98,
            explanation: `Критична загроза: Виявлено використання IDN Punycode для маскування під бренд ${brand.name}.`,
            candidateDomain: hostname,
            legitimateDomain: brand.primaryDomains[0]
          };
        }
      }
    }
  }

  // 4. Combosquatting detection: Brand keyword + phishing modifier (e.g. privat24-verify, diia-aid)
  for (const brand of PROTECTED_BRANDS) {
    for (const kw of brand.keywords) {
      if (domainBase.includes(kw)) {
        const hasModifier = PHISHING_COMBOS_KEYWORDS.some(mod => domainBase.includes(mod));
        const isNotOfficialTld = !brand.primaryDomains.some(ld => hostname.endsWith(ld));

        if (hasModifier || isNotOfficialTld) {
          return {
            isImpersonation: true,
            targetBrand: brand,
            technique: 'Combosquatting',
            similarityScore: 0.95,
            explanation: `Виявлено комбосквотинг: Домен ${hostname} експлуатує ім'я бренду ${brand.name} у поєднанні зі службовими словами на неофіційному домені.`,
            candidateDomain: hostname,
            legitimateDomain: brand.primaryDomains[0]
          };
        }
      }
    }
  }

  // 5. Typosquatting (Levenshtein distance <= 2 to primary domain bases)
  // Strict safeguards to avoid false positives:
  // - Both brand base and candidate base must be >= 4 characters
  // - Difference in length must be <= 2
  // - Similarity ratio (1 - dist / maxLen) must be >= 0.75 (at least 75% character match)
  for (const brand of PROTECTED_BRANDS) {
    for (const legitDomain of brand.primaryDomains) {
      const { sld: legitBase } = extractDomainParts(legitDomain);

      if (
        domainBase.length >= 4 &&
        legitBase.length >= 4 &&
        Math.abs(domainBase.length - legitBase.length) <= 2
      ) {
        const dist = levenshteinDistance(domainBase, legitBase);
        const maxLen = Math.max(domainBase.length, legitBase.length);
        const sim = 1 - (dist / maxLen);

        if (dist >= 1 && dist <= 2 && sim >= 0.75) {
          return {
            isImpersonation: true,
            targetBrand: brand,
            technique: 'Typosquatting',
            similarityScore: Math.round(sim * 100) / 100,
            explanation: `Виявлено тайпосквотинг: Домен ${hostname} відрізняється лише на ${dist} літеру(и) від офіційного домену ${legitDomain} бренду ${brand.name}.`,
            candidateDomain: hostname,
            legitimateDomain: legitDomain
          };
        }
      }
    }
  }

  return {
    isImpersonation: false,
    similarityScore: 0.0,
    explanation: 'Ознак прямої підміни захищених брендів не виявлено.',
    candidateDomain: hostname
  };
}

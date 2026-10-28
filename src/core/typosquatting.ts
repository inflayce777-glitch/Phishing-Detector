/**
 * Typosquatting, Combosquatting & Brand Impersonation Forensic Detection Engine
 * Integrates directly with the 150,000+ Verified Domain Infrastructure (trusted_domains.json)
 * Uses Damerau-Levenshtein distance, Public Suffix SLD extraction, Brand Combosquatting Matrix,
 * and IDN Homoglyphs (Punycode) to detect unauthorized lookalike domains.
 * Note: Zero UTF emoji stickers used; all icons rendered via React Lucide components.
 */

import { isTrustedDomain, TRUSTED_APEX_DOMAINS } from './trustedDomains';
import brandsData from '@/data/protected_brands.json';

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
  technique?: 'Typosquatting' | 'Combosquatting' | 'IDN Homoglyph' | 'Visual Homoglyph' | 'Keyboard Proximity' | 'Subdomain Spoofing' | 'Legitimate';
  similarityScore: number;
  explanation: string;
  candidateDomain: string;
  legitimateDomain?: string;
}

// QWERTY keyboard physical layout adjacency graph for typosquatting detection
const QWERTY_ADJACENT: Record<string, string[]> = {
  'q': ['w', 'a', 's'],
  'w': ['q', 'e', 'a', 's', 'd'],
  'e': ['w', 'r', 's', 'd', 'f'],
  'r': ['e', 't', 'd', 'f', 'g'],
  't': ['r', 'y', 'f', 'g', 'h'],
  'y': ['t', 'u', 'g', 'h', 'j'],
  'u': ['y', 'i', 'h', 'j', 'k'],
  'i': ['u', 'o', 'j', 'k', 'l'],
  'o': ['i', 'p', 'k', 'l'],
  'p': ['o', 'l'],
  'a': ['q', 'w', 's', 'z'],
  's': ['q', 'w', 'e', 'a', 'd', 'z', 'x'],
  'd': ['w', 'e', 'r', 's', 'f', 'x', 'c'],
  'f': ['e', 'r', 't', 'd', 'g', 'c', 'v'],
  'g': ['r', 't', 'y', 'f', 'h', 'v', 'b'],
  'h': ['t', 'y', 'u', 'g', 'j', 'b', 'n'],
  'j': ['y', 'u', 'i', 'h', 'k', 'n', 'm'],
  'k': ['u', 'i', 'o', 'j', 'l', 'm'],
  'l': ['i', 'o', 'p', 'k'],
  'z': ['a', 's', 'x'],
  'x': ['s', 'd', 'z', 'c'],
  'c': ['d', 'f', 'x', 'v'],
  'v': ['f', 'g', 'c', 'b'],
  'b': ['g', 'h', 'v', 'n'],
  'n': ['h', 'j', 'b', 'm'],
  'm': ['j', 'k', 'n'],
  '1': ['2', 'q'],
  '2': ['1', '3', 'q', 'w'],
  '3': ['2', '4', 'w', 'e'],
  '4': ['3', '5', 'e', 'r'],
  '5': ['4', '6', 'r', 't'],
  '6': ['5', '7', 't', 'y'],
  '7': ['6', '8', 'y', 'u'],
  '8': ['7', '9', 'u', 'i'],
  '9': ['8', '0', 'i', 'o'],
  '0': ['9', 'o', 'p']
};

// ASCII optical homoglyphs (multi-char and digit/letter optical illusions)
const ASCII_HOMOGLYPH_PATTERNS: Array<{ pattern: string; replacement: string; desc: string }> = [
  { pattern: 'rn', replacement: 'm', desc: '"rn" ↔ "m"' },
  { pattern: 'cl', replacement: 'd', desc: '"cl" ↔ "d"' },
  { pattern: 'vv', replacement: 'w', desc: '"vv" ↔ "w"' },
  { pattern: 'nn', replacement: 'm', desc: '"nn" ↔ "m"' },
  { pattern: 'uu', replacement: 'w', desc: '"uu" ↔ "w"' },
  { pattern: '0',  replacement: 'o', desc: '"0" ↔ "o"' },
  { pattern: '1',  replacement: 'l', desc: '"1" ↔ "l"' },
  { pattern: 'i',  replacement: 'l', desc: '"i" ↔ "l"' },
  { pattern: 'l',  replacement: 'i', desc: '"l" ↔ "i"' }
];

// Multi-part country code TLDs to correctly extract the Second-Level Domain (SLD)
const MULTI_PART_TLDS = new Set([
  'com.ua', 'gov.ua', 'edu.ua', 'org.ua', 'net.ua', 'in.ua',
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'ltd.uk', 'me.uk',
  'com.pl', 'org.pl', 'co.jp', 'ne.jp', 'com.au', 'net.au', 'org.au',
  'com.br', 'org.br', 'co.nz', 'org.nz', 'com.tr', 'co.za', 'com.sg'
]);

export const PROTECTED_BRANDS: ProtectedBrand[] = brandsData.brands as ProtectedBrand[];
const PHISHING_COMBOS_KEYWORDS: string[] = brandsData.comboKeywords;

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
            explanation: `Критична загроза: виявлено використання IDN Punycode для маскування під бренд ${brand.name}.`,
            candidateDomain: hostname,
            legitimateDomain: brand.primaryDomains[0]
          };
        }
      }
    }
  }

  // 4. Check for Visual ASCII Homoglyphs (optical substitutions: rn -> m, cl -> d, vv -> w, 1 -> l, etc.)
  for (const brand of PROTECTED_BRANDS) {
    for (const legitDomain of brand.primaryDomains) {
      const { sld: legitBase } = extractDomainParts(legitDomain);
      if (!legitBase || legitBase.length < 3) continue;

      for (const h of ASCII_HOMOGLYPH_PATTERNS) {
        if (domainBase.includes(h.pattern)) {
          const normalized = domainBase.split(h.pattern).join(h.replacement);
          if (normalized === legitBase && domainBase !== legitBase) {
            return {
              isImpersonation: true,
              targetBrand: brand,
              technique: 'Visual Homoglyph',
              similarityScore: 0.98,
              explanation: `Виявлено оптичну імітацію (ASCII Homoglyph): домен ${hostname} використовує візуальну схожість ${h.desc} для підміни бренду ${brand.name} (${legitDomain}).`,
              candidateDomain: hostname,
              legitimateDomain: legitDomain
            };
          }
        }
      }
    }
  }

  // 5. Check for Keyboard Proximity & Slips (QWERTY adjacent replacement or insertion)
  for (const brand of PROTECTED_BRANDS) {
    for (const legitDomain of brand.primaryDomains) {
      const { sld: legitBase } = extractDomainParts(legitDomain);
      if (!legitBase || legitBase.length < 4) continue;

      // 5A. Single character adjacent replacement (e.g. pribatbank vs privatbank)
      if (domainBase.length === legitBase.length && domainBase !== legitBase) {
        let diffCount = 0;
        let candDiff = '';
        let legitDiff = '';
        for (let i = 0; i < domainBase.length; i++) {
          if (domainBase[i] !== legitBase[i]) {
            diffCount++;
            candDiff = domainBase[i];
            legitDiff = legitBase[i];
          }
        }
        if (diffCount === 1 && QWERTY_ADJACENT[legitDiff]?.includes(candDiff)) {
          return {
            isImpersonation: true,
            targetBrand: brand,
            technique: 'Keyboard Proximity',
            similarityScore: 0.96,
            explanation: `Виявлено клавіатурний тайпосквотинг (QWERTY Proximity): у домені ${hostname} символ "${candDiff}" розташований поруч із клавішею "${legitDiff}" на клавіатурі (перехоплення друкарської помилки для бренду ${brand.name}).`,
            candidateDomain: hostname,
            legitimateDomain: legitDomain
          };
        }
      }

      // 5B. Adjacent key insertion / slip (e.g. privatbanlk vs privatbank)
      if (domainBase.length === legitBase.length + 1) {
        for (let i = 0; i < domainBase.length; i++) {
          const reduced = domainBase.slice(0, i) + domainBase.slice(i + 1);
          if (reduced === legitBase) {
            const insertedChar = domainBase[i];
            const prevChar = i > 0 ? domainBase[i - 1] : null;
            const nextChar = i < domainBase.length - 1 ? domainBase[i + 1] : null;
            const isAdjacentSlip = 
              (prevChar && QWERTY_ADJACENT[prevChar]?.includes(insertedChar)) ||
              (nextChar && QWERTY_ADJACENT[nextChar]?.includes(insertedChar));
            
            if (isAdjacentSlip) {
              return {
                isImpersonation: true,
                targetBrand: brand,
                technique: 'Keyboard Proximity',
                similarityScore: 0.94,
                explanation: `Виявлено випадковий зачіп сусідньої клавіші (QWERTY Slip): у домені ${hostname} додано сусідній символ "${insertedChar}" при введенні імені бренду ${brand.name} (${legitDomain}).`,
                candidateDomain: hostname,
                legitimateDomain: legitDomain
              };
            }
          }
        }
      }
    }
  }

  // 6. Combosquatting detection: Brand keyword + phishing modifier (e.g. privat24-verify, diia-aid)
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
            explanation: `Виявлено комбосквотинг: домен ${hostname} експлуатує ім'я бренду ${brand.name} у поєднанні зі службовими словами на неофіційному домені.`,
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
            explanation: `Виявлено тайпосквотинг: домен ${hostname} відрізняється лише на ${dist} літеру(и) від офіційного домену ${legitDomain} бренду ${brand.name}.`,
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

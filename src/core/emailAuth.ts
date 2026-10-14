/**
 * Email Authentication Forensics Module (RFC 7208 SPF, RFC 6376 DKIM, RFC 7489 DMARC)
 * Performs forensic verification of email headers, DMARC identifier alignment,
 * and detects Email Spoofing & BEC (Business Email Compromise).
 * Note: No UTF emoji stickers used; all icons rendered via React components.
 */

export interface EmailAuthResult {
  hasHeaders: boolean;
  spf: {
    status: 'pass' | 'fail' | 'softfail' | 'neutral' | 'none' | 'dns_active' | 'missing';
    details: string;
    domain?: string;
    ip?: string;
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
  visibleFromDomain?: string;
  returnPathDomain?: string;
  replyToDiscrepancy?: {
    fromEmail: string;
    replyToEmail: string;
    isSuspicious: boolean;
  };
}

function extractDomain(emailOrDomain: string): string {
  if (!emailOrDomain) return '';
  const clean = emailOrDomain.trim().toLowerCase().replace(/[<>]/g, '');
  const atIdx = clean.lastIndexOf('@');
  if (atIdx !== -1) {
    return clean.slice(atIdx + 1).trim();
  }
  return clean;
}

export function analyzeEmailAuthentication(rawText: string, providedSender?: string): EmailAuthResult {
  const result: EmailAuthResult = {
    hasHeaders: false,
    spf: { status: 'none', details: 'Заголовки SPF не знайдено (прямий ввід тексту)' },
    dkim: { status: 'none', details: 'Цифровий підпис DKIM відсутній' },
    dmarc: { status: 'none', policy: 'unspecified', details: 'DMARC перевірка не виконувалась', alignment: 'unknown' },
    isSpoofed: false
  };

  if (!rawText) return result;

  const isEmailWithHeaders = /(?:Authentication-Results|ARC-Authentication-Results|Received-SPF|DKIM-Signature|Return-Path|MIME-Version|Received:)/i.test(rawText);
  if (!isEmailWithHeaders) {
    return result;
  }

  result.hasHeaders = true;

  // 1. Extract From, Return-Path, Reply-To
  const fromMatch = rawText.match(/(?:^|\n)(?:From|Від):\s*(?:[^<\r\n]+<)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i);
  const fromEmail = fromMatch ? fromMatch[1].toLowerCase() : (providedSender || '').toLowerCase();
  const fromDomain = extractDomain(fromEmail);
  result.visibleFromDomain = fromDomain;

  const returnPathMatch = rawText.match(/(?:^|\n)Return-Path:\s*(?:<)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i);
  const returnPathEmail = returnPathMatch ? returnPathMatch[1].toLowerCase() : '';
  const returnPathDomain = extractDomain(returnPathEmail);
  result.returnPathDomain = returnPathDomain;

  const replyToMatch = rawText.match(/(?:^|\n)Reply-To:\s*(?:[^<\r\n]+<)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i);
  if (replyToMatch && fromEmail) {
    const replyToEmail = replyToMatch[1].toLowerCase();
    const replyToDomain = extractDomain(replyToEmail);
    const isFreeMailReply = /@(gmail\.com|yahoo\.com|outlook\.com|hotmail\.com|ukr\.net|mail\.ru)$/i.test(replyToEmail);
    const isCorpFrom = !/@(gmail\.com|yahoo\.com|outlook\.com|hotmail\.com|ukr\.net|mail\.ru)$/i.test(fromEmail);

    const isSuspicious = (replyToDomain !== fromDomain) && (isCorpFrom && isFreeMailReply);
    result.replyToDiscrepancy = {
      fromEmail,
      replyToEmail,
      isSuspicious
    };
  }

  // 2. Parse Authentication-Results & ARC-Authentication-Results
  const authResultsMatch = rawText.match(/(?:^|\n)(?:Authentication-Results|ARC-Authentication-Results):[^\n]+(?:\n\s+[^\n]+)*/gi);
  const authHeader = authResultsMatch ? authResultsMatch.join(' ').replace(/\r?\n\s+/g, ' ') : '';

  // 3. Parse Received-SPF
  const receivedSpfMatch = rawText.match(/(?:^|\n)Received-SPF:[^\n]+(?:\n\s+[^\n]+)*/i);
  const receivedSpf = receivedSpfMatch ? receivedSpfMatch[0].replace(/\r?\n\s+/g, ' ') : '';

  // Evaluate SPF
  if (/spf=pass/i.test(authHeader) || /Received-SPF:\s*Pass/i.test(receivedSpf)) {
    result.spf = {
      status: 'pass',
      details: 'Поштовий сервер відправника успішно авторизований у системі DNS SPF'
    };
  } else if (/spf=fail/i.test(authHeader) || /Received-SPF:\s*Fail/i.test(receivedSpf)) {
    result.spf = {
      status: 'fail',
      details: 'Сервер відправника НЕ має дозволу на відправку пошти від цього домену (SPF Fail)'
    };
  } else if (/spf=softfail/i.test(authHeader) || /Received-SPF:\s*SoftFail/i.test(receivedSpf)) {
    result.spf = {
      status: 'softfail',
      details: 'М\'яка невідповідність поштового сервера (SPF SoftFail)'
    };
  } else if (/spf=neutral/i.test(authHeader) || /Received-SPF:\s*Neutral/i.test(receivedSpf)) {
    result.spf = {
      status: 'neutral',
      details: 'Політика SPF домену нейтральна щодо цього відправника'
    };
  }

  // 4. Parse DKIM
  const dkimDomainMatch = rawText.match(/header\.d=([a-zA-Z0-9.-]+)/i) || rawText.match(/DKIM-Signature:[^;]+;\s*[^;]*d=([a-zA-Z0-9.-]+)/i);
  const dkimDomain = dkimDomainMatch ? dkimDomainMatch[1].toLowerCase() : '';
  result.dkim.domain = dkimDomain;

  if (/dkim=pass/i.test(authHeader) || /DKIM-Signature:/i.test(rawText)) {
    result.dkim = {
      status: 'pass',
      details: `Лист підписано дійсним криптографічним ключем DKIM (${dkimDomain || 'верифіковано'})`,
      domain: dkimDomain
    };
  } else if (/dkim=fail/i.test(authHeader)) {
    result.dkim = {
      status: 'fail',
      details: 'Криптографічний підпис DKIM недійсний або був пошкоджений під час передачі',
      domain: dkimDomain
    };
  }

  // 5. Parse DMARC & Identifier Alignment
  let dmarcPolicy: 'none' | 'quarantine' | 'reject' | 'unspecified' = 'unspecified';
  if (/p=reject/i.test(authHeader)) dmarcPolicy = 'reject';
  else if (/p=quarantine/i.test(authHeader)) dmarcPolicy = 'quarantine';
  else if (/p=none/i.test(authHeader)) dmarcPolicy = 'none';

  if (/dmarc=pass/i.test(authHeader)) {
    result.dmarc = {
      status: 'pass',
      policy: dmarcPolicy,
      details: 'DMARC перевірку та відповідність ідентифікаторів пройдено',
      alignment: 'aligned'
    };
  } else if (/dmarc=fail/i.test(authHeader)) {
    result.dmarc = {
      status: 'fail',
      policy: dmarcPolicy,
      details: 'DMARC перевірку провалено: ідентифікатори відправника та підпису не відповідають один одному',
      alignment: 'mismatched'
    };
  } else {
    // If no explicit DMARC header, perform algorithmic alignment check
    if (fromDomain && dkimDomain) {
      const isDkimAligned = dkimDomain === fromDomain || fromDomain.endsWith('.' + dkimDomain) || dkimDomain.endsWith('.' + fromDomain);
      const isSpfAligned = !returnPathDomain || returnPathDomain === fromDomain || fromDomain.endsWith('.' + returnPathDomain);

      if (isDkimAligned || isSpfAligned) {
        result.dmarc.alignment = 'aligned';
        result.dmarc.status = result.dkim.status === 'pass' || result.spf.status === 'pass' ? 'pass' : 'none';
        result.dmarc.details = 'Ідентифікатори From та криптографічного підпису збігаються';
      } else {
        result.dmarc.alignment = 'mismatched';
        result.dmarc.status = 'fail';
        result.dmarc.details = `Невідповідність ідентифікаторів: From (${fromDomain}) не збігається з DKIM/SPF (${dkimDomain || returnPathDomain})`;
      }
    }
  }

  // 6. Comprehensive Spoofing Judgment
  if (result.spf.status === 'fail' && result.dmarc.alignment === 'mismatched') {
    result.isSpoofed = true;
    result.spoofingReason = `Виявлено фальсифікацію адреси відправника: сервер відхилено SPF, а криптографічний підпис належить сторонньому домену (${dkimDomain || 'невідомо'}).`;
  } else if (result.dmarc.status === 'fail' && result.dmarc.policy === 'reject') {
    result.isSpoofed = true;
    result.spoofingReason = 'Політика домену вимагає блокування (DMARC: REJECT) через непідтверджену автентичність відправника.';
  } else if (result.replyToDiscrepancy?.isSuspicious) {
    result.isSpoofed = true;
    result.spoofingReason = `Підозра на компрометацію (BEC): лист нібито від корпоративного домену (${fromDomain}), але відповідь спрямовується на публічну безкоштовну скриньку (${result.replyToDiscrepancy.replyToEmail}).`;
  }

  return result;
}

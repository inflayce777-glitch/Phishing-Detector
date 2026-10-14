import { isTrustedDomain } from './trustedDomains';
import { parseMimeEmail, extractUrlsFromText } from '@/lib/emailParser';

export interface PhishingVector {
  id?: string;
  trigger: string;
  score: number;
  explanation: string;
  color?: string;
  sentences?: string[];
}

export interface HeuristicResults {
  vectors: PhishingVector[];
  obfuscation: {
    score: number;
    flags: string[];
  };
  extractedIndicators: {
    urls: string[];
    ips: string[];
  };
  isTrusted: boolean;
  effectiveSender?: string;
  cleanText?: string;
}

const TEXT_RULES = {
  urgency: {
    patterns: [
      /(?:^|[^\p{L}])(терміново|срочно|негайно|заблокован(о|ий|а)|протягом \d+ годин|в течение \d+ часов|останнє попередження|последнее предупреждение)(?=[^\p{L}]|$)/iu,
      /\burgent\b/i,
      /\bimmediately\b/i,
      /\bsuspend(ed)?\b/i,
      /\bwithin \d+ hours\b/i,
      /\bfinal warning\b/i,
      /\bact now\b/i
    ],
    trigger: 'Терміновість',
    explanation: 'Штучне відчуття паніки або браку часу. Блокує раціональне мислення.',
    color: '#ff5900'
  },
  authority: {
    patterns: [
      /(?:^|[^\p{L}])(служба безпеки|служба безопасности|національний банк|национальный банк|поліція|полиция|техпідтримка|техподдержка)(?=[^\p{L}]|$)/iu,
      /\b(security team|head office|police|support team)\b/i
    ],
    trigger: 'Авторитет',
    explanation: 'Використання імені банку або керівництва. Змушує жертву підкорятися.',
    color: '#ffd700'
  },
  financial: {
    patterns: [
      /\b(win|won|winner|winning)\b/i,
      /\bprize[s]?\b/i,
      /\bcash\b/i,
      /\bpenalt(y|ies)\b/i,
      /\bfine[s]?\b/i,
      /\bdebt[s]?\b/i,
      /\bpayment[s]?\b/i,
      /\btax(es)?\b/i,
      /\binvoice[s]?\b/i,
      /(?:^|[^\p{L}])(вигра(ш|ти|ли|но)?|выигрыш)(?=[^\p{L}]|$)/iu,
      /(?:^|[^\p{L}])(приз|призи|призом|призів)(?=[^\p{L}]|$)/iu,
      /(?:^|[^\p{L}])(грошов(ий|а|е|і|их)|денежн(ый|ая|ое|ые))(?=[^\p{L}]|$)/iu,
      /(?:^|[^\p{L}])(штраф|штрафи|штрафов)(?=[^\p{L}]|$)/iu,
      /(?:^|[^\p{L}])(арешт|арест)(?=[^\p{L}]|$)/iu,
      /(?:^|[^\p{L}])(борг|борги|долг|долги)(?=[^\p{L}]|$)/iu,
      /(?:^|[^\p{L}])(заборгованість|задолженность)(?=[^\p{L}]|$)/iu,
      /(?:^|[^\p{L}])(податок|податки|налог|налоги)(?=[^\p{L}]|$)/iu
    ],
    trigger: 'Фінансова маніпуляція',
    explanation: 'Грає на фінансових страхах або жадібності (обіцянки виграшів, штрафи, борги).',
    color: '#00ff88'
  },
  action: {
    patterns: [
      /\b(password|sign\s*in|log\s*in|verify)\b/i,
      /(?:^|[^\p{L}])(перейдіть за посиланням|перейдите по ссылке|клікніть|кликните|підтвердити дані|подтвердите данные|введіть пароль|введите пароль|натисніть тут|нажмите здесь|авторизуйтесь)(?=[^\p{L}]|$)/iu,
      /click the link/i,
      /click here/i
    ],
    trigger: 'Заклик до небезпечної дії',
    explanation: 'Пряма вказівка виконати дію, що може призвести до крадежі даних (перехід по посиланню, ввід пароля).',
    color: '#c56cf0'
  },
  spam: {
    patterns: [
      /(?:^|[^\p{L}])(заробіток|віддален(а|ка)|удаленка|доход від|швидкі гроші|робота для|казино|без вкладень|доларів в день|доларів в годину|прибуток|акція|знижка|отримай|заробляють понад|залишай заявку|опитування|рекрутинг|телефонуй за номером|бойових посад|тилових посад|гаряча лінія|підробіток)(?=[^\p{L}]|$)/iu,
      /\b(work from home|remote job|fast cash|no investment|dollars a day|promotion|giveaway|easy money|free money|apply now|call now)\b/i
    ],
    trigger: 'Спам-маркери',
    explanation: 'Типовий словник спаму та масових розсилок (вакансії без запиту, рекламні пропозиції, акції).',
    color: '#f39c12'
  }
};

export function extractEmailData(rawText: string, providedSender?: string) {
  const parsed = parseMimeEmail(rawText, providedSender);
  const sender = parsed.sender || (providedSender || '').trim();
  const cleanBody = parsed.displayText;
  const decodedText = parsed.plainBody || parsed.displayText || rawText;

  return { sender, cleanBody, decodedText, parsed };
}

export function analyzeCoreHeuristics(text: string, email: string, url: string): HeuristicResults {
  const vectors: PhishingVector[] = [];
  let obfuscationScore = 0;
  const obfuscationFlags: string[] = [];
  const extractedIndicators = { urls: [] as string[], ips: [] as string[] };
  let isTrusted = false;

  const { sender: effectiveEmail, cleanBody, decodedText, parsed } = extractEmailData(text, email);

  // --- 1. Email Analysis ---
  if (effectiveEmail) {
    const emailLower = effectiveEmail.toLowerCase();
    const domain = emailLower.split('@')[1] || '';
    
    const isFreeEmail = /@(gmail\.com|yahoo\.com|hotmail\.com|outlook\.com|ukr\.net|mail\.ru|yandex\.ru)/.test(emailLower);

    // Trust the domain ONLY if it is in the whitelist AND it is NOT a free email provider.
    if (isTrustedDomain(domain) && !isFreeEmail) {
      isTrusted = true;
    }

    const hasNumbers = /\d{3,}/.test(emailLower.split('@')[0]);
    const isOfficialContext = /(admin|support|security|billing|update|verify|noreply)/.test(emailLower);

    if (isFreeEmail && isOfficialContext) {
      vectors.push({
        trigger: 'Підробка відправника',
        score: 0.9,
        explanation: 'Використання безкоштовної пошти для розсилки нібито офіційних повідомлень.',
        color: '#ff7f50'
      });
      isTrusted = false;
    } else if (hasNumbers && isFreeEmail) {
      vectors.push({
        trigger: 'Анонімна адреса',
        score: 0.6,
        explanation: 'Адреса містить багато цифр і безкоштовний домен (типово для ботів).',
        color: '#ff7f50'
      });
      isTrusted = false;
    }
  }

  // --- 2. URL Analysis (Direct input URL) ---
  if (url) {
    const urlLower = url.toLowerCase();
    const isIpAddress = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(urlLower);
    
    if (isIpAddress) {
      vectors.push({
        trigger: 'Прихований домен (IP)',
        score: 0.95,
        explanation: 'Посилання веде напряму на IP-адресу, що часто використовується для обходу фільтрів доменів.',
        color: '#c56cf0'
      });
    }

    const isShortener = /(bit\.ly|tinyurl\.com|t\.co|goo\.gl|cutt\.ly)/.test(urlLower);
    if (isShortener) {
      vectors.push({
        trigger: 'Прихований редирект (URL)',
        score: 0.85,
        explanation: 'Використання сервісу скорочення посилань для приховування справжньої адреси.',
        color: '#c56cf0'
      });
    }
  }

  // --- 3. Text Analysis (Rules applied on clean human-readable text) ---
  const textToScan = cleanBody || text;
  if (textToScan) {
    for (const [key, rule] of Object.entries(TEXT_RULES)) {
      let matchCount = 0;
      let matchedWords: string[] = [];

      for (const pattern of rule.patterns) {
        const matches = textToScan.match(pattern);
        if (matches) {
          matchCount += matches.length;
          matchedWords.push(matches[0]);
        }
      }

      if (matchCount > 0) {
        vectors.push({
          trigger: rule.trigger,
          score: Math.min(0.99, 0.5 + (matchCount * 0.15)),
          explanation: `${rule.explanation} (Знайдено: "${matchedWords.slice(0, 2).join('", "')}")`,
          color: rule.color,
          sentences: matchedWords
        });
      }
    }

    // --- 4. Obfuscation & Extraction (on clean text) ---
    if (/([a-zA-Z][а-яА-ЯіІїЇєЄґҐ]|[а-яА-ЯіІїЇєЄґҐ][a-zA-Z])/g.test(textToScan)) {
      obfuscationFlags.push("Змішування кирилиці та латиниці (гомогліфи)");
      obfuscationScore += 0.3;
    }
    if (/(?<=[a-zA-Zа-яА-ЯіІїЇєЄґҐ])[\u200B-\u200D\uFEFF]+(?=[a-zA-Zа-яА-ЯіІїЇєЄґҐ])/g.test(textToScan)) {
      obfuscationFlags.push("Приховані невидимі символи (zero-width obfuscation)");
      obfuscationScore += 0.4;
    }
    if (/\b(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[q-z0-9]{39,59})\b/g.test(textToScan)) {
      obfuscationFlags.push("Bitcoin-гаманець (ознака фінансового вимагання)");
      obfuscationScore += 0.6;
    }
    if (/\b[a-zA-Z]*[vV][1!][aA@][gG][rR][aA@][a-zA-Z]*\b|\b[wW][0o][nN]\b|\b[pP][rR][1!][zZ][eE]\b/g.test(textToScan)) {
      obfuscationFlags.push("Використання leet speak для обходу фільтрів");
      obfuscationScore += 0.5;
    }

    // --- PhishGuard Feature: Reply-To Mismatch ---
    const fromMatch = text.match(/^From:\s*(.+)$/im);
    const replyToMatch = text.match(/^Reply-To:\s*(.+)$/im);
    
    if (fromMatch && replyToMatch) {
      const fromEmailMatch = fromMatch[1].match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const replyToEmailMatch = replyToMatch[1].match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      
      if (fromEmailMatch && replyToEmailMatch && fromEmailMatch[0].toLowerCase() !== replyToEmailMatch[0].toLowerCase()) {
        vectors.push({
          trigger: 'Підміна Reply-To (PhishGuard)',
          score: 0.85,
          explanation: `Поле "Від кого" (${fromEmailMatch[0]}) не збігається з полем "Кому відповідати" (${replyToEmailMatch[0]}). Це типова ознака фішингу.`,
          color: '#e74c3c'
        });
        isTrusted = false;
      }
    }

    // --- 5. URL & IP Extraction from decoded content ---
    const textForUrls = decodedText || cleanBody;
    const rawUrls = [
      ...(parsed?.extractedUrls || []),
      ...(extractUrlsFromText(textForUrls))
    ];
    
    // Filter out image extensions, avatars and static media URLs
    const imageExtensions = /\.(png|jpe?g|gif|svg|ico|webp|bmp)(?:[?#]|$)/i;
    const avatarPatterns = /(googleusercontent\.com\/a\/|avatar|gravatar\.com|twimg\.com\/profile_images)/i;
    
    const extractedUrls = rawUrls
      .filter(u => u.length > 8 && !imageExtensions.test(u) && !avatarPatterns.test(u));
    
    // Deduplicate and filter out truncated prefixes
    const uniqueUrls = Array.from(new Set(extractedUrls));
    const filteredUrls = uniqueUrls.filter((url, _, arr) => {
      return !arr.some(other => other !== url && other.startsWith(url));
    });

    // IP extraction with private IP filtration
    const rawIps = textForUrls.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [];
    const publicIps = rawIps.filter(ip => !/^(10\.|192\.168\.|127\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(ip));
    
    extractedIndicators.urls = filteredUrls;
    extractedIndicators.ips = Array.from(new Set(publicIps));
  }
  
  if (isTrusted && obfuscationScore > 0) {
    isTrusted = false;
  }

  vectors.forEach((v, i) => v.id = `vec-${i}`);

  return { 
    vectors, 
    obfuscation: { score: obfuscationScore, flags: obfuscationFlags }, 
    extractedIndicators, 
    isTrusted,
    effectiveSender: effectiveEmail,
    cleanText: cleanBody
  };
}

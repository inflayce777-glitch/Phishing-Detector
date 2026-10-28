import { PhishingVector } from './heuristics';
import { EmailAuthResult } from './emailAuth';
import { BrandImpersonationResult } from './typosquatting';

export interface ThreatExplainerParams {
  threatLevel: number;
  vectors: PhishingVector[];
  emailAuth?: EmailAuthResult | null;
  brandResults?: BrandImpersonationResult[];
  safeBrowsingMatches?: any[];
  rdapResults?: Record<string, any>;
  obfuscation?: { score: number; flags: string[] } | null;
  isSpam?: boolean;
  isTrusted?: boolean;
  senderEmail?: string;
  hasHardBlacklist?: boolean;
  hasMlUrlThreat?: boolean;
}

export interface ThreatAnalysisReport {
  verdictLabel: string;
  severityClass: 'critical' | 'warning' | 'safe' | 'spam';
  executiveSummary: string;
  xaiNarrative: string;
  primaryDrivers: Array<{
    title: string;
    score: number;
    description: string;
    severity: 'critical' | 'warning' | 'info' | 'safe';
  }>;
  infrastructureAssessment: string;
  recommendedActions: string[];
}

/**
 * Intelligent Analytical Engine that synthesizes threat signals
 * (NLP semantics, URL reputation, email authentication, typosquatting, obfuscation)
 * into a coherent, high-precision forensic explanation in Ukrainian.
 */
export function generateThreatExplanation(params: ThreatExplainerParams): ThreatAnalysisReport {
  const {
    threatLevel,
    vectors = [],
    emailAuth,
    brandResults = [],
    safeBrowsingMatches = [],
    rdapResults = {},
    obfuscation,
    isSpam = false,
    isTrusted = false,
    hasHardBlacklist = false,
    hasMlUrlThreat = false,
  } = params;

  const drivers: ThreatAnalysisReport['primaryDrivers'] = [];
  const narrativeParts: string[] = [];
  const recommendations: string[] = [];

  // 1. Analyze Whitelisted / Trusted Infrastructure
  if (isTrusted && !hasHardBlacklist && (!obfuscation || obfuscation.score === 0)) {
    return {
      verdictLabel: 'Верифіковано (Безпечно)',
      severityClass: 'safe',
      executiveSummary: 'Повідомлення надійшло з верифікованої інфраструктури довіреного домену та не містить маніпулятивних маркерів.',
      xaiNarrative: 'Повідомлення успішно пройшло повний криміналістичний аудит. Домен відправника належить до захищеного переліку довірених провайдерів (BIMI/DMARC), репутаційні бази Safe Browsing не зафіксували компрометації посилань, а лінгвістичний аналіз тексту підтверджує відсутність прихованого шкідливого наміру.',
      primaryDrivers: [
        {
          title: 'Довірений домен (BIMI / Whitelist)',
          score: 100,
          description: 'Офіційний підтверджений сервер відправника.',
          severity: 'safe'
        },
        {
          title: 'Чистий контент',
          score: 100,
          description: 'Відсутні обфускація, гомогліфи та маніпулятивні патерни.',
          severity: 'safe'
        }
      ],
      infrastructureAssessment: 'Інфраструктура відправника верифікована. Криптографічні підписи та поштові шлюзи функціонують у штатному режимі.',
      recommendedActions: [
        'Повідомлення є легітимним та безпечним для обробки.',
        'Додаткових заходів захисту не вимагається.'
      ]
    };
  }

  // 2. Map detected vectors by trigger types
  const urgencyVec = vectors.find(v => /терміновість|urgent/i.test(v.trigger));
  const actionVec = vectors.find(v => /дія|action|заклик/i.test(v.trigger));
  const finVec = vectors.find(v => /фінанс|money|грош|штраф|виграш/i.test(v.trigger));
  const authVec = vectors.find(v => /авторитет|authority|безпека/i.test(v.trigger));
  const credVec = vectors.find(v => /пароль|обліков|credential/i.test(v.trigger));

  // 3. Evaluate Hard Blacklist / IoC Threats
  if (hasHardBlacklist) {
    drivers.push({
      title: 'Глобальні чорні списки загроз (IoC)',
      score: 100,
      description: 'Посилання або DNS-домен заблоковано базами Google Safe Browsing, URLhaus або виявлено NXDOMAIN.',
      severity: 'critical'
    });
    narrativeParts.push('Виявлено пряме знешкодження посилань глобальними системами кіберзахисту (Google Safe Browsing / URLhaus). Виявлені домени використовуються для розповсюдження шкідливого ПЗ або збору банківських реквізитів.');
    recommendations.push('Негайно заблокувати цільовий URL на корпоративному брандмауері та DNS-шлюзі.');
  } else if (hasMlUrlThreat) {
    drivers.push({
      title: 'Нейромережева підозра URL',
      score: 85,
      description: 'Структура посилання та ентропія домену мають високу кореляцію з фішинговими посадковими сторінками.',
      severity: 'warning'
    });
    narrativeParts.push('ML-аналізатор структури URL виявив аномальну ентропію шляхів і субдоменів, характерну для цільових фішингових сайтів.');
  }

  // 4. Evaluate Brand Typosquatting / Combosquatting
  if (brandResults.length > 0) {
    const brands = brandResults.map(b => b.targetBrand?.name || b.candidateDomain).join(', ');
    const maxSquatScore = Math.max(...brandResults.map(b => b.similarityScore || 0.85));
    drivers.push({
      title: `Тайпосквотинг / комбосквотинг бренду (${brands})`,
      score: Math.round(maxSquatScore * 100),
      description: `Зловмисники експлуатують довіру до бренду ${brands} на сторонньому незареєстрованому домені.`,
      severity: 'critical'
    });
    narrativeParts.push(`Зафіксовано спробу соціальної інженерії через імітацію бренду ${brands}. Фальшивий домен використовує техніку комбосквотингу для обману візуального сприйняття користувача.`);
    recommendations.push(`Повідомити службу безпеки про фішингову імітацію бренду ${brands}.`);
  }

  // 5. Evaluate Email Authentication (SPF / DKIM / DMARC)
  if (emailAuth?.hasHeaders) {
    if (emailAuth.isSpoofed) {
      drivers.push({
        title: 'Спуфінг відправника (RFC 7208 / 6376)',
        score: 95,
        description: 'Провал автентифікації SPF або відсутність узгодженості DMARC. Адреса підроблена.',
        severity: 'critical'
      });
      narrativeParts.push('Криміналістична перевірка поштових заголовків виявила фальсифікацію адреси відправника: відправний сервер не авторизований власником домену (SPF/DMARC fail).');
      recommendations.push('Налаштувати жорстку політику відхилення непідписаних листів DMARC: p=reject.');
    } else {
      drivers.push({
        title: 'Автентичність відправника підтверджена',
        score: 10,
        description: 'Поштові сервери пройшли перевірку SPF та DKIM підписів.',
        severity: 'safe'
      });
    }
  }

  // 6. Evaluate Behavioral & Semantic Triggers
  if (urgencyVec && finVec) {
    drivers.push({
      title: 'Психологічний тиск: дефіцит часу та фінанси',
      score: Math.round(((urgencyVec.score + finVec.score) / 2) * 100),
      description: 'Поєднання штучної паніки щодо блокування рахунків з вимогами негайної оплати чи верифікації.',
      severity: 'critical'
    });
    narrativeParts.push('Семантичне ядро зафіксувало класичний тандем соціальної інженерії: штучне відчуття паніки через блокування або штрафи разом із вимогою миттєвих дій для уникнення санкцій.');
  } else if (urgencyVec) {
    drivers.push({
      title: 'Штучна терміновість (Urgency)',
      score: Math.round(urgencyVec.score * 100),
      description: urgencyVec.explanation || 'Маніпуляція дефіцитом часу для блокування раціональної перевірки фактів.',
      severity: urgencyVec.score > 0.75 ? 'critical' : 'warning'
    });
    narrativeParts.push('Виявлено високий рівень лексичної терміновості, покликаний примусити користувача діяти імпульсивно.');
  }

  if (actionVec) {
    drivers.push({
      title: 'Заклик до небезпечної дії',
      score: Math.round(actionVec.score * 100),
      description: actionVec.explanation || 'Вимога переходу за посиланням або введення паролів/кодів доступу.',
      severity: actionVec.score > 0.7 ? 'critical' : 'warning'
    });
    narrativeParts.push('У тексті виявлено директивні заклики до переходу за зовнішніми URL або підтвердження облікових записів.');
  }

  // 7. Evaluate Obfuscation
  if (obfuscation && obfuscation.score > 0) {
    drivers.push({
      title: 'Обфускація тексту та гомогліфи',
      score: Math.round(obfuscation.score * 100),
      description: `Приховані символи та заміна літер: ${obfuscation.flags.join(', ')}`,
      severity: 'critical'
    });
    narrativeParts.push('Виявлено навмисну обфускацію тексту (використання кирилично-латинських гомогліфів або невидимих юнікод-розділювачів) з метою обходу автоматичних спам-фільтрів.');
    recommendations.push('Не копіювати текст і не запускати скрипти із вкладень листа.');
  }

  // 8. Spam campaign assessment
  if (isSpam && threatLevel <= 70) {
    return {
      verdictLabel: 'Масова розсилка (Спам)',
      severityClass: 'spam',
      executiveSummary: 'Повідомлення ідентифіковано як рекламну або спам-кампанію без деструктивного шкідливого навантаження.',
      xaiNarrative: 'Аналізатор класифікував повідомлення як небажану кореспонденцію або маркетингову розсилку. Не виявлено ознак спуфінгу чи шкідливого програмного забезпечення, проте структура тексту містить типові спам-маркери.',
      primaryDrivers: drivers.length > 0 ? drivers : [
        {
          title: 'Спам-патерни контенту',
          score: Math.round(threatLevel),
          description: 'Рекламний характер, надлишкові заклики та відсутність персоналізації.',
          severity: 'warning'
        }
      ],
      infrastructureAssessment: 'Інфраструктура відправника відповідає типовим маркетинговим розсилкам.',
      recommendedActions: [
        'Позначити повідомлення як спам у поштовому клієнті.',
        'Не відписуватися через підозрілі зовнішні посилання у футері листа.'
      ]
    };
  }

  // 9. Synthesize final verdict
  let verdictLabel = 'Безпечно';
  let severityClass: ThreatAnalysisReport['severityClass'] = 'safe';

  if (threatLevel > 70) {
    verdictLabel = 'Критична загроза';
    severityClass = 'critical';
    recommendations.unshift('Категорично заборонено переходити за посиланнями та вводити паролі або банківські реквізити.');
    recommendations.push('Додати відправника та його поштовий домен до корпоративного чорного списку.');
  } else if (threatLevel > 40) {
    verdictLabel = 'Підозріло';
    severityClass = 'warning';
    recommendations.unshift('Перевірити достовірність інформації через офіційний окремий канал зв’язку (наприклад, гарячу лінію).');
    recommendations.push('Не завантажувати вкладення та перевірити відповідність поштового домену.');
  } else {
    recommendations.push('Повідомлення не містить активних загроз. Дотримуйтесь стандартних правил кібергігієни.');
  }

  if (narrativeParts.length === 0) {
    if (threatLevel > 70) {
      narrativeParts.push('Модель виявила високу концентрацію маніпулятивних маркерів, характерних для цільового фішингу.');
    } else if (threatLevel > 40) {
      narrativeParts.push('Виявлено сукупність помірних факторів ризику, що вимагають додаткової уваги перед взаємодією.');
    } else {
      narrativeParts.push('Текст та посилання успішно пройшли перевірку, ознак цільових загроз не виявлено.');
    }
  }

  const executiveSummary = threatLevel > 70
    ? 'Виявлено критичні ознаки цільового фішингу, спроби викрадення даних або підміни відправника.'
    : (threatLevel > 40
      ? 'Повідомлення містить ознаки маніпуляцій або неперевірені посилання, що несуть потенційну загрозу.'
      : 'Повідомлення успішно пройшло перевірку цифрових підписів та лінгвістичного ядра.');

  const infrastructureAssessment = hasHardBlacklist
    ? 'Критичний стан інфраструктури: цільові ресурси заблоковані міжнародними базами шкідливого ПЗ (IoC).'
    : (emailAuth?.isSpoofed
      ? 'Компрометація поштової автентичності: виявлено підробку адреси відправника.'
      : 'Технічна інфраструктура не містить зафіксованих блокувань у глобальних реєстрах.');

  return {
    verdictLabel,
    severityClass,
    executiveSummary,
    xaiNarrative: narrativeParts.join(' '),
    primaryDrivers: drivers,
    infrastructureAssessment,
    recommendedActions: recommendations
  };
}

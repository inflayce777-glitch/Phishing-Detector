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

export interface XaiFinding {
  id: string;
  category: string;
  severity: 'critical' | 'warning' | 'info' | 'safe';
  title: string;
  detail: string;
}

export interface ThreatAnalysisReport {
  verdictLabel: string;
  severityClass: 'critical' | 'warning' | 'safe' | 'spam';
  executiveSummary: string;
  xaiNarrative: string;
  findings: XaiFinding[];
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
 * into a structured, highly readable list of forensic findings and explanations.
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
  const findings: XaiFinding[] = [];
  const recommendations: string[] = [];

  // 1. Analyze Whitelisted / Trusted Infrastructure
  if (isTrusted && !hasHardBlacklist && (!obfuscation || obfuscation.score === 0)) {
    return {
      verdictLabel: 'Верифіковано (Безпечно)',
      severityClass: 'safe',
      executiveSummary: 'Повідомлення надійшло з верифікованої інфраструктури довіреного домену та не містить маніпулятивних маркерів.',
      xaiNarrative: 'Повідомлення успішно пройшло криміналістичний аудит. Домен відправника належить до захищеного переліку довірених провайдерів (BIMI/DMARC), посилання не зафіксовані в базах загроз, а текст не містить маніпулятивних маркерів.',
      findings: [
        {
          id: 'trusted-infrastructure',
          category: 'Довірена інфраструктура',
          severity: 'safe',
          title: 'Підтверджений домен (BIMI / Whitelist)',
          detail: 'Домен відправника належить до офіційного списку захищених доменів з коректними цифровими підписами.'
        },
        {
          id: 'clean-text',
          category: 'Семантичний аудит',
          severity: 'safe',
          title: 'Відсутність маніпуляцій',
          detail: 'Текст не містить прихованих гомогліфів, обфускації, штучної терміновості чи закликів до компрометації даних.'
        }
      ],
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
      description: 'Посилання або DNS-домен заблоковано глобальними базами кіберзахисту (Google Safe Browsing, PhishTank, OpenPhish, URLhaus) або виявлено NXDOMAIN.',
      severity: 'critical'
    });
    findings.push({
      id: 'hard-blacklist',
      category: 'Чорні списки (IoC)',
      severity: 'critical',
      title: 'Блокування глобальними системами безпеки',
      detail: 'Посилання або домен заблоковано системами кіберзахисту (Google Safe Browsing / PhishTank / OpenPhish / URLhaus) або веде на мертвий/підроблений DNS-домен (NXDOMAIN), типовий для фішингових форм.'
    });
    recommendations.push('Негайно заблокувати цільовий URL на корпоративному брандмауері та DNS-шлюзі.');
  } else if (hasMlUrlThreat) {
    drivers.push({
      title: 'Нейромережева підозра URL',
      score: 85,
      description: 'Структура посилання та ентропія домену мають високу кореляцію з фішинговими посадковими сторінками.',
      severity: 'warning'
    });
    findings.push({
      id: 'ml-url-threat',
      category: 'Аналіз URL',
      severity: 'warning',
      title: 'Підозріла структура посилання',
      detail: 'Нейромережевий аналізатор структури посилань виявив аномальну ентропію субдоменів та параметрів, характерну для фішингу.'
    });
  }

  // 4. Evaluate Brand Typosquatting / Combosquatting
  const impersonatedBrands = (brandResults || []).filter(b => b.isImpersonation && b.targetBrand);
  if (impersonatedBrands.length > 0) {
    const brands = Array.from(new Set(impersonatedBrands.map(b => b.targetBrand?.name || b.candidateDomain))).join(', ');
    const maxSquatScore = Math.max(...impersonatedBrands.map(b => b.similarityScore || 0.85));
    const hasVisualHomoglyph = impersonatedBrands.some(b => b.technique === 'Visual Homoglyph');
    const hasKeyboardProximity = impersonatedBrands.some(b => b.technique === 'Keyboard Proximity');

    const driverTitle = hasVisualHomoglyph
      ? `Оптична імітація бренду (ASCII Homoglyph: ${brands})`
      : hasKeyboardProximity
      ? `Клавіатурний тайпосквотинг (QWERTY Proximity: ${brands})`
      : `Тайпосквотинг / комбосквотинг бренду (${brands})`;

    const findingTitle = hasVisualHomoglyph
      ? `Оптичний гомогліф: візуальна підміна бренду (${brands})`
      : hasKeyboardProximity
      ? `Клавіатурний тайпосквотинг: промах по клавішах (${brands})`
      : `Спроба підміни бренду (${brands})`;

    const findingDetail = hasVisualHomoglyph
      ? `Виявлено використання оптичної схожості символів (наприклад, "rn" замість "m" або "cl" замість "d"). В адресному рядку браузера такий домен візуально майже неможливо відрізнити від офіційного ресурсу ${brands}.`
      : hasKeyboardProximity
      ? `Домен експлуатує випадковий друкарський промах пальця по сусідніх клавішах QWERTY-розкладки (наприклад, "b" замість "v"). Зловмисники перехоплюють трафік користувачів, які помилилися при ручному вводі імені бренду ${brands}.`
      : `Виявлено експлуатацію імені бренду ${brands}. Фальшивий домен використовує техніку комбосквотингу для введення користувача в оману.`;

    drivers.push({
      title: driverTitle,
      score: Math.round(maxSquatScore * 100),
      description: `Зловмисники експлуатують довіру до бренду ${brands} на сторонньому неофіційному домені.`,
      severity: 'critical'
    });
    findings.push({
      id: 'brand-impersonation',
      category: 'Імітація бренду',
      severity: 'critical',
      title: findingTitle,
      detail: findingDetail
    });
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
      findings.push({
        id: 'email-spoofing',
        category: 'Автентичність',
        severity: 'critical',
        title: 'Підміна відправника (Email Spoofing)',
        detail: 'Криміналістична перевірка заголовків виявила фальсифікацію адреси відправника: поштовий сервер маршрутизації не авторизований у DNS власника домену (SPF/DMARC fail).'
      });
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
    findings.push({
      id: 'psych-coercion',
      category: 'Психологічний тиск',
      severity: 'critical',
      title: 'Маніпуляція дефіцитом часу та фінансами',
      detail: 'Семантичне ядро зафіксувало тандем соціальної інженерії: штучне створення паніки через блокування чи штрафи разом із вимогою миттєвих дій для уникнення санкцій.'
    });
  } else if (urgencyVec) {
    drivers.push({
      title: 'Штучна терміновість (Urgency)',
      score: Math.round(urgencyVec.score * 100),
      description: urgencyVec.explanation || 'Маніпуляція дефіцитом часу для блокування раціональної перевірки фактів.',
      severity: urgencyVec.score > 0.75 ? 'critical' : 'warning'
    });
    findings.push({
      id: 'urgency-trigger',
      category: 'Маніпуляція часом',
      severity: urgencyVec.score > 0.75 ? 'critical' : 'warning',
      title: 'Штучна терміновість',
      detail: 'Виявлено підвищену концентрацію маркерів терміновості (дефіцит часу), покликану спонукати користувача до імпульсивних дій.'
    });
  }

  if (actionVec) {
    drivers.push({
      title: 'Заклик до небезпечної дії',
      score: Math.round(actionVec.score * 100),
      description: actionVec.explanation || 'Вимога переходу за посиланням або введення паролів/кодів доступу.',
      severity: actionVec.score > 0.7 ? 'critical' : 'warning'
    });
    findings.push({
      id: 'action-trigger',
      category: 'Заклик до дії',
      severity: actionVec.score > 0.7 ? 'critical' : 'warning',
      title: 'Директивні заклики до переходу',
      detail: 'У тексті виявлено явні вказівки перейти за зовнішніми посиланнями або підтвердити конфіденційні облікові записи.'
    });
  }

  // 7. Evaluate Obfuscation
  if (obfuscation && obfuscation.score > 0) {
    drivers.push({
      title: 'Обфускація тексту та гомогліфи',
      score: Math.round(obfuscation.score * 100),
      description: `Приховані символи та заміна літер: ${obfuscation.flags.join(', ')}`,
      severity: 'critical'
    });
    findings.push({
      id: 'text-obfuscation',
      category: 'Обфускація тексту',
      severity: 'critical',
      title: 'Навмисна маскування літер (гомогліфи)',
      detail: `Виявлено спробу обходу фільтрів безпеки за допомогою підміни символів (гомогліфи кирилиця/латиниця або невидимі юнікод-розділювачі): ${obfuscation.flags.join(', ')}.`
    });
    recommendations.push('Не копіювати текст і не запускати скрипти із вкладень листа.');
  }

  // 8. Spam campaign assessment
  if (isSpam && threatLevel <= 70) {
    const spamFindings: XaiFinding[] = [
      {
        id: 'spam-marker',
        category: 'Масова розсилка',
        severity: 'warning',
        title: 'Ознаки маркетингового спаму',
        detail: 'Повідомлення ідентифіковано як рекламну або спам-кампанію. Прямого шкідливого навантаження немає, але контент є нав’язливим.'
      }
    ];

    return {
      verdictLabel: 'Масова розсилка (Спам)',
      severityClass: 'spam',
      executiveSummary: 'Повідомлення ідентифіковано як рекламну або спам-кампанію без деструктивного шкідливого навантаження.',
      xaiNarrative: 'Аналізатор класифікував повідомлення як небажану кореспонденцію або маркетингову розсилку. Не виявлено ознак спуфінгу чи шкідливого програмного забезпечення, проте структура тексту містить типові спам-маркери.',
      findings: spamFindings,
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

  // Default finding if list is empty
  if (findings.length === 0) {
    if (threatLevel > 70) {
      findings.push({
        id: 'generic-critical',
        category: 'Цільовий фішинг',
        severity: 'critical',
        title: 'Комплекс маніпулятивних маркерів',
        detail: 'Модель виявила високу концентрацію маркерів соціальної інженерії, характерних для цільового фішингу.'
      });
    } else if (threatLevel > 40) {
      findings.push({
        id: 'generic-warning',
        category: 'Помірний ризик',
        severity: 'warning',
        title: 'Потенційно небажаний вміст',
        detail: 'Виявлено сукупність помірних факторів ризику, що вимагають додаткової обачності перед взаємодією.'
      });
    } else {
      findings.push({
        id: 'generic-safe',
        category: 'Безпечний вміст',
        severity: 'safe',
        title: 'Загроз не виявлено',
        detail: 'Текст та посилання успішно пройшли перевірку, ознак цільових атак чи маніпуляцій не знайдено.'
      });
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

  const narrativeText = findings.map(f => f.detail).join(' ');

  return {
    verdictLabel,
    severityClass,
    executiveSummary,
    xaiNarrative: narrativeText,
    findings,
    primaryDrivers: drivers,
    infrastructureAssessment,
    recommendedActions: recommendations
  };
}

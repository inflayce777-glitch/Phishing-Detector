export interface ThreatTemplate {
  id: string;
  title: string;
  category: 'banking' | 'accounts' | 'delivery' | 'blackmail' | 'spam' | 'safe';
  categoryLabel: string;
  threatType: 'phishing' | 'spam' | 'safe';
  threatTypeLabel: string;
  mode: 'email' | 'messenger';
  senderEmail?: string;
  linkUrl?: string;
  text: string;
  description: string;
}

export const THREAT_CATEGORIES = [
  { id: 'all', label: 'Усі категорії' },
  { id: 'banking', label: 'Банківський фішинг' },
  { id: 'accounts', label: 'Викрадення акаунтів' },
  { id: 'delivery', label: 'Шахрайство та виплати' },
  { id: 'blackmail', label: 'Шантаж та вимагання' },
  { id: 'spam', label: 'Комерційний спам' },
  { id: 'safe', label: 'Безпечні повідомлення' },
] as const;

export const THREAT_TEMPLATES: ThreatTemplate[] = [
  // 1. БАНКІВСЬКИЙ ФІШИНГ
  {
    id: 'privatbank-card-blocked',
    title: 'ПриватБанк: Блокування картки',
    category: 'banking',
    categoryLabel: 'Банківський фішинг',
    threatType: 'phishing',
    threatTypeLabel: 'Критично (фішинг)',
    mode: 'email',
    senderEmail: 'security@privatbank-verify-ua.online',
    linkUrl: 'https://privat24-card-secure.top/auth',
    text: `Від: security@privatbank-verify-ua.online
Тема: Терміново: Ваша картка ПриватБанку заблокована!

Шановний клієнте!
Службою безпеки банку зафіксовано несанкціоновану спробу списання коштів на суму 4 850.00 грн о 03:14 з невідомого пристрою.

З метою захисту ваших фінансів дію платіжної картки тимчасово обмежено.

Для розблокування картки та підтвердження права власності негайно перейдіть за безпечним посиланням:
👉 https://privat24-card-secure.top/auth

Увага! Якщо верифікацію не буде пройдено протягом 4 годин, рахунок буде заблоковано на 30 днів згідно з регламентом безпеки НБУ.`,
    description: 'Класичний банківський фішинг із тиском на час, підробленим доменом та залякуванням блокування картки.'
  },
  {
    id: 'monobank-cashback-scam',
    title: 'Monobank: Нарахування кешбеку 5 000 грн',
    category: 'banking',
    categoryLabel: 'Банківський фішинг',
    threatType: 'phishing',
    threatTypeLabel: 'Критично (фішинг)',
    mode: 'messenger',
    senderEmail: '+380931122334',
    linkUrl: 'https://mono-app-bonus.xyz/claim',
    text: `mono | Офіційне сповіщення!

Вам нараховано спеціальний кешбек від партнерів банку у розмірі 5 000 грн за лояльність у 2026 році.

Отримати виплату на картку mono можна за прямим посиланням:
👉 https://mono-app-bonus.xyz/claim

Для зарахування коштів введіть свій номер телефону та PIN-код картки у формі підтвердження. Пропозиція діє до 23:59 сьогодні!`,
    description: 'Шахрайська приманка з обіцянкою легких грошей (фінансова нажива) та крадіжкою PIN-коду.'
  },
  {
    id: 'oschadbank-verification',
    title: 'Ощадбанк: Перевірка ідентифікації',
    category: 'banking',
    categoryLabel: 'Банківський фішинг',
    threatType: 'phishing',
    threatTypeLabel: 'Критично (фішинг)',
    mode: 'email',
    senderEmail: 'support@oschad-verification.com',
    linkUrl: 'https://oschad-id-cabinet.online/login',
    text: `Від: support@oschad-verification.com
Тема: Обов'язкова повторна ідентифікація клієнта

Шановний клієнте АТ "Ощадбанк"!
Відповідно до постанови Правління НБУ щодо оновлення персональних даних, вам необхідно пройти онлайн-ідентифікацію клієнта.

Якщо ви не підтвердите персональні дані, операції по вашим рахункам буде призупинено.

Пройти верифікацію особистого кабінету:
https://oschad-id-cabinet.online/login

Дякуємо за розуміння,
Ваш Ощадбанк.`,
    description: 'Атака з маскуванням під державний банк та посилання на офіційні регуляції.'
  },

  // 2. ВИКРАДЕННЯ АКАУНТІВ
  {
    id: 'google-security-alert',
    title: 'Google: Сповіщення про вхід з нового пристрою',
    category: 'accounts',
    categoryLabel: 'Викрадення акаунтів',
    threatType: 'phishing',
    threatTypeLabel: 'Критично (фішинг)',
    mode: 'email',
    senderEmail: 'no-reply@accounts-google-security.net',
    linkUrl: 'https://google-recovery-login.site/confirm',
    text: `MIME-Version: 1.0
From: "Google Security Team" <no-reply@accounts-google-security.net>
Subject: Critical security alert: Unauthorized login attempt
To: user@gmail.com

Someone just used your password to try to sign in to your Google Account from an unrecognized device:
Device: Linux (Ubuntu 22.04), IP: 185.220.101.5 (Moscow, Russia)
Time: October 15, 2026, 14:12 UTC

If this wasn't you, your account is at high risk. Protect your account immediately by changing your password:
https://google-recovery-login.site/confirm

Google Security Operations`,
    description: 'Атака типу Credential Harvesting з імітацією реального безпекового листа від Google.'
  },
  {
    id: 'microsoft-office-password',
    title: 'Microsoft 365: Закінчення дії корпоративного пароля',
    category: 'accounts',
    categoryLabel: 'Викрадення акаунтів',
    threatType: 'phishing',
    threatTypeLabel: 'Критично (фішинг)',
    mode: 'email',
    senderEmail: 'admin@it-microsoft365-portal.org',
    linkUrl: 'https://login-microsoftonline.work/keep-password',
    text: `From: IT Helpdesk <admin@it-microsoft365-portal.org>
Subject: Action Required: Your Office 365 password expires in 2 hours

Hello team member,

Your Microsoft 365 corporate account password will expire today in approximately 2 hours.

To keep your current password and avoid service interruption (Outlook, Teams, SharePoint), please verify your identity here:
👉 https://login-microsoftonline.work/keep-password

Failure to do so will result in an automated account lock until Monday.

IT Support & Infrastructure`,
    description: 'Корпоративний фішинг проти співробітників компаній для зламу робочої пошти.'
  },
  {
    id: 'telegram-session-hijack',
    title: 'Telegram: Підтвердження завершення сеансів',
    category: 'accounts',
    categoryLabel: 'Викрадення акаунтів',
    threatType: 'phishing',
    threatTypeLabel: 'Критично (фішинг)',
    mode: 'messenger',
    senderEmail: 'Telegram Security Bot',
    linkUrl: 'https://tg-web-confirm.space/auth',
    text: `🔔 Служба безпеки Telegram

Зафіксовано запит на видалення вашого облікового запису або завершення всіх сесій з IP-адреси 45.154.255.10 (Варшава, Польща).

Якщо ви не робили цього запиту, скасуйте операцію негайно, перейшовши за посиланням:
👉 https://tg-web-confirm.space/auth

Введіть код із SMS/додатка, щоб підтвердити, що ви є справжнім власником акаунта.`,
    description: 'Фішинг у месенджері для крадіжки коду авторизації та перехоплення сесії Telegram.'
  },

  // 3. ШАХРАЙСТВО ТА ВИПЛАТИ
  {
    id: 'diia-epidtrymka-6600',
    title: 'єПідтримка: Державна допомога 6 600 грн',
    category: 'delivery',
    categoryLabel: 'Шахрайство та виплати',
    threatType: 'phishing',
    threatTypeLabel: 'Критично (фішинг)',
    mode: 'messenger',
    senderEmail: 'Дія Повідомлення',
    linkUrl: 'https://diia-help-gov.top/claim',
    text: `Дія: Вам призначено фінансову допомогу!

У рамках програми підтримки громадян України у 2026 році вам погоджено одноразову виплату у розмірі 6 600 грн.

Щоб вибрати банк для зарахування допомоги, перейдіть у кабінет виплат:
👉 https://diia-help-gov.top/claim

Заявку необхідно подати протягом 48 годин з моменту отримання повідомлення.`,
    description: 'Популярна шахрайська схема з використанням бренду «Дія» для викрадення банківських даних.'
  },
  {
    id: 'nova-poshta-delivery-fee',
    title: 'Нова Пошта: Помилка адреси доставки посилки',
    category: 'delivery',
    categoryLabel: 'Шахрайство та виплати',
    threatType: 'phishing',
    threatTypeLabel: 'Критично (фішинг)',
    mode: 'messenger',
    senderEmail: 'NovaPoshta',
    linkUrl: 'https://novaposhta-tracking-ua.info/address',
    text: `Нова Пошта: Ваша посилка 20450893411295 не може бути доставлена через неповну адресу отримувача.

Будь ласка, оновіть контактні дані та сплатіть повторну доставку (18.50 грн) за посиланням:
👉 https://novaposhta-tracking-ua.info/address

Без підтвердження посилка буде утилізована протягом 3 днів.`,
    description: 'Смішинг (SMS-фішинг) від імені кур\'єрської служби з мікроплатежем для крадіжки даних банківської картки.'
  },

  // 4. ШАНТАЖ ТА ВИМАГАННЯ
  {
    id: 'sextortion-bitcoin',
    title: 'Шантаж: Відеофіксація та вимога Bitcoin',
    category: 'blackmail',
    categoryLabel: 'Шантаж та вимагання',
    threatType: 'phishing',
    threatTypeLabel: 'Критично (фішинг)',
    mode: 'email',
    senderEmail: 'hacker-group@darknet-mail.cc',
    linkUrl: 'https://btc-pay-gateway.link/wallet',
    text: `From: system_admin@yourdomain.com
Subject: You have 48 hours. Your secrets are recorded.

I know your password and I have full access to your operating system.
A few weeks ago, I infected your device with a remote access trojan through a malicious video player.

I recorded video from your webcam while you were visiting adult websites, alongside your screen recordings.
I have exported your entire contact list, telegram messages, and email contacts.

If you don't want this footage sent to all your family, friends, and coworkers, transfer $850 in Bitcoin to my address within 48 hours:
BTC Wallet: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa

Confirmation link: https://btc-pay-gateway.link/wallet

Do not try to contact the police or reply to this email. The clock is ticking.`,
    description: 'Психологічний терор (Sextortion Scam) зі спуфінгом власної адреси користувача та вимогою криптовалюти.'
  },

  // 5. КОМЕРЦІЙНИЙ СПАМ
  {
    id: 'b2b-cold-sales-outreach',
    title: 'B2B Розсилка: Збільшення продажів на 40%',
    category: 'spam',
    categoryLabel: 'Комерційний спам',
    threatType: 'spam',
    threatTypeLabel: 'Підозріло (спам)',
    mode: 'email',
    senderEmail: 'sales@digital-growth-agency-pro.com',
    linkUrl: 'https://growth-agency.com/meeting',
    text: `Доброго дня!

Мене звати Олексій, я представляю агентство автоматизації бізнес-процесів.
Ми допомагаємо українським IT та eCommerce компаніям збільшувати потік лідів на 35-50% без збільшення бюджету на рекламу.

У нас є готові кейси для вашої ніші. Чи могли б ми організувати коротку 15-хвилинну демонстрацію у Zoom на цьому тижні?

Ознайомитися з нашими кейсами або забронювати час у календарі:
👉 https://growth-agency.com/meeting

Якщо ця пропозиція не актуальна, просто дайте знати, і ми більше не турбуватимемо вас.

З повагою,
Команда Digital Growth Agency`,
    description: 'Типовий холодний комерційний лист (B2B Cold Outreach). Не містить шкідливого ПЗ, але є небажаною розсилкою.'
  },
  {
    id: 'seo-audit-spam',
    title: 'Спам: Безкоштовний аудит сайту та SEO просування',
    category: 'spam',
    categoryLabel: 'Комерційний спам',
    threatType: 'spam',
    threatTypeLabel: 'Підозріло (спам)',
    mode: 'messenger',
    senderEmail: '+380509988776',
    linkUrl: 'https://seo-boost-expert.top/free-audit',
    text: `Вітаю! Помітили кілька критичних помилок на вашому веб-сайті, через які ви втрачаєте до 60% потенційних клієнтів із Google!

Пропонуємо провести безкоштовний комплексний аудит та вивести сайт у ТОП-3 за 30 днів із гарантією результату.

👉 Отримати звіт: https://seo-boost-expert.top/free-audit
Знижка 25% на оптимізацію до кінця місяця!`,
    description: 'Агресивний рекламний спам із нереалістичними обіцянками та масовою розсилкою.'
  },

  // 6. БЕЗПЕЧНІ ПОВІДОМЛЕННЯ (BENIGN)
  {
    id: 'weekly-team-report',
    title: 'Робочий лист: Щотижневий звіт команди розробки',
    category: 'safe',
    categoryLabel: 'Безпечні повідомлення',
    threatType: 'safe',
    threatTypeLabel: 'Безпечно',
    mode: 'email',
    senderEmail: 'vlad.developer@company.ua',
    linkUrl: 'https://github.com/inflayce777-glitch/Phishing-Detector',
    text: `Від: vlad.developer@company.ua
Тема: Щотижневий звіт команди: рефакторинг та оновлення репозиторію

Привіт усім!

Ділюся підсумками нашої роботи за минулий тиждень:
1. Завершено рефакторинг інтерфейсу сканера та винесено компоненти в окремі модулі.
2. Впроваджено живу DNS-перевірку протоколів SPF та DMARC на бекенді.
3. Оновлено базу шаблонів для швидкого тестування різних типів загроз.

Код та документація оновлені в нашому репозиторії:
https://github.com/inflayce777-glitch/Phishing-Detector

Наступна синхронізація запланована на понеділок о 10:00.

Гарних вихідних!`,
    description: 'Звичайний робочий лист без жодних маніпулятивних патернів чи підозрілих посилань.'
  },
  {
    id: 'google-meet-invitation',
    title: 'Календар: Запрошення на нараду в Google Meet',
    category: 'safe',
    categoryLabel: 'Безпечні повідомлення',
    threatType: 'safe',
    threatTypeLabel: 'Безпечно',
    mode: 'email',
    senderEmail: 'calendar-notification@google.com',
    linkUrl: 'https://meet.google.com/abc-defg-hij',
    text: `From: Google Calendar <calendar-notification@google.com>
Subject: Invitation: Project Sync @ Mon Oct 19, 2026 11am - 12pm (EEST)

You have been invited to the following event:
Project Sync & Sprint Planning

When: Monday Oct 19, 2026 · 11:00 – 12:00 EEST
Where: Google Meet

Joining info:
Join with Google Meet: https://meet.google.com/abc-defg-hij

Organizer: team.lead@company.com`,
    description: 'Офіційне системне сповіщення від Google Calendar із перевіреного домену google.com.'
  }
];

export function getTemplatesByCategory(category: string): ThreatTemplate[] {
  if (category === 'all') return THREAT_TEMPLATES;
  return THREAT_TEMPLATES.filter(t => t.category === category);
}

export function searchTemplates(query: string, category: string = 'all'): ThreatTemplate[] {
  const normalized = query.toLowerCase().trim();
  const byCat = getTemplatesByCategory(category);
  if (!normalized) return byCat;
  
  return byCat.filter(t => 
    t.title.toLowerCase().includes(normalized) ||
    t.description.toLowerCase().includes(normalized) ||
    t.text.toLowerCase().includes(normalized) ||
    (t.senderEmail && t.senderEmail.toLowerCase().includes(normalized))
  );
}

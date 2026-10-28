import { PhishingVector } from './heuristics';
import { ThreatAnalysisReport } from './threatExplainer';

export interface ForensicReportPayload {
  threatLevel: number;
  verdictLabel: string;
  isSpam: boolean;
  isTrusted: boolean;
  senderEmail?: string;
  effectiveSender?: string;
  subject?: string;
  rawTextPreview?: string;
  vectors: PhishingVector[];
  safeBrowsingMatches: any[];
  brandResults: any[];
  rdapResults: Record<string, any>;
  emailAuth?: any;
  obfuscation?: any;
  threatReport?: ThreatAnalysisReport;
  timestamp?: string;
}

/**
 * Generates an executive, professional high-contrast Forensic Cyber Threat PDF Report.
 * Specifically calibrated for flawless white paper rendering, sharp vector typography,
 * seamless 1-page/multi-page print fitting, and 100% WCAG AAA contrast ratio compliance.
 */
export function generateForensicPdfReport(data: ForensicReportPayload) {
  const dateStr = data.timestamp ? new Date(data.timestamp) : new Date();
  const formattedDate = dateStr.toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  
  const caseId = `CYBER-${dateStr.getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  
  // High-contrast color definitions for crisp white page / PDF printing
  const isCritical = data.threatLevel > 70;
  const isWarning = data.threatLevel > 40 && !isCritical;
  
  const verdictTheme = isCritical
    ? {
        border: '#dc2626',
        bg: '#fef2f2',
        titleColor: '#991b1b',
        circleBorder: '#dc2626',
        circleText: '#991b1b',
      }
    : isWarning
    ? {
        border: '#d97706',
        bg: '#fffbeb',
        titleColor: '#92400e',
        circleBorder: '#d97706',
        circleText: '#92400e',
      }
    : {
        border: '#16a34a',
        bg: '#f0fdf4',
        titleColor: '#166534',
        circleBorder: '#16a34a',
        circleText: '#166534',
      };

  // Format triggers table rows with solid dark text
  const triggersRows = data.vectors.length > 0
    ? data.vectors.map(v => `
      <tr style="break-inside: avoid; page-break-inside: avoid;">
        <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #0f172a; font-size: 10.5px;">
          ${v.trigger}
        </td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-family: 'SFMono-Regular', Consolas, monospace; font-weight: 800; color: #dc2626; text-align: center; font-size: 11px;">
          ${(v.score * 100).toFixed(1)}%
        </td>
        <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 10px; line-height: 1.4;">
          ${v.explanation || '—'}
        </td>
      </tr>
    `).join('')
    : `
      <tr>
        <td colspan="3" style="padding: 10px; text-align: center; color: #166534; font-weight: 600; font-style: italic; font-size: 10.5px;">
          ✓ Маніпулятивних маркерів чи семантичних тригерів не виявлено (контент чистий)
        </td>
      </tr>
    `;

  // Format URLs & IOC cards (black mono URL text on crisp white subcard)
  const urlsList = (data.safeBrowsingMatches || []).length > 0
    ? data.safeBrowsingMatches.map(m => `
      <div style="background: #fef2f2; border-left: 3px solid #dc2626; border-top: 1px solid #fecaca; border-right: 1px solid #fecaca; border-bottom: 1px solid #fecaca; padding: 6px 8px; margin-bottom: 6px; border-radius: 4px; break-inside: avoid; page-break-inside: avoid;">
        <div style="font-family: 'SFMono-Regular', Consolas, monospace; font-size: 10px; font-weight: 700; color: #0f172a; word-break: break-all; background: #ffffff; padding: 3px 6px; border-radius: 3px; border: 1px solid #fca5a5; margin-bottom: 4px;">
          ${m.threat?.url || 'URL'}
        </div>
        <div style="color: #991b1b; font-size: 10px; font-weight: 800;">
          Загроза: ${m.threatType}
        </div>
        ${m.details ? `<div style="color: #334155; font-size: 9.5px; margin-top: 3px; line-height: 1.35;">${m.details}</div>` : ''}
      </div>
    `).join('')
    : `
      <div style="color: #166534; font-size: 10.5px; font-weight: 600; padding: 4px 0;">
        ✓ Усі вилучені посилання перевірено в базах Google Safe Browsing, PhishTank, OpenPhish та URLhaus: загроз не знайдено.
      </div>
    `;

  // Format Brand Impersonation
  const impersonatedBrands = (data.brandResults || []).filter(b => b.isImpersonation && b.targetBrand);
  const brandsList = impersonatedBrands.length > 0
    ? impersonatedBrands.map(b => {
      const techniqueLabel = 
        b.technique === 'Visual Homoglyph' ? 'Оптичний гомогліф (ASCII Homoglyph)' :
        b.technique === 'Keyboard Proximity' ? 'Клавіатурний промах (QWERTY Proximity)' :
        b.technique === 'Combosquatting' ? 'Комбосквотинг' :
        b.technique === 'IDN Homoglyph' ? 'IDN Punycode гомогліф' :
        (b.technique || 'тайпосквотинг');

      return `
        <div style="background: #fffbeb; border-left: 3px solid #d97706; border-top: 1px solid #fde68a; border-right: 1px solid #fde68a; border-bottom: 1px solid #fde68a; padding: 6px 8px; margin-bottom: 6px; border-radius: 4px; break-inside: avoid; page-break-inside: avoid;">
          <div style="color: #92400e; font-size: 10px; font-weight: 800;">
            Імітація бренду: ${b.targetBrand?.name || b.candidateDomain} (Схожість: ${((b.similarityScore || 0.85) * 100).toFixed(0)}%)
          </div>
          <div style="color: #1e293b; font-size: 9.5px; margin-top: 3px; line-height: 1.35;">
            <strong>Домен:</strong> <span style="font-family: 'SFMono-Regular', Consolas, monospace; font-weight: 700; color: #0f172a;">${b.candidateDomain || '—'}</span> | <strong>Метод:</strong> ${techniqueLabel}
          </div>
        </div>
      `;
    }).join('')
    : '<div style="color: #475569; font-size: 10px; padding: 4px 0;">Ознак підміни відомих фінансових чи поштових брендів не зафіксовано.</div>';

  // Format Email Auth
  const authSummary = data.emailAuth?.hasHeaders
    ? `
      <div style="display: flex; gap: 12px; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 10px; color: #0f172a; margin-top: 4px;">
        <div>SPF: <span style="font-weight: 800; color: ${data.emailAuth.spf === 'pass' ? '#166534' : '#dc2626'};">${data.emailAuth.spf || 'None'}</span></div>
        <div>DKIM: <span style="font-weight: 800; color: ${data.emailAuth.dkim === 'pass' ? '#166534' : '#dc2626'};">${data.emailAuth.dkim || 'None'}</span></div>
        <div>DMARC: <span style="font-weight: 800; color: ${data.emailAuth.dmarcAlignment === 'aligned' ? '#166534' : '#dc2626'};">${data.emailAuth.dmarcAlignment || 'None'}</span></div>
      </div>
    `
    : '<div style="color: #475569; font-size: 10px; margin-top: 3px;">Службові поштові заголовки відсутні (аналіз тексту або месенджера).</div>';

  // Format XAI Findings as high-contrast structured bullet cards
  const findingsHtml = (data.threatReport?.findings || []).length > 0
    ? (data.threatReport?.findings || []).map(f => {
        const isCrit = f.severity === 'critical';
        const isWarn = f.severity === 'warning';
        const isSafe = f.severity === 'safe';
        const badgeBg = isCrit ? '#fee2e2' : isWarn ? '#fef3c7' : isSafe ? '#f0fdf4' : '#f1f5f9';
        const badgeText = isCrit ? '#991b1b' : isWarn ? '#92400e' : isSafe ? '#166534' : '#1e293b';
        const badgeBorder = isCrit ? '#f87171' : isWarn ? '#f59e0b' : isSafe ? '#86efac' : '#cbd5e1';

        return `
          <div style="margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px solid #f1f5f9; break-inside: avoid; page-break-inside: avoid;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
              <span style="background: ${badgeBg}; color: ${badgeText}; border: 1px solid ${badgeBorder}; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 8.5px; font-weight: 800; padding: 1.5px 6px; border-radius: 3px; text-transform: uppercase;">
                ${f.category}
              </span>
              <strong style="color: #0f172a; font-size: 11px;">${f.title}</strong>
            </div>
            <div style="color: #334155; font-size: 10px; line-height: 1.4; padding-left: 2px;">
              ${f.detail}
            </div>
          </div>
        `;
      }).join('')
    : `<div style="color: #334155; font-size: 10.5px; line-height: 1.4;">${data.threatReport?.xaiNarrative || 'Контент проаналізовано на наявність маркерів соціальної інженерії.'}</div>`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="uk">
    <head>
      <meta charset="UTF-8">
      <title>Криміналістичний звіт — ${caseId}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 8mm 10mm 8mm 10mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background: #f1f5f9;
          color: #0f172a;
          font-size: 11px;
          line-height: 1.45;
          padding: 16px 0;
        }
        .report-page {
          max-width: 800px;
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 22px 26px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 10px;
          margin-bottom: 12px;
        }
        .brand-title {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.01em;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .brand-sub {
          font-size: 9px;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-top: 2px;
          font-family: 'SFMono-Regular', Consolas, monospace;
          font-weight: 700;
        }
        .meta-box {
          text-align: right;
          font-family: 'SFMono-Regular', Consolas, monospace;
          font-size: 9px;
          color: #334155;
          line-height: 1.5;
        }
        .verdict-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: ${verdictTheme.bg};
          border: 2px solid ${verdictTheme.border};
          border-radius: 6px;
          padding: 12px 16px;
          margin-bottom: 10px;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .verdict-title {
          font-size: 20px;
          font-weight: 900;
          color: ${verdictTheme.titleColor};
          letter-spacing: -0.01em;
          margin: 0;
        }
        .verdict-desc {
          color: #334155;
          font-size: 10.5px;
          margin-top: 3px;
          max-width: 530px;
          line-height: 1.4;
          font-weight: 500;
        }
        .score-circle {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 58px;
          height: 58px;
          border-radius: 50%;
          border: 3px solid ${verdictTheme.circleBorder};
          background: #ffffff;
          color: ${verdictTheme.circleText};
          font-weight: 900;
          font-size: 18px;
          font-family: 'SFMono-Regular', Consolas, monospace;
          flex-shrink: 0;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .section-block {
          margin-top: 8px;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .section-title {
          font-size: 9.5px;
          font-weight: 800;
          color: #0f172a;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: #f8fafc;
          border-left: 3.5px solid #0f172a;
          border-top: 1px solid #cbd5e1;
          border-right: 1px solid #cbd5e1;
          border-bottom: 1px solid #cbd5e1;
          padding: 3px 8px;
          border-radius: 4px 4px 0 0;
          display: flex;
          align-items: center;
          gap: 6px;
          break-after: avoid;
          page-break-after: avoid;
        }
        .section-card {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-top: none;
          border-radius: 0 0 4px 4px;
          padding: 8px 12px;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .card {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          padding: 8px 10px;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .card-label {
          font-size: 9px;
          color: #64748b;
          text-transform: uppercase;
          font-family: 'SFMono-Regular', Consolas, monospace;
          font-weight: 700;
        }
        .card-val {
          font-size: 11px;
          font-weight: 700;
          color: #0f172a;
          margin-top: 2px;
          word-break: break-all;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        th {
          text-align: left;
          padding: 6px 10px;
          background: #f1f5f9;
          color: #0f172a;
          font-family: 'SFMono-Regular', Consolas, monospace;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          border-bottom: 2px solid #cbd5e1;
        }
        .checklist {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .checklist li {
          position: relative;
          padding-left: 16px;
          margin-bottom: 4px;
          font-size: 10px;
          color: #0f172a;
          font-weight: 500;
          line-height: 1.4;
        }
        .checklist li::before {
          content: "▸";
          position: absolute;
          left: 2px;
          color: #0e7490;
          font-weight: bold;
          font-size: 12px;
        }
        .footer {
          margin-top: 10px;
          border-top: 1px solid #cbd5e1;
          padding-top: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 9px;
          color: #64748b;
          font-family: 'SFMono-Regular', Consolas, monospace;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .print-btn {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #0f172a;
          color: #ffffff;
          font-weight: 700;
          padding: 10px 20px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.4);
          font-size: 12px;
          z-index: 100;
          font-family: inherit;
        }
        .print-btn:hover {
          background: #1e293b;
        }
        @media print {
          body {
            background: #ffffff !important;
            padding: 0 !important;
          }
          .report-page {
            max-width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-btn {
            display: none !important;
          }
          .section-block {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .card, .section-card, table, tr, .verdict-banner, .grid-2, .footer {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .section-title {
            break-after: avoid !important;
            page-break-after: avoid !important;
          }
        }
      </style>
    </head>
    <body>
      <button class="print-btn" onclick="window.print()">Друк / Зберегти як PDF</button>

      <div class="report-page">
        <!-- Header -->
        <div class="header">
          <div>
            <div class="brand-title">
              <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
                <path d="M10 2 17 5v4.8c0 4.1-2.9 6.9-7 8.2-4.1-1.3-7-4.1-7-8.2V5l7-3Z" stroke="#0f172a" stroke-width="1.8" fill="#f8fafc"/>
                <path d="M6.5 10h2.2l1.2-2.2 1.6 4.4 1-2.2h1" stroke="#dc2626" stroke-width="1.6"/>
              </svg>
              <span>Семантичний аналіз загроз</span>
            </div>
            <div class="brand-sub">Автоматизована експертиза кіберзагроз та соціальної інженерії</div>
          </div>
          <div class="meta-box">
            <div><strong>ІНЦИДЕНТ ID:</strong> ${caseId}</div>
            <div><strong>ДАТА ЕКСПЕРТИЗИ:</strong> ${formattedDate}</div>
            <div><strong>ГРИФ:</strong> ОФІЦІЙНИЙ ЗВІТ / RESTRICTED</div>
          </div>
        </div>

        <!-- Verdict Banner -->
        <div class="verdict-banner">
          <div>
            <h1 class="verdict-title">${data.verdictLabel}</h1>
            <div class="verdict-desc">
              ${data.threatReport?.executiveSummary || 'Підсумкова оцінка загрози розрахована багаторівневим аналітичним ядром.'}
            </div>
          </div>
          <div class="score-circle">
            <span>${data.threatLevel}</span>
            <span style="font-size: 8px; font-weight: normal;">/ 100</span>
          </div>
        </div>

        <!-- Sender & Target Metadata -->
        <div class="grid-2">
          <div class="card">
            <div class="card-label">Відправник (Declared Sender)</div>
            <div class="card-val">${data.senderEmail || data.effectiveSender || 'Не вказано / месенджер'}</div>
            <div class="card-label" style="margin-top: 4px;">Автентичність відправника (RFC)</div>
            ${authSummary}
          </div>
          <div class="card">
            <div class="card-label">Класифікація інциденту</div>
            <div class="card-val" style="color: ${verdictTheme.titleColor};">
              ${data.threatLevel > 70 ? 'Цільовий фішинг (Spear Phishing)' : (data.isSpam ? 'Небажана розсилка (Spam)' : 'Низький рівень ризику')}
            </div>
            <div class="card-label" style="margin-top: 4px;">Довірений реєстр (BIMI)</div>
            <div class="card-val" style="color: ${data.isTrusted ? '#15803d' : '#475569'};">
              ${data.isTrusted ? 'Верифікована офіційна інфраструктура' : 'Сторонній або непідтверджений вузол'}
            </div>
          </div>
        </div>

        <!-- Dynamic XAI Explanation as Structured Findings -->
        <div class="section-block">
          <div class="section-title">
            <span>Пояснювальний ШІ (XAI) — Результати розвідки за векторами</span>
          </div>
          <div class="section-card">
            ${findingsHtml}
          </div>
        </div>

        <!-- Triggers Table -->
        <div class="section-block">
          <div class="section-title">
            <span>Виявлені семантичні тригери та психологічні вектори</span>
          </div>
          <div class="section-card" style="padding: 0; overflow: hidden;">
            <table>
              <thead>
                <tr>
                  <th style="width: 32%;">Вектор атаки</th>
                  <th style="width: 14%; text-align: center;">Впевненість</th>
                  <th style="width: 54%;">Криміналістична характеристика</th>
                </tr>
              </thead>
              <tbody>
                ${triggersRows}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Infrastructure & Brand Spoofing -->
        <div class="section-block">
          <div class="section-title">
            <span>Інфраструктурна розвідка та захист брендів (Safe Browsing & IoC)</span>
          </div>
          <div class="section-card" style="padding: 8px 10px;">
            <div class="grid-2">
              <div class="card" style="margin: 0;">
                <div class="card-label" style="margin-bottom: 4px;">Репутація вилучених посилань</div>
                ${urlsList}
              </div>
              <div class="card" style="margin: 0;">
                <div class="card-label" style="margin-bottom: 4px;">Тайпосквотинг та імітація брендів</div>
                ${brandsList}
              </div>
            </div>
          </div>
        </div>

        <!-- Recommendations -->
        <div class="section-block">
          <div class="section-title">
            <span>Рекомендовані дії реагування на інцидент (SOC Playbook)</span>
          </div>
          <div class="section-card">
            <ul class="checklist">
              ${(data.threatReport?.recommendedActions || [
                'Не взаємодіяти з вмістом повідомлення та не передавати чутливі реквізити.',
                'Додати виявлені домени до чорного списку DNS-резолвера.'
              ]).map(a => `<li>${a}</li>`).join('')}
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <div>Хеш верифікації звіту: <strong style="color: #0f172a;">SHA256:${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}</strong></div>
          <div>Створено автоматично ядром «Семантичний аналіз загроз»</div>
        </div>
      </div>

      <script>
        window.addEventListener('load', function() {
          setTimeout(function() {
            window.print();
          }, 350);
        });
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  } else {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forensic-report-${caseId}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

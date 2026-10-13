'use client';

import { useMemo } from 'react';
import { CheckCircle } from 'lucide-react';
import { PhishingVector } from '@/core/heuristics';

interface FormattedTextDisplayProps {
  rawText: string;
  senderEmail?: string;
  isTrusted?: boolean;
  vectors: PhishingVector[];
  extractedUrls: string[];
  extractedIps: string[];
  safeBrowsingMatches?: any[];
  selectedVectorId?: string | null;
  onVectorSelect?: (id: string | null) => void;
}

export function FormattedTextDisplay({
  rawText,
  senderEmail,
  isTrusted,
  vectors,
  extractedUrls,
  extractedIps,
  safeBrowsingMatches = [],
  selectedVectorId,
  onVectorSelect
}: FormattedTextDisplayProps) {

  // Очищення тексту від непотрібних заголовків та HTML (більш надійний парсинг)
  const cleanText = useMemo(() => {
    let t = rawText;

    // 1. Спробуємо знайти частину text/html або text/plain за допомогою MIME-заголовків
    const htmlPartMatch = t.match(/Content-Type:\s*text\/html[^]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--[A-Za-z0-9_=+\-]+(?:--)?(?:\r?\n|$)|$)/i);
    const plainPartMatch = t.match(/Content-Type:\s*text\/plain[^]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--[A-Za-z0-9_=+\-]+(?:--)?(?:\r?\n|$)|$)/i);

    let html = '';
    
    if (htmlPartMatch) {
      html = htmlPartMatch[1];
    } else {
      // Фолбек: якщо немає явного MIME, але є <html> чи <body>
      const htmlFallback = t.match(/<html[\s\S]*?<\/html>/i) || t.match(/<body[\s\S]*?<\/body>/i);
      if (htmlFallback) html = htmlFallback[0];
    }

    if (html) {
      // Якщо є HTML (або Quoted-Printable HTML)
      if (html.includes('=')) {
        try {
          let decoded = html.replace(/=\r?\n/g, '');
          decoded = decoded.replace(/=([0-9A-F]{2})/gi, (match, p1) => String.fromCharCode(parseInt(p1, 16)));
          const bytes = new Uint8Array(decoded.length);
          for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
          html = new TextDecoder('utf-8').decode(bytes);
        } catch (e) { }
      }
      t = html;
    } else if (plainPartMatch) {
      // Якщо є тільки plain text частина, беремо її
      t = plainPartMatch[1];
      
      // Декодуємо Base64, якщо вона закодована
      if (/^[A-Za-z0-9+/=\s]+$/.test(t.trim())) {
        try {
          let decoded = atob(t.replace(/\s+/g, ''));
          const bytes = new Uint8Array(decoded.length);
          for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
          t = new TextDecoder('utf-8').decode(bytes);
        } catch (e) {}
      }
    } else {
      // Якщо MIME не знайдено, просто видаляємо всі заголовки
      t = t.replace(/^([a-zA-Z0-9\-]+):\s*[\s\S]*?(?=\n[A-Z][a-zA-Z\-]+:|\n\n|\n--)/gm, '');
      
      // І намагаємось знайти і декодувати Base64 блоки
      t = t.replace(/(?:[A-Za-z0-9+/]{40,}(?:={1,2})?\r?\n?)+/g, (match) => {
        try {
          let decoded = atob(match.replace(/\s+/g, ''));
          const bytes = new Uint8Array(decoded.length);
          for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
          return new TextDecoder('utf-8').decode(bytes);
        } catch (e) {
          return ''; 
        }
      });
    }

    // Тепер у t міститься декодований текст. Очищуємо його:
    
    // 3. Видаляємо CSS, скрипти, коментарі та HEAD ДО того, як видалимо всі HTML теги
    let isHtmlText = html !== '';
    
    t = t.replace(/<!--[\s\S]*?-->/g, ' ');
    t = t.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, ' ');
    t = t.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
    t = t.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
    
    // Використовуємо DOMParser для безпечного видалення прихованих елементів (які дублюють текст)
    if (typeof window !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(t, 'text/html');
        // Знаходимо всі елементи, які мають display: none
        const hiddenElements = doc.querySelectorAll('[style*="display:none"], [style*="display: none"]');
        hiddenElements.forEach(el => el.remove());
        t = doc.body.innerHTML;
        isHtmlText = true;
      } catch (e) {
        console.warn("DOMParser failed", e);
      }
    }

    // Якщо це HTML, правильно обробляємо перенесення рядків
    if (isHtmlText) {
      // Всі реальні перенесення рядка в сирому коді HTML - це просто пробіли для браузера
      t = t.replace(/\r?\n/g, ' ');
      // А от блочні теги перетворюємо на справжні перенесення рядка
      t = t.replace(/<\/?(?:div|p|br|tr|table|h[1-6]|li)[^>]*>/gi, '\n');
    }

    // 4. Видаляємо всі інші HTML теги
    t = t.replace(/<[^>]+>/g, ' ');

    // 5. Декодуємо HTML сутності
    t = t.replace(/&nbsp;/g, ' ')
       .replace(/&copy;/g, '©')
       .replace(/&zwnj;/g, '')
       .replace(/&amp;/g, '&')
       .replace(/&lt;/g, '<')
       .replace(/&gt;/g, '>');

    // 6. Видаляємо технічні межі (boundaries)
    t = t.replace(/--[\w\d]+(?:--)?/g, '');

    // 7. Очищення блоків "Forwarded message" (якщо користувач пересилав лист декілька разів)
    // Використовуємо [\s\S]*? щоб захопити текст на декількох рядках
    t = t.replace(/-+\s*Forwarded message\s*-+[\s\S]*?(?:\bTo\b|\bКому\b):?[^\n]*(?:\n|$)/gi, ' ');

    // 8. Видаляємо пусті рядки і зайві пробіли
    t = t.replace(/[ \t]+/g, ' ');
    t = t.replace(/\n\s*\n\s*\n+/g, '\n\n');
    
    return t.trim();
  }, [rawText]);

  // Підсвітка небезпечних сутностей
  const highlightedNodes = useMemo(() => {
    // Шукаємо ключові слова з векторів (наприклад ті, що в лапках в explanation)
    const triggerWordsToVectorIds = new Map<string, string>();
    vectors.forEach(v => {
      const match = v.explanation.match(/Знайдено: "([^"]+)"/);
      if (match && v.id) {
        match[1].split('", "').forEach(w => triggerWordsToVectorIds.set(w.toLowerCase(), v.id!));
      }
    });

    const maliciousUrls = new Set(safeBrowsingMatches.map(m => m.threat?.url));
    const triggerPhrases = Array.from(triggerWordsToVectorIds.keys()).sort((a, b) => b.length - a.length);

    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Об'єднуємо всі сутності, які потрібно підсвітити (URL, IP, Тригери)
    const allExtractors = [
      ...Array.from(maliciousUrls),
      ...extractedUrls,
      ...extractedIps,
      ...triggerPhrases
    ].map(escapeRegex);

    if (allExtractors.length === 0) {
      return <span>{cleanText}</span>;
    }

    const regex = new RegExp(`(${allExtractors.join('|')})`, 'gi');
    const parts = cleanText.split(regex);
    
    return parts.map((part, i) => {
      if (!part) return null;
      
      const lowerPart = part.toLowerCase();
      
      const isMalicious = maliciousUrls.has(part) || maliciousUrls.has(lowerPart);
      const isIp = extractedIps.includes(part);
      const isUrl = extractedUrls.includes(part) || extractedUrls.includes(lowerPart);
      const matchedVectorId = triggerWordsToVectorIds.get(lowerPart);
      
      if (isMalicious) {
        return <span key={i} style={{ backgroundColor: 'rgba(255,0,0,0.3)', color: '#ff5d5f', padding: '0 4px', borderRadius: '4px', border: '1px solid #ff5d5f' }}>{part}</span>;
      }
      if (isIp) {
        return <span key={i} style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: '0 4px', borderRadius: '4px', textDecoration: 'underline' }}>{part}</span>;
      }
      if (isUrl) {
        return <span key={i} style={{ color: 'var(--fx-cyan)', textDecoration: 'underline' }}>{part}</span>;
      }
      if (matchedVectorId) {
        const isSelected = matchedVectorId === selectedVectorId;
        return (
          <span 
            key={i} 
            onClick={() => onVectorSelect?.(isSelected ? null : matchedVectorId)}
            style={{ 
              backgroundColor: isSelected ? 'rgba(255, 215, 0, 0.6)' : 'rgba(255,165,0,0.3)', 
              color: isSelected ? '#fff' : '#ffd700', 
              padding: '0 4px', 
              borderRadius: '4px',
              cursor: 'pointer',
              boxShadow: isSelected ? '0 0 10px rgba(255, 215, 0, 0.5)' : 'none',
              transition: 'all 0.2s ease-in-out'
            }}
          >
            {part}
          </span>
        );
      }

      return <span key={i}>{part}</span>;
    });

  }, [cleanText, vectors, extractedUrls, extractedIps, safeBrowsingMatches, selectedVectorId, onVectorSelect]);

  return (
    <div style={{
      marginTop: '16px',
      padding: '16px',
      background: 'rgba(0,0,0,0.2)',
      border: '1px solid var(--fx-line)',
      borderRadius: '8px',
      fontFamily: 'var(--fx-mono)',
      fontSize: '13px',
      lineHeight: '1.6',
      maxHeight: '400px',
      overflowY: 'auto',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word'
    }}>
      <div style={{ marginBottom: '16px', borderBottom: '1px solid var(--fx-line)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div><strong>ВІДПРАВНИК:</strong> {senderEmail ? <span style={{ color: 'var(--fx-cyan)' }}>{senderEmail}</span> : 'Не вказано'}</div>
        {isTrusted && (
          <span style={{ 
            backgroundColor: 'rgba(0, 255, 136, 0.15)', 
            color: 'var(--fx-success)', 
            border: '1px solid var(--fx-success)', 
            borderRadius: '4px', 
            padding: '2px 8px', 
            fontSize: '11px', 
            fontWeight: 'bold',
            letterSpacing: '0.5px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>ПЕРЕВІРЕНО (Whitelist / DMARC)</span>
          </span>
        )}
      </div>
      {highlightedNodes}
    </div>
  );
}

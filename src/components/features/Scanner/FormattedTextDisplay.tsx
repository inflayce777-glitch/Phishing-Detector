'use client';

import { useMemo } from 'react';
import { CheckCircle } from 'lucide-react';
import { PhishingVector } from '@/core/heuristics';
import { parseMimeEmail } from '@/lib/emailParser';

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

  // Очищення тексту від непотрібних заголовків та HTML за допомогою універсального MIME-парсера
  const cleanText = useMemo(() => {
    const parsed = parseMimeEmail(rawText, senderEmail);
    return parsed.displayText;
  }, [rawText, senderEmail]);

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
        <div><strong>Відправник:</strong> {senderEmail ? <span style={{ color: 'var(--fx-cyan)' }}>{senderEmail}</span> : 'Не вказано'}</div>
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
            <span>Перевірено (Whitelist / DMARC)</span>
          </span>
        )}
      </div>
      {highlightedNodes}
    </div>
  );
}

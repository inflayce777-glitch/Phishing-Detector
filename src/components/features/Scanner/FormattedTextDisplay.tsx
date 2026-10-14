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
  hoveredVectorId?: string | null;
  onVectorSelect?: (id: string | null) => void;
  onVectorHover?: (id: string | null) => void;
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
  hoveredVectorId,
  onVectorSelect,
  onVectorHover
}: FormattedTextDisplayProps) {

  // Очищення тексту від непотрібних службових заголовків за допомогою MIME-парсера
  const cleanText = useMemo(() => {
    const parsed = parseMimeEmail(rawText, senderEmail);
    return parsed.displayText;
  }, [rawText, senderEmail]);

  // Підсвітка небезпечних сутностей з двосторонньою синхронізацією
  const highlightedNodes = useMemo(() => {
    const triggerWordsToVectorIds = new Map<string, string>();
    const vectorColorMap = new Map<string, string>();

    vectors.forEach(v => {
      if (v.id) {
        if (v.color) vectorColorMap.set(v.id, v.color);
        
        // 1. Пошук слів із explanation: Знайдено: "..."
        const match = v.explanation.match(/Знайдено: "([^"]+)"/);
        if (match) {
          match[1].split('", "').forEach(w => {
            if (w.trim()) triggerWordsToVectorIds.set(w.trim().toLowerCase(), v.id!);
          });
        }

        // 2. Пошук повних речень або фраз із sentences
        if (v.sentences && Array.isArray(v.sentences)) {
          v.sentences.forEach(s => {
            if (s && s.trim().length > 2) {
              triggerWordsToVectorIds.set(s.trim().toLowerCase(), v.id!);
            }
          });
        }
      }
    });

    const maliciousUrls = new Set(safeBrowsingMatches.map(m => m.threat?.url));
    const triggerPhrases = Array.from(triggerWordsToVectorIds.keys()).sort((a, b) => b.length - a.length);

    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Об'єднуємо всі сутності, які потрібно підсвітити (шкідливі посилання, IP, URL, тригери)
    const allExtractors = [
      ...Array.from(maliciousUrls),
      ...extractedUrls,
      ...extractedIps,
      ...triggerPhrases
    ].filter(Boolean).map(escapeRegex);

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
        return (
          <span 
            key={i} 
            style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.25)', 
              color: '#f87171', 
              padding: '1px 5px', 
              borderRadius: '3px', 
              border: '1px solid #ef4444',
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.3)',
              fontWeight: 600
            }}
          >
            {part}
          </span>
        );
      }
      if (isIp) {
        return (
          <span 
            key={i} 
            style={{ 
              backgroundColor: 'rgba(255,255,255,0.08)', 
              padding: '1px 5px', 
              borderRadius: '3px', 
              border: '1px solid rgba(255,255,255,0.2)' 
            }}
          >
            {part}
          </span>
        );
      }
      if (isUrl) {
        return (
          <span 
            key={i} 
            style={{ 
              color: 'var(--fx-cyan)', 
              textDecoration: 'underline',
              textUnderlineOffset: '3px'
            }}
          >
            {part}
          </span>
        );
      }
      if (matchedVectorId) {
        const isSelected = matchedVectorId === selectedVectorId;
        const isHovered = matchedVectorId === hoveredVectorId;
        const vecColor = vectorColorMap.get(matchedVectorId) || '#ffd700';

        return (
          <span 
            key={i} 
            onClick={() => onVectorSelect?.(isSelected ? null : matchedVectorId)}
            onMouseEnter={() => onVectorHover?.(matchedVectorId)}
            onMouseLeave={() => onVectorHover?.(null)}
            title="Клікніть, щоб побачити аналіз цього тригера"
            style={{ 
              backgroundColor: isSelected 
                ? 'rgba(255, 215, 0, 0.35)' 
                : isHovered 
                  ? 'rgba(108, 229, 220, 0.25)' 
                  : 'rgba(245, 158, 11, 0.2)', 
              color: isSelected ? '#ffffff' : isHovered ? 'var(--fx-cyan)' : '#fbbf24', 
              padding: '1px 5px', 
              borderRadius: '3px',
              cursor: 'pointer',
              border: isSelected 
                ? `1px solid ${vecColor}` 
                : isHovered 
                  ? '1px solid var(--fx-cyan)' 
                  : '1px solid rgba(245, 158, 11, 0.4)',
              boxShadow: isSelected 
                ? `0 0 12px ${vecColor}` 
                : isHovered 
                  ? '0 0 10px rgba(108, 229, 220, 0.4)' 
                  : 'none',
              transform: isSelected || isHovered ? 'scale(1.02)' : 'none',
              transition: 'all 0.15s ease-in-out',
              display: 'inline-block'
            }}
          >
            {part}
          </span>
        );
      }

      return <span key={i}>{part}</span>;
    });

  }, [cleanText, vectors, extractedUrls, extractedIps, safeBrowsingMatches, selectedVectorId, hoveredVectorId, onVectorSelect, onVectorHover]);

  return (
    <div style={{
      marginTop: '16px',
      padding: '16px',
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid var(--fx-line)',
      borderRadius: '8px',
      fontFamily: 'var(--fx-mono)',
      fontSize: '13px',
      lineHeight: '1.6',
      maxHeight: '400px',
      overflowY: 'auto',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      backdropFilter: 'blur(6px)'
    }}>
      <div style={{ marginBottom: '16px', borderBottom: '1px solid var(--fx-line)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div><strong>Відправник:</strong> {senderEmail ? <span style={{ color: 'var(--fx-cyan)' }}>{senderEmail}</span> : 'Не вказано'}</div>
        {isTrusted && (
          <span style={{ 
            backgroundColor: 'rgba(16, 185, 129, 0.15)', 
            color: 'var(--fx-green)', 
            border: '1px solid rgba(16, 185, 129, 0.4)', 
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
            <span>Перевірено (білий список / DMARC)</span>
          </span>
        )}
      </div>
      {highlightedNodes}
    </div>
  );
}

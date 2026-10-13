'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useMemo, useEffect } from 'react';

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawText: string;
}

// Функція для декодування quoted-printable та base64 (базова)
function decodeEmailContent(text: string) {
  // 1. Спробуємо знайти частину text/html або text/plain за допомогою MIME-заголовків
  const htmlPartMatch = text.match(/Content-Type:\s*text\/html[^]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--[A-Za-z0-9_=+\-]+(?:--)?(?:\r?\n|$)|$)/i);
  let html = '';
  
  if (htmlPartMatch) {
    html = htmlPartMatch[1];
  } else {
    const htmlMatch = text.match(/<html[\s\S]*?<\/html>/i);
    html = htmlMatch ? htmlMatch[0] : '';
    if (!html) {
        const bodyMatch = text.match(/<body[\s\S]*?<\/body>/i);
        html = bodyMatch ? bodyMatch[0] : '';
    }
  }

  // Якщо HTML все ще немає, спробуємо дістати plain-text
  if (!html) {
    const plainPartMatch = text.match(/Content-Type:\s*text\/plain[^]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--[A-Za-z0-9_=+\-]+(?:--)?(?:\r?\n|$)|$)/i);
    if (plainPartMatch) {
      let t = plainPartMatch[1];
      if (/^[A-Za-z0-9+/=\s]+$/.test(t.trim())) {
        try {
          let decoded = atob(t.replace(/\s+/g, ''));
          const bytes = new Uint8Array(decoded.length);
          for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
          t = new TextDecoder('utf-8').decode(bytes);
        } catch (e) {}
      }
      html = '<div style="padding: 20px; font-family: monospace; white-space: pre-wrap;">' + t + '</div>';
    } else {
      // Якщо зовсім нічого не знайшли
      html = '<div style="padding: 20px; font-family: monospace; white-space: pre-wrap;">' + text + '</div>';
    }
  }

  // Декодуємо Quoted-Printable, якщо він є (символи на кшталт =E2=9C=85 або =\r\n)
  if (html.includes('=')) {
    try {
      // Видаляємо перенесення рядків (=\n)
      let decoded = html.replace(/=\r?\n/g, '');
      // Декодуємо hex
      decoded = decoded.replace(/=([0-9A-F]{2})/gi, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      });
      // Для UTF-8 (дуже грубий варіант - перетворити через escape/decodeURIComponent)
      // Оскільки JS fromCharCode дасть нам байти, нам треба їх зібрати у utf-8.
      const bytes = new Uint8Array(decoded.length);
      for(let i=0; i<decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      const decoder = new TextDecoder('utf-8');
      html = decoder.decode(bytes);
    } catch (e) {
      console.warn("Failed to decode quoted-printable", e);
    }
  }

  // Вирізаємо блок Forwarded message для чистоти (оскільки це часто тест)
  // У Gmail це зазвичай <div dir="ltr" class="gmail_attr">...</div>
  // Або просто шукаємо текст і видаляємо його
  if (typeof window !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Шукаємо gmail_attr, який містить "Forwarded message"
      const attrs = doc.querySelectorAll('.gmail_attr');
      attrs.forEach(attr => {
        if (attr.textContent?.includes('Forwarded message')) {
          attr.remove();
        }
      });
      
      html = doc.body.innerHTML;
    } catch (e) {}
  }
  
  return html;
}

export function EmailPreviewModal({ isOpen, onClose, rawText }: EmailPreviewModalProps) {
  const htmlContent = useMemo(() => decodeEmailContent(rawText), [rawText]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 border border-gray-800 rounded-lg shadow-2xl w-[90vw] max-w-[1200px] h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-950">
              <h3 className="font-mono text-cyan-500 font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                Попередній перегляд повідомлення
              </h3>
              <button 
                onClick={onClose}
                className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden bg-white relative">
              <iframe 
                sandbox="allow-same-origin"
                srcDoc={htmlContent}
                title="Email Preview"
                className="w-full h-full border-none"
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

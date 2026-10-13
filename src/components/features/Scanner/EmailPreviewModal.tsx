'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useMemo, useEffect } from 'react';
import { parseMimeEmail } from '@/lib/emailParser';

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawText: string;
}

function decodeEmailContent(text: string): string {
  const parsed = parseMimeEmail(text);
  
  if (parsed.htmlBody) {
    let html = parsed.htmlBody;
    
    // Clean Gmail forwarded attribution header if present
    if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const attrs = doc.querySelectorAll('.gmail_attr');
        attrs.forEach(attr => {
          if (attr.textContent?.includes('Forwarded message') || attr.textContent?.includes('Переслане')) {
            attr.remove();
          }
        });
        html = doc.body.innerHTML || html;
      } catch {}
    }
    
    return html;
  }
  
  // If only plain text is available, render it cleanly with styling
  const safeText = (parsed.displayText || text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; line-height: 1.6; color: #1a202c; background-color: #ffffff; white-space: pre-wrap; word-break: break-word;">
      ${safeText}
    </div>
  `;
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

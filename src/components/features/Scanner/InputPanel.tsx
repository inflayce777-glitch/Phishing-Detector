'use client';
import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Mail, MessageSquare, Camera, AlertTriangle } from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface InputPanelProps {
  appMode: 'email' | 'messenger';
  setAppMode: (mode: 'email' | 'messenger') => void;
  emailInput: string;
  setEmailInput: (val: string) => void;
  urlInput: string;
  setUrlInput: (val: string) => void;
  inputValue: string;
  setInputValue: (val: string) => void;
  isScanning: boolean;
  isOcrLoading: boolean;
  onCameraClick: () => void;
  onScanClick: () => void;
  isEditing: boolean;
  isComplete: boolean;
  vectors?: any[];
  extractedUrls?: string[];
  extractedIps?: string[];
  safeBrowsingMatches?: any[];
  activeNode?: any | null;
  setActiveNode?: (node: any | null) => void;
  isTrusted?: boolean;
}

import { useState } from 'react';
import { FormattedTextDisplay } from './FormattedTextDisplay';
import { EmailPreviewModal } from './EmailPreviewModal';
import { Eye } from 'lucide-react';

export const InputPanel = ({
  appMode, setAppMode,
  emailInput, setEmailInput,
  urlInput, setUrlInput,
  inputValue, setInputValue,
  isScanning, isOcrLoading,
  onCameraClick, onScanClick,
  isEditing,
  isComplete,
  vectors = [],
  extractedUrls = [],
  extractedIps = [],
  safeBrowsingMatches = [],
  activeNode,
  setActiveNode,
  isTrusted
}: InputPanelProps) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const isRawEmailCode = /Content-Type:|MIME-Version:/i.test(inputValue);
  const hasHtmlContent = /<html|<body|<table|<div|<a href=|multipart\/|boundary=/i.test(inputValue);
  
  const shouldShowPreview = appMode === 'email' && (hasHtmlContent || (isRawEmailCode && /text\/html/i.test(inputValue)));
  
  // Якщо вибрано пошту, але немає email і немає заголовків, додаємо попередження
  const isMissingSenderWarning = appMode === 'email' && !emailInput.trim() && !isRawEmailCode;

  return (
    <Panel 
      title="Вхідні дані"
      headerRight={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button 
            variant={appMode === 'email' ? 'primary' : 'outline'}
            onClick={() => setAppMode('email')}
            disabled={isScanning || (isComplete && !isEditing)}
            style={{ padding: '6px 12px', fontSize: '11px' }}
          >
            <Mail className="w-3.5 h-3.5" /> Пошта
          </Button>
          <Button 
            variant={appMode === 'messenger' ? 'primary' : 'outline'}
            onClick={() => setAppMode('messenger')}
            disabled={isScanning || (isComplete && !isEditing)}
            style={{ padding: '6px 12px', fontSize: '11px' }}
          >
            <MessageSquare className="w-3.5 h-3.5" /> Месенджер
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {isComplete && !isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--fx-cyan)', marginBottom: '4px', letterSpacing: '0.5px' }}>Початковий текст (сирий)</div>
              <Textarea
                value={inputValue}
                readOnly
                disabled
                style={{ minHeight: '120px', fontSize: '12px', opacity: 0.7 }}
              />
            </div>
            
            <div>
              <div style={{ fontSize: '11px', color: 'var(--fx-cyan)', marginBottom: '4px', letterSpacing: '0.5px' }}>Відформатований текст (з підсвіткою)</div>
              {isMissingSenderWarning && (
                <div style={{ padding: '8px', marginBottom: '8px', backgroundColor: 'rgba(255, 127, 80, 0.2)', border: '1px solid #ff7f50', borderRadius: '4px', color: '#ff7f50', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
                  <span>Відправник не вказаний. Для кращої точності перевірки пошти вказуйте сирий код листа (із заголовками Від/Кому).</span>
                </div>
              )}
              <FormattedTextDisplay 
                rawText={inputValue}
                senderEmail={emailInput}
                isTrusted={isTrusted}
                vectors={vectors}
                extractedUrls={extractedUrls}
                extractedIps={extractedIps}
                safeBrowsingMatches={safeBrowsingMatches}
                selectedVectorId={activeNode?.id}
                onVectorSelect={(id) => {
                  if (setActiveNode) {
                     setActiveNode(vectors.find(v => v.id === id) || null);
                  }
                }}
              />
            </div>

            {shouldShowPreview && (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => setIsPreviewOpen(true)}
                  style={{ width: '100%', padding: '12px', borderStyle: 'dashed' }}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Відкрити попередній перегляд повідомлення
                </Button>
                
                <EmailPreviewModal 
                  isOpen={isPreviewOpen} 
                  onClose={() => setIsPreviewOpen(false)} 
                  rawText={inputValue} 
                />
              </>
            )}
          </div>
        ) : (
          <>
            <Input
              placeholder={appMode === 'email' ? "Відправник (Email)" : "Ім'я відправника або номер телефону"}
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              disabled={isScanning}
            />
            <Textarea
              placeholder="Вставте текст підозрілого повідомлення сюди..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isScanning}
              style={{ minHeight: '200px' }}
            />
          </>
        )}
        
        {!isScanning && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
            <Button variant="outline" onClick={onCameraClick} disabled={isOcrLoading || (isComplete && !isEditing)}>
              <Camera className="w-4 h-4" />
              {isOcrLoading ? 'Розпізнавання...' : 'Сканувати скріншот'}
            </Button>
            
            <Button onClick={onScanClick} disabled={!inputValue.trim()}>
              {isEditing ? 'Оновити аналіз' : 'Почати аналіз'}
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
};

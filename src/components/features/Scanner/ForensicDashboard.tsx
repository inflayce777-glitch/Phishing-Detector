'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useMachine } from '@xstate/react';
import { phishingScannerMachine } from '@/machines/phishingScannerMachine';
import ThreatCanvas from '@/components/3d/ThreatCanvas';
import { motion, AnimatePresence } from 'framer-motion';
import { SecurityBootLoader } from '@/components/3d/SecurityBootLoader';
import Tesseract from 'tesseract.js';
import { signOut, useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  Mail, MessageSquare, Camera, ChevronDown, Shield, LogOut, History, Key, 
  ShieldAlert, ShieldCheck, ArrowLeft, CheckCircle, AlertTriangle, XCircle, 
  Building, Calendar, Clock, Globe, Fingerprint, Lock, X, Info, Download,
  ExternalLink, ChevronRight
} from "lucide-react";
import { Header } from '@/components/layout/Header';
import { Container } from '@/components/layout/Container';
import { InputPanel } from '@/components/features/Scanner/InputPanel';
import { GraphPanel } from '@/components/features/Scanner/GraphPanel';
import { VerdictPanel } from '@/components/features/Scanner/VerdictPanel';
import { StatusRow } from '@/components/features/Scanner/StatusRow';
import { SecurityModal } from '@/components/features/Scanner/SecurityModal';
import { OcrUploadModal } from '@/components/features/Scanner/OcrUploadModal';
import { EmailAuthCard } from '@/components/features/Scanner/EmailAuthCard';
import { DomainIntelCard } from '@/components/features/Scanner/DomainIntelCard';
import { UrlInspector } from '@/components/features/Scanner/UrlInspector';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { SmartTooltip } from '@/components/ui/SmartTooltip/SmartTooltip';

function ForensicDashboardContent() {
  const router = useRouter();

  const [state, send] = useMachine(phishingScannerMachine);
  const [inputValue, setInputValue] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [activeNode, setActiveNode] = useState<any | null>(null);
  const [hoveredVectorId, setHoveredVectorId] = useState<string | null>(null);
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const [appMode, setAppMode] = useState<'email' | 'messenger'>('email');
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: session, update } = useSession();
  
  const [safeBrowsingMatches, setSafeBrowsingMatches] = useState<any[]>([]);

  useEffect(() => {
    if (state.value === 'complete_with_xai' && state.context.extractedIndicators) {
      const { urls, ips } = state.context.extractedIndicators;
      if (urls?.length || ips?.length) {
        fetch('/api/safebrowsing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls, ips })
        })
        .then(res => res.json())
        .then(data => {
          if (data.matches) setSafeBrowsingMatches(data.matches);
        })
        .catch(console.error);
      }
    } else if (state.value === 'idle') {
      setSafeBrowsingMatches([]);
    }
  }, [state.value, state.context.extractedIndicators]);
  const [showSecurityModal, setShowSecurityModal] = useState(false);

  const searchParams = useSearchParams();
  const emailId = searchParams.get('emailId');

  useEffect(() => {
    if (emailId && session) {
      fetch(`/api/inbox/${emailId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.email) {
            setAppMode('email');
            setEmailInput(data.email.senderEmail || '');
            setInputValue(data.email.textBody || '');
          }
        });
    }
  }, [emailId, session]);

  const processOcrFile = async (file: File) => {
    setShowUploadModal(false);
    setIsOcrLoading(true);
    try {
      const result = await Tesseract.recognize(file, 'ukr+eng', {
        logger: m => console.log(m)
      });
      setInputValue(result.data.text);
    } catch (err) {
      console.error('OCR Error:', err);
      alert('Помилка розпізнавання тексту.');
    } finally {
      setIsOcrLoading(false);
    }
  };

  const handleScan = () => {
    if (!inputValue.trim() && !emailInput.trim() && !urlInput.trim()) return;
    setActiveNode(null);
    setIsEditing(false);
    send({ type: 'START_SCAN', payload: { text: inputValue, senderEmail: emailInput, linkUrl: urlInput } });
  };

  const isScanning =
    state.value !== 'idle' && state.value !== 'complete_with_xai';
  const isComplete = state.value === 'complete_with_xai';

  const getVerdictLabel = (level: number) => {
    if (level > 70) return 'Критична загроза';
    if (level > 40) return 'Підозріло';
    return 'Безпечно';
  };

  const getVerdictColor = (level: number) => {
    if (level > 70) return 'var(--fx-red)';
    if (level > 40) return 'var(--fx-amber)';
    return 'var(--fx-green)';
  };
  
  const stateLabels: Record<string, string> = {
    idle: 'Очікування',
    tokenizing: 'Токенізація',
    inferencing: 'Робота нейромережі',
    extracting_vectors: 'Вилучення ознак',
    rendering_3d: 'Побудова 3D',
    complete_with_xai: 'Завершено',
  };

  const stateLabel = stateLabels[state.value as string] || state.value;

  const getSpfLabel = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'pass') return 'Пройдено';
    if (s === 'dns_active') return 'Захищено в DNS';
    if (s === 'fail') return 'Невдача';
    if (s === 'softfail') return "М'яка невдача";
    if (s === 'neutral') return 'Нейтрально';
    if (s === 'missing') return 'Відсутній у DNS';
    if (s === 'none') return 'Відсутній';
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Невідомо';
  };

  const getDkimLabel = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'pass') return 'Пройдено';
    if (s === 'dns_active') return 'Декларується';
    if (s === 'fail') return 'Невдача';
    if (s === 'none') return 'Відсутній';
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Невідомо';
  };

  const getDmarcLabel = (alignment: string, status?: string) => {
    const a = (alignment || '').toLowerCase();
    const s = (status || '').toLowerCase();
    if (s === 'dns_active') return 'Активно в DNS';
    if (a === 'aligned' || s === 'pass') return 'Співпадає';
    if (a === 'unaligned' || s === 'fail') return 'Невідповідність';
    if (s === 'missing') return 'Відсутній у DNS';
    if (a === 'unknown') return 'Невідомо';
    if (a === 'none') return 'Відсутній';
    return a ? a.charAt(0).toUpperCase() + a.slice(1) : 'Невідомо';
  };
  
  const vectors = state.context.vectors;
  
  // Calculate Threat Level using Oracle + XAI Verification
  let threatLevel = 0;
  if (state.context.oracleScore !== undefined && state.context.oracleVerdict) {
      const v = String(state.context.oracleVerdict).toLowerCase();
      if (v.includes('fraud') || v.includes('spam') || v.includes('phishing')) {
          threatLevel = Math.round(state.context.oracleScore * 100);
      } else {
          threatLevel = Math.round((1 - state.context.oracleScore) * 100);
      }
      
      // XAI Verification: 
      // The base English-trained ONNX model hallucinates false positives on Cyrillic legitimate texts.
      // Our paragraph-level Pairwise NLI is highly precise. 
      // If it finds 0 triggers, we must override the base model to prevent false positives.
      if (vectors.length === 0) {
          // No manipulative patterns found. Drop the base threat level to safe threshold.
          threatLevel = Math.min(threatLevel, 15);
      }
      
      // Add obfuscation penalty AFTER XAI verification (because obfuscation itself is a hard trigger)
      if (state.context.obfuscation && state.context.obfuscation.score > 0) {
         threatLevel = Math.min(100, threatLevel + Math.round(state.context.obfuscation.score * 100));
      }
  } else {
      const avgScore = vectors.length
        ? vectors.reduce((acc, v) => acc + v.score, 0) / vectors.length
        : 0;
      threatLevel = Math.round(avgScore * 100);
  }

  // ВЕРИФІКАЦІЯ ВІДПРАВНИКА: Якщо відправник перевірений (Google / Whitelist) і немає загроз у глобальних базах чи обфускації, загроза = 0
  if (state.context.isTrusted && safeBrowsingMatches.length === 0 && (!state.context.obfuscation || state.context.obfuscation.score === 0)) {
      threatLevel = 0;
  }

  // КРИТИЧНИЙ ПЕРЕВИЗНАЧНИК: Якщо глобальні репутаційні бази (URLhaus / Google / NXDOMAIN) виявляють підтверджену загрозу
  const hasHardBlacklist = safeBrowsingMatches.some(m => 
    m.threatType.includes('URLhaus') || 
    m.threatType.includes('Safe Browsing') || 
    m.threatType.includes('NXDOMAIN') ||
    m.threatType.includes('MALWARE') ||
    m.threatType.includes('SOCIAL_ENGINEERING')
  );
  const hasMlUrlThreat = safeBrowsingMatches.some(m => m.threatType.includes('ML-ФІШИНГОВИЙ URL'));

  if (hasHardBlacklist) {
      threatLevel = 100;
  } else if (hasMlUrlThreat && !state.context.isTrusted) {
      threatLevel = Math.max(threatLevel, 80);
  }

  const hasForensicIntel = Boolean(
    state.context.emailAuth?.hasHeaders || 
    (state.context.brandResults && state.context.brandResults.length > 0) || 
    (state.context.rdapResults && Object.keys(state.context.rdapResults).length > 0)
  );

  // Save analysis result to Inbox Email if we are scanning an email
  useEffect(() => {
    if (state.value === 'complete_with_xai' && emailId) {
       const isPhish = threatLevel > 70;
       const isSpam = threatLevel > 40 && !isPhish;
       const finalScore = isPhish ? (threatLevel / 100) : (isSpam ? (threatLevel / 100) : ((100 - threatLevel) / 100));
       const finalLabel = isPhish ? 'phishing' : (isSpam ? (state.context.isSpam ? 'spam' : 'suspicious') : 'safe');

       fetch('/api/inbox/analyze', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           emailId,
           oracleScore: finalScore,
           oracleLabel: finalLabel,
           triggers: state.context.vectors
         })
       }).catch(err => console.error("Failed to save analysis to email:", err));
    }
  }, [state.value, state.context.vectors, emailId, threatLevel, state.context.isSpam]);
  const exportForensicReport = () => {
    const reportData = {
      system: 'Cyber Threat Forensic Analyzer 2.0',
      timestamp: new Date().toISOString(),
      verdict: {
        threatLevel,
        label: getVerdictLabel(threatLevel),
        isSpam: Boolean(state.context.isSpam),
        isTrusted: Boolean(state.context.isTrusted)
      },
      sender: {
        providedEmail: emailInput,
        effectiveSender: state.context.senderEmail,
        authentication: state.context.emailAuth
      },
      infrastructure: {
        urls: state.context.extractedIndicators?.urls || [],
        ips: state.context.extractedIndicators?.ips || [],
        safeBrowsingMatches,
        brandImpersonation: state.context.brandResults || [],
        rdapDomainAges: state.context.rdapResults || {}
      },
      heuristics: {
        obfuscation: state.context.obfuscation,
        triggers: vectors.map(v => ({
          trigger: v.trigger,
          score: v.score,
          explanation: v.explanation
        }))
      }
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `forensic-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(downloadUrl);
  };

  const renderHighlightedText = () => {
    if (!activeNode || !activeNode.sentences || activeNode.sentences.length === 0) return inputValue;
    
    try {
      const escapedSentences = activeNode.sentences.map((s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const regex = new RegExp(`(${escapedSentences.join('|')})`, 'i');
      const parts = inputValue.split(regex);
      
      return parts.map((part, i) => 
        regex.test(part) ? (
          <mark key={i} style={{ 
            backgroundColor: `${activeNode.color}30`, 
            color: 'white',
            borderBottom: `2px solid ${activeNode.color}`,
            padding: '2px 4px',
            borderRadius: '2px',
            transition: 'all 0.3s ease'
          }}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      );
    } catch (e) {
      return inputValue;
    }
  };

  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants: any = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1, 
      transition: { type: 'spring', stiffness: 80, damping: 15 } 
    },
  };

  const scanButtonVariants = {
    idle: { scale: 1, boxShadow: '0px 0px 0px rgba(108, 229, 220, 0)' },
    scanning: { 
      scale: [1, 1.02, 1],
      boxShadow: ['0px 0px 0px rgba(108, 229, 220, 0)', '0px 0px 15px rgba(108, 229, 220, 0.4)', '0px 0px 0px rgba(108, 229, 220, 0)'],
      transition: { repeat: Infinity, duration: 1.5 }
    }
  };

  return (
    <>
      <Container className="fx-console">
        <Header>
          {emailId && (
            <button 
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/50 hover:border-cyan-400 px-3 py-1 bg-cyan-950/20 transition-all rounded-sm"
            >
              <ArrowLeft className="w-3 h-3" /> До інбоксу
            </button>
          )}
        </Header>

            <StatusRow
              statusText={state.value === 'inferencing' && state.context.modelProgress ? state.context.modelProgress : stateLabel as string}
              sessionEmail={session?.user?.email || null}
              setShowSecurityModal={setShowSecurityModal}
              onLogout={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                signOut();
              }}
            />

            <section className="fx-grid">
              <InputPanel
                appMode={appMode}
                setAppMode={setAppMode}
                emailInput={emailInput || state.context.senderEmail || ''}
                setEmailInput={setEmailInput}
                urlInput={urlInput}
                setUrlInput={setUrlInput}
                inputValue={inputValue}
                setInputValue={setInputValue}
                isScanning={isScanning}
                isOcrLoading={isOcrLoading}
                onCameraClick={() => setShowUploadModal(true)}
                onScanClick={isComplete && !isEditing ? () => setIsEditing(true) : handleScan}
                isEditing={isEditing}
                isComplete={isComplete}
                vectors={state.context.vectors}
                extractedUrls={state.context.extractedIndicators?.urls}
                extractedIps={state.context.extractedIndicators?.ips}
                safeBrowsingMatches={safeBrowsingMatches}
                activeNode={activeNode}
                setActiveNode={setActiveNode}
                hoveredVectorId={hoveredVectorId}
                setHoveredVectorId={setHoveredVectorId}
                isTrusted={state.context.isTrusted}
              />

              <GraphPanel
                vectors={vectors}
                activeNode={activeNode}
                setActiveNode={setActiveNode}
                threatLevel={threatLevel}
              />
            </section>

            {isComplete && (
              <motion.section 
                className="mt-4 flex flex-col gap-4 w-full min-w-0"
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                style={{ overflow: 'visible' }}
              >
                {/* 1. Головний підсумковий висновок системи (на всю ширину екрана) */}
                <VerdictPanel 
                  threatLevel={threatLevel} 
                  isSpam={state.context.isSpam}
                  breakdown={{
                    mlScore: state.context.oracleScore,
                    emailAuthStatus: state.context.emailAuth?.hasHeaders ? (state.context.emailAuth.isSpoofed ? 'Спуфінг / fail' : 'Верифіковано') : 'Відсутні заголовки',
                    isSpoofed: state.context.emailAuth?.isSpoofed,
                    hasHardBlacklist,
                    hasMlUrlThreat,
                    obfuscationScore: state.context.obfuscation?.score,
                    triggersCount: vectors.length,
                    isTrusted: state.context.isTrusted
                  }}
                  onExportReport={exportForensicReport}
                />

                {/* 2. Критичні системні сповіщення (на всю ширину, якщо активні) */}
                {state.context.isTrusted && safeBrowsingMatches.length === 0 && (
                  <Panel title="Надійний відправник (BIMI / DMARC)" className="border-emerald-500/50">
                    <div style={{ padding: '16px 18px', color: '#b3ffb3', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Домен відправника знаходиться в системному білому списку і лист не містить ознак обфускації. Системне сповіщення верифіковано.</span>
                    </div>
                  </Panel>
                )}

                {state.context.obfuscation && state.context.obfuscation.flags.length > 0 && (
                  <Panel title="Виявлено обфускацію (приховування)" style={{ border: '1px solid var(--fx-red)' }}>
                    <div style={{ padding: '16px 18px', color: '#ffb3b3', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {state.context.obfuscation.flags.map((flag, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                          <span>{flag}</span>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}

                {safeBrowsingMatches.length > 0 && (
                  <Panel 
                    title={hasHardBlacklist ? "Глобальні чорні списки загроз (критично)" : "Репутаційний аналіз посилань та інфраструктури"} 
                    style={{ border: hasHardBlacklist ? '1px solid var(--fx-red)' : '1px solid var(--fx-amber)' }}
                  >
                    <div style={{ padding: '16px 18px', color: '#ffb3b3', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {safeBrowsingMatches.map((match, idx) => {
                        const threatTypes: Record<string, string> = {
                          'MALWARE': 'Шкідливе ПЗ (загроза зараження вірусом)',
                          'SOCIAL_ENGINEERING': 'Соціальна інженерія (фішинг, спроба викрасти паролі чи дані)',
                          'UNWANTED_SOFTWARE': 'Небажане ПЗ (програми, що змінюють налаштування без вашого дозволу)',
                          'POTENTIALLY_HARMFUL_APPLICATION': 'Потенційно небезпечний додаток'
                        };
                        const explanation = threatTypes[match.threatType] || match.threatType;
                        const isHard = match.threatType.includes('URLhaus') || match.threatType.includes('Safe Browsing') || match.threatType.includes('NXDOMAIN');
                        
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <ShieldAlert className={`w-5 h-5 shrink-0 mt-0.5 ${isHard ? 'text-red-500' : 'text-amber-400'}`} />
                            <div>
                               <div style={{ marginBottom: '4px', color: '#ffffff' }}>
                                 Посилання <strong>{match.threat?.url}</strong> {isHard ? 'блокується глобальними базами безпеки:' : 'має попередження аналізатора:'}
                               </div>
                               <div style={{ color: isHard ? 'var(--fx-red)' : '#f39c12', fontWeight: 'bold' }}>
                                 Тип загрози: {explanation}
                               </div>
                               {match.details && (
                                 <div style={{ color: 'var(--fx-muted)', fontSize: '11px', marginTop: '2px' }}>
                                   {match.details}
                                 </div>
                               )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Panel>
                )}

                {/* 3. Поглиблена криміналістична сітка (2 колонки на десктопі, 1 колонка на мобільних) */}
                <div className={`grid grid-cols-1 ${hasForensicIntel ? 'lg:grid-cols-2' : ''} gap-4 items-start min-w-0`}>
                  {/* Ліва колонка: Автентифікація та інфраструктура */}
                  {hasForensicIntel && (
                    <Panel title="Криміналістична розвідка: автентифікація та інфраструктура" className="min-w-0">
                      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12px' }}>
                        <EmailAuthCard emailAuth={state.context.emailAuth} />
                        <DomainIntelCard brandResults={state.context.brandResults} rdapResults={state.context.rdapResults} />
                      </div>
                    </Panel>
                  )}

                  {/* Права колонка: Знайдені тригери та URL-інспектор */}
                  <Panel 
                    title="Знайдені тригери"
                    className="min-w-0"
                    headerRight={
                      <button
                        onClick={exportForensicReport}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-all border border-cyan-500/30 hover:border-cyan-400 bg-cyan-950/20 text-cyan-400 hover:text-cyan-300"
                        title="Завантажити структурований JSON звіт криміналістичного аналізу"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Експорт звіту (JSON)</span>
                      </button>
                    }
                  >
                    <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
                      {/* Список тригерів */}
                      {vectors.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {vectors.map((vec) => {
                            const isActive = activeNode?.id === vec.id;
                            const isHovered = hoveredVectorId === vec.id;

                            return (
                              <motion.span
                                key={vec.id}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onMouseEnter={() => setHoveredVectorId(vec.id)}
                                onMouseLeave={() => setHoveredVectorId(null)}
                                onClick={() => setActiveNode(isActive ? null : vec)}
                                style={{
                                  border: `1px solid ${vec.color}${isActive || isHovered ? 'ff' : '40'}`,
                                  background: `${vec.color}${isActive || isHovered ? '35' : '15'}`,
                                  color: vec.color,
                                  padding: '6px 10px',
                                  fontSize: '10px',
                                  fontFamily: 'var(--fx-mono)',
                                  letterSpacing: '0.05em',
                                  cursor: 'pointer',
                                  borderRadius: '4px',
                                  boxShadow: isActive || isHovered ? `0 0 10px ${vec.color}60` : 'none',
                                  transition: 'all 0.15s ease-in-out',
                                }}
                              >
                                {vec.trigger ? (vec.trigger.charAt(0).toUpperCase() + vec.trigger.slice(1)) : ''} ({(vec.score * 100).toFixed(1)}%)
                              </motion.span>
                            );
                          })}
                        </div>
                      )}

                      {vectors.length === 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', width: '100%', padding: '4px' }}>
                          <div style={{ color: 'var(--fx-green)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Shield className="w-4 h-4 shrink-0" /> <span>Евристичний аналіз: маніпулятивних тригерів чи шкідливого контенту не знайдено</span>
                          </div>
                          <div style={{ color: 'var(--fx-green)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Shield className="w-4 h-4 shrink-0" /> <span>Обфускація: текст кристально чистий (без прихованих символів чи підміни літер)</span>
                          </div>
                          <div style={{ color: 'var(--fx-muted)', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
                            <span style={{ color: 'var(--fx-cyan)' }}>ML-аналітика:</span> Базовий рівень ризику ({threatLevel}%) 
                            {safeBrowsingMatches.length > 0 
                              ? ' встановлено на 100%, оскільки в тексті виявлено шкідливе посилання, занесене до глобальної бази загроз Google Safe Browsing!' 
                              : (threatLevel === 0 
                                  ? ' встановлено завдяки верифікації надійного відправника та відсутності загроз.' 
                                  : ' встановлено нейромережею через відсутність перевірених заголовків відправника (анонімний текст), але оскільки жодних експлойтів чи маніпуляцій не виявлено, повідомлення безпечне для прочитання.')
                            }
                          </div>
                        </div>
                      )}
                      
                      {/* URL X-Ray Inspector & IP addresses */}
                      <UrlInspector
                        urls={state.context.extractedIndicators?.urls}
                        ips={state.context.extractedIndicators?.ips}
                        safeBrowsingMatches={safeBrowsingMatches}
                        rdapResults={state.context.rdapResults}
                        brandResults={state.context.brandResults}
                      />
                    </div>
                  </Panel>
                </div>
              </motion.section>
            )}
        </Container>

      {/* Reusable Modals */}
      <OcrUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onFileSelect={processOcrFile}
        isLoading={isOcrLoading}
      />

      <SecurityModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
      />
    </>
  );
}

export default function ForensicDashboard() {
  const [isBootDone, setIsBootDone] = useState(false);

  return (
    <>
      <AnimatePresence>
        {!isBootDone && (
          <SecurityBootLoader onComplete={() => setIsBootDone(true)} />
        )}
      </AnimatePresence>

      <Suspense fallback={null}>
        <ForensicDashboardContent />
      </Suspense>
    </>
  );
}

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
  ExternalLink, ChevronRight, ChevronsUpDown, Layers
} from "lucide-react";
import { Header } from '@/components/layout/Header';
import { Container } from '@/components/layout/Container';
import { InputPanel } from '@/components/features/Scanner/InputPanel';
import { GraphPanel } from '@/components/features/Scanner/GraphPanel';
import { VerdictPanel } from '@/components/features/Scanner/VerdictPanel';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
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
  const [openSections, setOpenSections] = useState({
    triggers: true,
    links: false,
    auth: false,
  });

  const toggleSection = (key: 'triggers' | 'links' | 'auth') => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAllSections = () => {
    setOpenSections({ triggers: true, links: true, auth: true });
  };

  const collapseAllSections = () => {
    setOpenSections({ triggers: false, links: false, auth: false });
  };

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
    setHoveredVectorId(null);
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

            {/* 1. Вхідні дані (завжди на всю ширину) */}
            <section className="w-full min-w-0">
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
                setIsEditing={setIsEditing}
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
            </section>

            {/* 2. Граф ознак (3D) — розміщений ПІД вхідними даними, на всю ширину */}
            {isComplete && (
              <motion.section
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="mt-4 w-full min-w-0"
              >
                <GraphPanel
                  vectors={vectors}
                  activeNode={activeNode}
                  setActiveNode={setActiveNode}
                  threatLevel={threatLevel}
                />
              </motion.section>
            )}

            {isComplete && (
              <motion.section 
                className="mt-4 flex flex-col gap-4 w-full min-w-0"
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                style={{ overflow: 'visible' }}
              >
                {/* 3. Головний підсумковий висновок системи */}
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

                {/* 4. Критичні системні попередження (якщо активні) */}
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

                {/* 5. Панель керування додатковими секціями криміналістичної розвідки */}
                <div className="flex items-center justify-between pt-2 pb-1 px-1">
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <span className="font-semibold text-zinc-200">Поглиблена розвідка та аналітика:</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={expandAllSections}
                      className="px-2.5 py-1 rounded text-[11px] font-mono text-cyan-400 hover:text-cyan-300 bg-cyan-950/20 hover:bg-cyan-950/40 border border-cyan-500/30 transition-all"
                    >
                      Розгорнути всі
                    </button>
                    <button
                      onClick={collapseAllSections}
                      className="px-2.5 py-1 rounded text-[11px] font-mono text-zinc-400 hover:text-zinc-200 bg-zinc-900/40 hover:bg-zinc-800 border border-zinc-800 transition-all"
                    >
                      Згорнути всі
                    </button>
                  </div>
                </div>

                {/* Секція 1: Семантичні тригери та пояснювальний ШІ (XAI) */}
                <CollapsibleSection
                  title="Знайдені семантичні тригери та XAI-аналітика"
                  icon={<Fingerprint className="w-4 h-4 text-cyan-400" />}
                  isOpen={openSections.triggers}
                  onToggle={() => toggleSection('triggers')}
                  badge={
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950/50 text-cyan-300 border border-cyan-500/40">
                      {vectors.length} {vectors.length === 1 ? 'тригер' : 'тригерів'}
                    </span>
                  }
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
                  <div className="space-y-3.5">
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
                      <div className="flex flex-col gap-2 p-2 rounded bg-emerald-950/20 border border-emerald-500/20">
                        <div className="text-emerald-400 flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 shrink-0" />
                          <span>Евристичний аналіз: маніпулятивних тригерів чи шкідливого контенту не знайдено</span>
                        </div>
                        <div className="text-emerald-400 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 shrink-0" />
                          <span>Обфускація: текст чистий (без прихованих символів чи підміни літер)</span>
                        </div>
                      </div>
                    )}

                    <div className="text-[11px] text-zinc-400 border-t border-zinc-800/80 pt-2.5 font-sans leading-relaxed">
                      <span className="text-cyan-400 font-mono font-semibold">Пояснювальний ШІ (XAI): </span>
                      {threatLevel > 60
                        ? 'Модель виявила високу концентрацію маніпулятивних маркерів (заклик до негайної дії, залякування блокуванням або фінансовий тиск), характерних для цільового фішингу.'
                        : (threatLevel === 0
                            ? 'Повідомлення верифіковано як безпечне: відправник підтверджений, домен не містить репутаційних зауважень, текст не має ознак соціальної інженерії.'
                            : 'Базовий рівень ризику розраховано на основі структури тексту та відсутності криптографічно підписаних поштових заголовків.')}
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Секція 2: Аналіз посилань та репутаційна розвідка (Safe Browsing / RDAP / NXDOMAIN) */}
                <CollapsibleSection
                  title="Аналіз посилань та інфраструктурні загрози (Safe Browsing & IoC)"
                  icon={<Globe className="w-4 h-4 text-cyan-400" />}
                  isOpen={openSections.links}
                  onToggle={() => toggleSection('links')}
                  variant={hasHardBlacklist ? 'danger' : (safeBrowsingMatches.length > 0 ? 'warning' : 'default')}
                  badge={
                    safeBrowsingMatches.length > 0 ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950/60 text-rose-300 border border-rose-500/40">
                        {hasHardBlacklist ? '⛔ Чорний список' : '⚠️ Попередження'} ({safeBrowsingMatches.length})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">
                        ✓ Безпечно
                      </span>
                    )
                  }
                >
                  <div className="space-y-4">
                    {/* Список збігів Safe Browsing / NXDOMAIN (якщо є) */}
                    {safeBrowsingMatches.length > 0 && (
                      <div className="space-y-3 p-3.5 rounded-lg bg-zinc-900/40 border border-rose-500/30">
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
                            <div key={idx} className="flex items-start gap-2.5 text-xs">
                              <ShieldAlert className={`w-4 h-4 shrink-0 mt-0.5 ${isHard ? 'text-rose-400' : 'text-amber-400'}`} />
                              <div>
                                <div className="text-zinc-200">
                                  Посилання <strong className="font-mono text-white break-all">{match.threat?.url}</strong> {isHard ? 'блокується глобальними базами безпеки:' : 'має попередження аналізатора:'}
                                </div>
                                <div className={`font-semibold font-mono text-[11px] mt-0.5 ${isHard ? 'text-rose-400' : 'text-amber-400'}`}>
                                  Тип загрози: {explanation}
                                </div>
                                {match.details && (
                                  <div className="text-zinc-400 text-[11px] mt-0.5">
                                    {match.details}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Детальний інспектор URL */}
                    <UrlInspector
                      urls={state.context.extractedIndicators?.urls}
                      ips={state.context.extractedIndicators?.ips}
                      safeBrowsingMatches={safeBrowsingMatches}
                      rdapResults={state.context.rdapResults}
                      brandResults={state.context.brandResults}
                    />
                  </div>
                </CollapsibleSection>

                {/* Секція 3: Автентичність відправника та захист інфраструктури (SPF / DKIM / DMARC / RDAP) */}
                <CollapsibleSection
                  title="Автентичність відправника та інфраструктура (RFC 7208 / 6376 / 7489)"
                  icon={<Shield className="w-4 h-4 text-cyan-400" />}
                  isOpen={openSections.auth}
                  onToggle={() => toggleSection('auth')}
                  variant={state.context.emailAuth?.isSpoofed ? 'danger' : 'default'}
                  badge={
                    state.context.emailAuth?.hasHeaders ? (
                      state.context.emailAuth.isSpoofed ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950/60 text-rose-300 border border-rose-500/40">
                          ⚠️ Спуфінг відправника
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">
                          ✓ Верифіковано
                        </span>
                      )
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-zinc-400 border border-zinc-800">
                        Без заголовків
                      </span>
                    )
                  }
                >
                  <div className="space-y-4">
                    <EmailAuthCard emailAuth={state.context.emailAuth} />
                    <DomainIntelCard brandResults={state.context.brandResults} rdapResults={state.context.rdapResults} />
                  </div>
                </CollapsibleSection>
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

      <Suspense fallback={<div className="min-h-screen bg-[#0b1013]" />}>
        <ForensicDashboardContent />
      </Suspense>
    </>
  );
}

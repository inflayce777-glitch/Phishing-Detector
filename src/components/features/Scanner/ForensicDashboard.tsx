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
  ExternalLink, ChevronRight, ChevronsUpDown, Layers, SlidersHorizontal,
  FileDown, Sparkles, Activity
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
import { generateThreatExplanation } from '@/core/threatExplainer';
import { generateForensicPdfReport } from '@/core/forensicReport';

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
  
  // Navigation Tabs: 'input_graph' vs 'forensics'
  const [dashboardTab, setDashboardTab] = useState<'input_graph' | 'forensics'>('input_graph');

  const [appMode, setAppMode] = useState<'email' | 'messenger'>('email');
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: session } = useSession();
  
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

  // Tab management: switch to forensics on complete, or back to input on idle
  useEffect(() => {
    if (state.value === 'complete_with_xai') {
      setDashboardTab('forensics');
    } else if (state.value === 'idle') {
      setDashboardTab('input_graph');
    }
  }, [state.value]);

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
    setDashboardTab('input_graph');
    send({ type: 'START_SCAN', payload: { text: inputValue, senderEmail: emailInput, linkUrl: urlInput } });
  };

  const isScanning =
    state.value !== 'idle' && state.value !== 'complete_with_xai';
  const isComplete = state.value === 'complete_with_xai';

  const stateLabels: Record<string, string> = {
    idle: 'Очікування',
    tokenizing: 'Токенізація',
    inferencing: 'Робота нейромережі',
    extracting_vectors: 'Вилучення ознак',
    rendering_3d: 'Побудова 3D',
    complete_with_xai: 'Завершено',
  };

  const stateLabel = stateLabels[state.value as string] || state.value;
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
      
      if (vectors.length === 0) {
          threatLevel = Math.min(threatLevel, 15);
      }
      
      if (state.context.obfuscation && state.context.obfuscation.score > 0) {
         threatLevel = Math.min(100, threatLevel + Math.round(state.context.obfuscation.score * 100));
      }
  } else {
      const avgScore = vectors.length
        ? vectors.reduce((acc, v) => acc + v.score, 0) / vectors.length
        : 0;
      threatLevel = Math.round(avgScore * 100);
  }

  // Sender verification override
  if (state.context.isTrusted && safeBrowsingMatches.length === 0 && (!state.context.obfuscation || state.context.obfuscation.score === 0)) {
      threatLevel = 0;
  }

  // Critical Reputational Overrides
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

  // Dynamic Analytical Explanation Synthesis
  const threatReport = generateThreatExplanation({
    threatLevel,
    vectors,
    emailAuth: state.context.emailAuth || undefined,
    brandResults: state.context.brandResults,
    safeBrowsingMatches,
    rdapResults: state.context.rdapResults,
    obfuscation: state.context.obfuscation,
    isSpam: state.context.isSpam,
    isTrusted: state.context.isTrusted,
    senderEmail: emailInput || state.context.senderEmail,
    hasHardBlacklist,
    hasMlUrlThreat,
  });

  // Auto-log scan to Analytics Database and update Inbox email
  useEffect(() => {
    if (state.value === 'complete_with_xai') {
      const isPhish = threatLevel > 70;
      const isSpam = threatLevel > 40 && !isPhish;
      const finalLabel = isPhish ? 'phishing' : (isSpam ? (state.context.isSpam ? 'spam' : 'suspicious') : 'safe');

      // 1. Log to centralized scan audit log for analytics
      fetch('/api/scan-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threatScore: threatLevel,
          verdictLabel: finalLabel,
          scanType: appMode,
          senderEmail: emailInput || state.context.senderEmail || null,
          targetUrl: urlInput || (state.context.extractedIndicators?.urls?.[0] || null),
          textSnippet: inputValue.slice(0, 280),
          triggers: vectors.map(v => ({ trigger: v.trigger, score: v.score })),
          detectedDomains: (state.context.brandResults || []).map(b => b.candidateDomain).filter(Boolean),
          threatSources: safeBrowsingMatches.map(m => m.threatType),
          authSummary: state.context.emailAuth?.hasHeaders ? (state.context.emailAuth.isSpoofed ? 'FAIL' : 'PASS') : 'NONE',
          hasObfuscation: Boolean(state.context.obfuscation && state.context.obfuscation.score > 0)
        })
      }).catch(err => console.error("Failed to log scan audit:", err));

      // 2. Save analysis to specific inbox email if opened via emailId
      if (emailId) {
        const finalScore = isPhish ? (threatLevel / 100) : (isSpam ? (threatLevel / 100) : ((100 - threatLevel) / 100));
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
    }
  }, [state.value, state.context.vectors, emailId, threatLevel, state.context.isSpam]);

  // Export Executive PDF Forensic Report
  const exportForensicReport = () => {
    generateForensicPdfReport({
      threatLevel,
      verdictLabel: threatReport.verdictLabel,
      isSpam: Boolean(state.context.isSpam),
      isTrusted: Boolean(state.context.isTrusted),
      senderEmail: emailInput || state.context.senderEmail,
      effectiveSender: state.context.senderEmail,
      rawTextPreview: inputValue.slice(0, 300),
      vectors,
      safeBrowsingMatches,
      brandResults: state.context.brandResults || [],
      rdapResults: state.context.rdapResults || {},
      emailAuth: state.context.emailAuth,
      obfuscation: state.context.obfuscation,
      threatReport,
      timestamp: new Date().toISOString()
    });
  };

  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.05,
      },
    },
  };

  return (
    <>
      <Container className="fx-console">
        <Header>
          {emailId && (
            <button 
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/50 hover:border-cyan-400 px-3 py-1 bg-cyan-950/20 transition-all rounded-sm font-mono"
            >
              <ArrowLeft className="w-3 h-3" /> До скриньки
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

        {/* Cyber Dual Navigation Tabs (Input & 3D Graph vs Forensic Report) */}
        <div className="flex items-center justify-between gap-2 p-1.5 my-3 rounded-lg bg-zinc-950/80 border border-zinc-800 font-mono text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setDashboardTab('input_graph')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded transition-all cursor-pointer ${
                dashboardTab === 'input_graph'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-[0_0_12px_rgba(108,229,220,0.2)]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>1. Вхідні дані та 3D-граф</span>
              {isComplete && (
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#6ce5dc]" />
              )}
            </button>

            <button
              onClick={() => isComplete && setDashboardTab('forensics')}
              disabled={!isComplete}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded transition-all ${
                !isComplete
                  ? 'opacity-40 cursor-not-allowed text-zinc-600 border border-transparent'
                  : dashboardTab === 'forensics'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold shadow-[0_0_12px_rgba(255,51,102,0.2)] cursor-pointer'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent cursor-pointer'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>2. Криміналістичні висновки та аналітика</span>
              {isComplete && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  threatLevel > 70 ? 'bg-rose-950 text-rose-300 border border-rose-500/40' :
                  threatLevel > 40 ? 'bg-amber-950 text-amber-300 border border-amber-500/40' :
                  'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                }`}>
                  {threatLevel}/100
                </span>
              )}
            </button>
          </div>
        </div>

        {/* TAB 1: Вхідні дані та 3D-граф */}
        {dashboardTab === 'input_graph' && (
          <motion.div
            key="tab-input-graph"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-4 w-full min-w-0"
          >
            {/* Input Panel */}
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

            {/* Quick Banner to switch to Forensic Report if complete */}
            {isComplete && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/90 border border-cyan-500/30">
                <div className="flex items-center gap-2.5 font-mono text-xs">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span className="text-zinc-300">
                    Аналіз завершено. Сформовано оцінку загрози: <strong className="text-white">{threatLevel}/100</strong> ({threatReport.verdictLabel})
                  </span>
                </div>
                <button
                  onClick={() => setDashboardTab('forensics')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition-all cursor-pointer font-semibold"
                >
                  <span>Переглянути криміналістичний звіт</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* 3D Feature Graph placed directly below input */}
            {isComplete && (
              <motion.section
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="w-full min-w-0"
              >
                <GraphPanel
                  vectors={vectors}
                  activeNode={activeNode}
                  setActiveNode={setActiveNode}
                  threatLevel={threatLevel}
                />
              </motion.section>
            )}
          </motion.div>
        )}

        {/* TAB 2: Криміналістичні висновки та аналітика */}
        {dashboardTab === 'forensics' && isComplete && (
          <motion.div
            key="tab-forensics"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-4 w-full min-w-0"
          >
            {/* Quick switch button back to 3D Graph */}
            <div className="flex items-center justify-start px-1">
              <button
                onClick={() => setDashboardTab('input_graph')}
                className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Повернутися до вхідних даних та 3D-графу</span>
              </button>
            </div>

            {/* Verdict Panel with Factor Decomposition & Explicit Triggers */}
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
              vectors={vectors}
              onExportReport={exportForensicReport}
            />

            {/* Critical Banners */}
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

            {/* Section Controls */}
            <div className="flex items-center justify-between pt-2 pb-1 px-1">
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold text-zinc-200">Поглиблена розвідка та аналітика:</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={expandAllSections}
                  className="px-2.5 py-1 rounded text-[11px] font-mono text-cyan-400 hover:text-cyan-300 bg-cyan-950/20 hover:bg-cyan-950/40 border border-cyan-500/30 transition-all cursor-pointer"
                >
                  Розгорнути всі
                </button>
                <button
                  onClick={collapseAllSections}
                  className="px-2.5 py-1 rounded text-[11px] font-mono text-zinc-400 hover:text-zinc-200 bg-zinc-900/40 hover:bg-zinc-800 border border-zinc-800 transition-all cursor-pointer"
                >
                  Згорнути всі
                </button>
              </div>
            </div>

            {/* Section 1: Semantic Triggers & Dynamic XAI */}
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
            >
              <div className="space-y-3.5">
                {/* Triggers list */}
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

                {/* Structured XAI Findings from ThreatExplainer Engine */}
                <div className="border-t border-zinc-800/80 pt-3 flex flex-col gap-2.5">
                  <div className="flex items-center gap-1.5 text-cyan-400 font-mono font-semibold text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Пояснювальний ШІ (XAI) — Деталізація виявлених факторів загрози:</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {threatReport.findings.map((f) => (
                      <div 
                        key={f.id}
                        className="flex flex-col sm:flex-row sm:items-start gap-2 p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80 text-xs text-zinc-300 font-sans leading-relaxed"
                      >
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold shrink-0 uppercase tracking-wider self-start ${
                          f.severity === 'critical' ? 'bg-rose-950/80 text-rose-300 border border-rose-500/40' :
                          f.severity === 'warning' ? 'bg-amber-950/70 text-amber-300 border border-amber-500/40' :
                          'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {f.category}
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <strong className="text-zinc-100 font-medium">{f.title}</strong>
                          <span className="text-zinc-400 text-[11px] leading-relaxed">{f.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {/* Section 2: Safe Browsing & URLs */}
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

                <UrlInspector
                  urls={state.context.extractedIndicators?.urls}
                  ips={state.context.extractedIndicators?.ips}
                  safeBrowsingMatches={safeBrowsingMatches}
                  rdapResults={state.context.rdapResults}
                  brandResults={state.context.brandResults}
                />
              </div>
            </CollapsibleSection>

            {/* Section 3: Sender Authenticity & RDAP */}
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
          </motion.div>
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

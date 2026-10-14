'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useMachine } from '@xstate/react';
import { phishingScannerMachine } from '@/machines/phishingScannerMachine';
import ThreatCanvas from '@/components/3d/ThreatCanvas';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
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
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { SmartTooltip } from '@/components/ui/SmartTooltip/SmartTooltip';

function BootingCore() {
  const { scene } = useGLTF('/models/data_core.glb');
  const ref = useRef<any>(null);
  const clone = scene.clone();
  
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y += 0.05;
      ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });
  return <primitive ref={ref} object={clone} scale={[1.8, 1.8, 1.8]} />;
}

function ForensicDashboardContent() {
  const router = useRouter();
  const [isAppLoading, setIsAppLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAppLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

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
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  
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
  
  // Security Modal State
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [totpToken, setTotpToken] = useState("");
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState("");
  const is2FAEnabled = (session?.user as any)?.totpEnabled;

  const generateTotp = async () => {
    setSecurityLoading(true);
    try {
      const res = await fetch("/api/totp/setup", { method: "POST" });
      const data = await res.json();
      setQrCode(data.qrCodeUrl);
      setSecret(data.secret);
    } catch (e) {
      setSecurityError("Помилка генерації TOTP");
    }
    setSecurityLoading(false);
  };

  const verifySetup = async () => {
    setSecurityLoading(true);
    setSecurityError("");
    try {
      const res = await fetch("/api/totp/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: totpToken }),
      });
      const data = await res.json();
      if (data.success) {
        await update(); // refresh NextAuth session
        window.location.reload();
      } else {
        setSecurityError(data.error || "Невірний код");
      }
    } catch (e) {
      setSecurityError("Помилка підтвердження");
    }
    setSecurityLoading(false);
  };
  


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
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processOcrFile(file);
  };

  useEffect(() => {
    if (!showUploadModal) return;
    
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            processOcrFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [showUploadModal]);

  const handleScan = () => {
    if (!inputValue.trim() && !emailInput.trim() && !urlInput.trim()) return;
    setActiveNode(null);
    setIsEditing(false);
    send({ type: 'START_SCAN', payload: { text: inputValue, senderEmail: emailInput, linkUrl: urlInput } });
  };

  const loadPreset = (preset: 'bank' | 'ceo' | 'blackmail') => {
    if (preset === 'bank') {
      setEmailInput('security@privat-bank-verify-2024.com');
      setUrlInput('http://192.168.1.10/login');
      setInputValue('Шановний клієнте! Ваша картка була тимчасово заблокована через підозрілу активність. Щоб уникнути штрафу і розблокувати рахунок, терміново перейдіть за посиланням і підтвердіть свої дані.');
    } else if (preset === 'ceo') {
      setEmailInput('director.it.department@gmail.com');
      setUrlInput('');
      setInputValue('Привіт, я зараз на важливій зустрічі і не можу говорити. Дуже термінова справа. Купи, будь ласка, подарункові сертифікати Apple на 1000$ і надішли мені коди. Я поверну гроші завтра.');
    } else if (preset === 'blackmail') {
      setEmailInput('hacker99@anonymous.com');
      setUrlInput('bit.ly/pay-btc-now');
      setInputValue('Я зламав твій комп\'ютер і записав відео через веб-камеру. Якщо не хочеш, щоб твої колеги та сім\'я побачили це, переведи 500 доларів на мій біткоїн гаманець за посиланням.');
    }
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
    if (s === 'fail') return 'Невдача';
    if (s === 'softfail') return "М'яка невдача";
    if (s === 'neutral') return 'Нейтрально';
    if (s === 'none') return 'Відсутній';
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Невідомо';
  };

  const getDkimLabel = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'pass') return 'Пройдено';
    if (s === 'fail') return 'Невдача';
    if (s === 'none') return 'Відсутній';
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Невідомо';
  };

  const getDmarcLabel = (alignment: string) => {
    const a = (alignment || '').toLowerCase();
    if (a === 'aligned') return 'Співпадає';
    if (a === 'unaligned') return 'Невідповідність';
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
      <AnimatePresence>
        {isAppLoading && (
          <motion.div
            key="loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0b1013',
              zIndex: 9999,
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}
            >
              <div style={{ width: '150px', height: '150px' }}>
                <Canvas camera={{ position: [0, 0, 4] }}>
                  <ambientLight intensity={1.5} />
                  <directionalLight position={[5, 5, 5]} intensity={3} />
                  <BootingCore />
                </Canvas>
              </div>
              <div style={{ fontFamily: 'var(--fx-mono)', color: '#6ce5dc', letterSpacing: '0.15em', fontSize: '18px', fontWeight: 'bold' }}>
                Семантичний аналіз загроз
              </div>
              <div style={{ fontFamily: 'var(--fx-mono)', color: 'var(--fx-muted)', letterSpacing: '0.1em', fontSize: '12px' }}>
                Ініціалізація системи...
              </div>
              <motion.div 
                style={{ width: '250px', height: '2px', background: 'rgba(108, 229, 220, 0.2)', overflow: 'hidden', marginTop: '10px' }}
              >
                <motion.div 
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  style={{ width: '50%', height: '100%', background: '#6ce5dc' }}
                />
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isAppLoading && (
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
              showUserDropdown={showUserDropdown}
              setShowUserDropdown={setShowUserDropdown}
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
                className="fx-bottom"
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                style={{ overflow: 'visible' }}
              >
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

                {state.context.isTrusted && safeBrowsingMatches.length === 0 && (
                  <Panel title="Надійний відправник (BIMI / DMARC)" className="border-green-500">
                    <div style={{ padding: '18px', color: '#b3ffb3', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                         <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                         <span>Домен відправника знаходиться в системному білому списку і лист не містить ознак обфускації. Системне сповіщення верифіковано.</span>
                      </div>
                    </div>
                  </Panel>
                )}

                {state.context.obfuscation && state.context.obfuscation.flags.length > 0 && (
                  <Panel title="Виявлено обфускацію (приховування)" style={{ border: '1px solid var(--fx-red)' }}>
                    <div style={{ padding: '18px', color: '#ffb3b3', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                    <div style={{ padding: '18px', color: '#ffb3b3', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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

                {/* Поглиблена криміналістична розвідка (SPF/DKIM/DMARC, Тайпосквотинг, RDAP Вік) */}
                {(state.context.emailAuth?.hasHeaders || (state.context.brandResults && state.context.brandResults.length > 0) || (state.context.rdapResults && Object.keys(state.context.rdapResults).length > 0)) && (
                  <Panel title="Криміналістична розвідка: автентифікація та інфраструктура" style={{ overflow: 'visible' }}>
                    <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12px', overflow: 'visible' }}>
                      
                      {/* 1. Поштова автентифікація */}
                      {state.context.emailAuth?.hasHeaders && (
                        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '4px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'visible' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--fx-cyan)', fontWeight: 600 }}>
                              <Fingerprint className="w-4 h-4 text-cyan-400" />
                              <span>Автентичність відправника (RFC 7208 / 6376 / 7489)</span>
                            </div>
                            <SmartTooltip
                              variant="gray"
                              content={
                                state.context.emailAuth.isSpoofed ? (
                                  <span className="text-red-400 font-medium leading-relaxed block">
                                    Увага! Сервер відправника або цифровий підпис не відповідає заявленому домену. Виявлено ознаки підміни адреси (спуфінгу).
                                  </span>
                                ) : (
                                  <span className="text-emerald-400 font-medium leading-relaxed block">
                                    Лист успішно пройшов комплексну перевірку автентичності. Всі цифрові підписи валідні, ознак підміни (спуфінгу) не виявлено.
                                  </span>
                                )
                              }
                            >
                              <span style={{ 
                                fontSize: '11px', 
                                padding: '3px 10px', 
                                borderRadius: '9999px',
                                background: state.context.emailAuth.isSpoofed ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                                border: `1px solid ${state.context.emailAuth.isSpoofed ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`,
                                color: state.context.emailAuth.isSpoofed ? '#f87171' : '#34d399',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}>
                                {state.context.emailAuth.isSpoofed ? (
                                  <>
                                    <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                                    <span>Виявлено спуфінг</span>
                                  </>
                                ) : (
                                  <>
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Верифіковано</span>
                                  </>
                                )}
                              </span>
                            </SmartTooltip>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                            {/* SPF Badge with SmartTooltip */}
                            <SmartTooltip
                              content={
                                <div>
                                  <div className="font-bold text-cyan-400 mb-1 flex items-center gap-1.5">
                                    <Fingerprint className="w-3.5 h-3.5" />
                                    SPF (Sender Policy Framework)
                                  </div>
                                  <div className="text-gray-300 mb-2 leading-relaxed">
                                    Міжнародний поштовий стандарт (RFC 7208). Перевіряє у DNS-записах домену, чи має сервер-відправник легітимне право надсилати листи від цього імені.
                                  </div>
                                  <div className="text-[10px] text-gray-400 border-t border-gray-800 pt-1 flex justify-between">
                                    <span>Результат: <strong className={state.context.emailAuth.spf.status === 'pass' ? 'text-emerald-400' : 'text-red-400'}>{getSpfLabel(state.context.emailAuth.spf.status)}</strong></span>
                                    <span>RFC 7208</span>
                                  </div>
                                </div>
                              }
                            >
                              <span style={{ 
                                display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '4px',
                                background: state.context.emailAuth.spf.status === 'pass' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                border: `1px solid ${state.context.emailAuth.spf.status === 'pass' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                color: state.context.emailAuth.spf.status === 'pass' ? '#34d399' : '#f87171',
                                fontSize: '11px'
                              }}>
                                {state.context.emailAuth.spf.status === 'pass' ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                                <span>SPF: {getSpfLabel(state.context.emailAuth.spf.status)}</span>
                                <Info className="w-3 h-3 text-cyan-400 opacity-70 hover:opacity-100 transition-opacity" />
                              </span>
                            </SmartTooltip>

                            {/* DKIM Badge with SmartTooltip */}
                            <SmartTooltip
                              content={
                                <div>
                                  <div className="font-bold text-cyan-400 mb-1 flex items-center gap-1.5">
                                    <Fingerprint className="w-3.5 h-3.5" />
                                    DKIM (DomainKeys Identified Mail)
                                  </div>
                                  <div className="text-gray-300 mb-2 leading-relaxed">
                                    Криптографічний цифровий підпис листа (RFC 6376). Гарантує цілісність вмісту і доводить, що лист не був перехоплений або змінений зловмисниками в дорозі.
                                  </div>
                                  <div className="text-[10px] text-gray-400 border-t border-gray-800 pt-1 flex justify-between">
                                    <span>Результат: <strong className={state.context.emailAuth.dkim.status === 'pass' ? 'text-emerald-400' : 'text-red-400'}>{getDkimLabel(state.context.emailAuth.dkim.status)}</strong></span>
                                    <span>RFC 6376</span>
                                  </div>
                                </div>
                              }
                            >
                              <span style={{ 
                                display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '4px',
                                background: state.context.emailAuth.dkim.status === 'pass' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                border: `1px solid ${state.context.emailAuth.dkim.status === 'pass' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                color: state.context.emailAuth.dkim.status === 'pass' ? '#34d399' : '#f87171',
                                fontSize: '11px'
                              }}>
                                {state.context.emailAuth.dkim.status === 'pass' ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                                <span>DKIM: {getDkimLabel(state.context.emailAuth.dkim.status)}</span>
                                <Info className="w-3 h-3 text-cyan-400 opacity-70 hover:opacity-100 transition-opacity" />
                              </span>
                            </SmartTooltip>

                            {/* DMARC Badge with SmartTooltip */}
                            <SmartTooltip
                              content={
                                <div>
                                  <div className="font-bold text-cyan-400 mb-1 flex items-center gap-1.5">
                                    <Fingerprint className="w-3.5 h-3.5" />
                                    DMARC (Domain-based Authentication)
                                  </div>
                                  <div className="text-gray-300 mb-2 leading-relaxed">
                                    Політика поштової відповідності (RFC 7489). Пов'язує SPF і DKIM з адресою у заголовку "From", захищаючи користувачів від фішингової підміни імені відомих брендів.
                                  </div>
                                  <div className="text-[10px] text-gray-400 border-t border-gray-800 pt-1 flex justify-between">
                                    <span>Результат: <strong className={state.context.emailAuth.dmarc.alignment === 'aligned' ? 'text-emerald-400' : 'text-red-400'}>{getDmarcLabel(state.context.emailAuth.dmarc.alignment)}</strong></span>
                                    <span>RFC 7489</span>
                                  </div>
                                </div>
                              }
                            >
                              <span style={{ 
                                display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '4px',
                                background: state.context.emailAuth.dmarc.alignment === 'aligned' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                border: `1px solid ${state.context.emailAuth.dmarc.alignment === 'aligned' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                color: state.context.emailAuth.dmarc.alignment === 'aligned' ? '#34d399' : '#f87171',
                                fontSize: '11px'
                              }}>
                                {state.context.emailAuth.dmarc.alignment === 'aligned' ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                                <span>DMARC: {getDmarcLabel(state.context.emailAuth.dmarc.alignment)}</span>
                                <Info className="w-3 h-3 text-cyan-400 opacity-70 hover:opacity-100 transition-opacity" />
                              </span>
                            </SmartTooltip>
                          </div>

                          {state.context.emailAuth.spoofingReason && (
                            <div style={{ color: '#ff8a8a', fontStyle: 'italic', marginTop: '2px' }}>
                              {state.context.emailAuth.spoofingReason}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 2. Детектор бренд-імперсонації та тайпосквотингу */}
                      {state.context.brandResults && state.context.brandResults.length > 0 && (
                        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '4px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--fx-cyan)', fontWeight: 600 }}>
                            <Building className="w-4 h-4 text-cyan-400" />
                            <span>Ідентифікація брендів та захист від тайпосквотингу</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {state.context.brandResults.map((b: any, bIdx: number) => (
                              <div key={bIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                {b.isImpersonation ? (
                                  <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                )}
                                <div>
                                  <span style={{ color: b.isImpersonation ? '#ff8a8a' : 'var(--fx-green)', fontWeight: 500 }}>
                                    {b.candidateDomain}
                                  </span>
                                  <span style={{ display: 'block', color: 'var(--fx-muted)', fontSize: '11px', marginTop: '1px' }}>
                                    {b.explanation}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 3. RDAP Вік домену (Newly Registered Domains) */}
                      {state.context.rdapResults && Object.keys(state.context.rdapResults).length > 0 && (
                        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '4px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--fx-cyan)', fontWeight: 600 }}>
                            <Globe className="w-4 h-4 text-cyan-400" />
                            <span>Життєвий цикл та вік доменів (ICANN RDAP)</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {Object.entries(state.context.rdapResults).map(([dom, r]: [string, any], rIdx: number) => {
                              const isBad = r.isCritical0Day || r.isNewlyRegistered;
                              return (
                                <div key={rIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                  {isBad ? (
                                    <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                  )}
                                  <div>
                                    <span style={{ color: isBad ? '#f39c12' : 'var(--fx-green)', fontWeight: 500 }}>
                                      {dom} {r.ageDays !== null ? `(вік: ${r.ageDays} днів)` : ''}
                                    </span>
                                    <span style={{ display: 'block', color: 'var(--fx-muted)', fontSize: '11px', marginTop: '1px' }}>
                                      {r.details}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    </div>
                  </Panel>
                )}

                <Panel 
                  title="Знайдені тригери"
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
                  <div
                    style={{
                      padding: '18px',
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
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
                    {vectors.length === 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', width: '100%', padding: '4px' }}>
                        <div style={{ color: 'var(--fx-green)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Shield className="w-4 h-4" /> <span>Евристичний аналіз: маніпулятивних тригерів чи шкідливого контенту не знайдено</span>
                        </div>
                        <div style={{ color: 'var(--fx-green)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Shield className="w-4 h-4" /> <span>Обфускація: текст кристально чистий (без прихованих символів чи підміни літер)</span>
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
                    
                    {/* URL X-Ray Inspector: Інтерактивний інспектор посилань */}
                    {state.context.extractedIndicators?.urls?.length ? (
                      <div style={{ width: '100%', marginTop: vectors.length > 0 ? '16px' : '8px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: vectors.length > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none', paddingTop: vectors.length > 0 ? '16px' : '0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--fx-muted)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Globe className="w-4 h-4 text-cyan-400" /> 
                            <span>Аналіз URL-адрес (DNS, Safe Browsing та ML) — Натисніть на посилання для рентгену:</span>
                          </div>
                          <span style={{ fontSize: '10px', fontFamily: 'var(--fx-mono)', color: 'var(--fx-cyan)' }}>
                            Знайдено: {state.context.extractedIndicators.urls.length}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {state.context.extractedIndicators.urls.map((url, idx) => {
                             const badMatch = safeBrowsingMatches.find(m => m.threat?.url === url || m.threat?.url?.includes(url) || url.includes(m.threat?.url));
                             const isExpanded = expandedUrl === url;

                             // Парсинг частин URL для рентгену
                             let urlObj: URL | null = null;
                             try {
                               urlObj = new URL(url);
                             } catch (e) {
                               // fallback якщо URL відносний
                             }

                             const host = urlObj ? urlObj.hostname : url.replace(/^https?:\/\//i, '').split('/')[0];
                             const rdapInfo = state.context.rdapResults ? state.context.rdapResults[host] : null;
                             const brandMatch = state.context.brandResults?.find((b: any) => b.candidateDomain === host);

                             return (
                                <div 
                                  key={idx} 
                                  style={{ 
                                    background: isExpanded ? 'rgba(108, 229, 220, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                                    border: isExpanded 
                                      ? '1px solid var(--fx-cyan)' 
                                      : badMatch 
                                        ? '1px solid rgba(239, 68, 68, 0.3)' 
                                        : '1px solid rgba(255, 255, 255, 0.06)',
                                    borderRadius: '6px',
                                    padding: '8px 12px',
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  <div 
                                    onClick={() => setExpandedUrl(isExpanded ? null : url)}
                                    style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'space-between',
                                      cursor: 'pointer',
                                      gap: '10px'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                      {badMatch ? (
                                        <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                                      ) : (
                                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                                      )}
                                      <span style={{ 
                                        color: badMatch ? '#f87171' : 'var(--fx-text)', 
                                        fontFamily: 'var(--fx-mono)',
                                        fontSize: '12px',
                                        wordBreak: 'break-all'
                                      }}>
                                        {url}
                                      </span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                      {badMatch ? (
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-red-950/60 border border-red-500/40 text-red-400 font-mono">
                                          Загроза
                                        </span>
                                      ) : (
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 font-mono">
                                          Чистий
                                        </span>
                                      )}
                                      {isExpanded ? (
                                        <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
                                      ) : (
                                        <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                                      )}
                                    </div>
                                  </div>

                                  {/* URL X-Ray Details Panel */}
                                  <AnimatePresence>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        style={{ overflow: 'hidden' }}
                                      >
                                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '11px', fontFamily: 'var(--fx-mono)' }}>
                                          <div>
                                            <span style={{ color: 'var(--fx-muted)', display: 'block', marginBottom: '2px' }}>Хост / протокол:</span>
                                            <span style={{ color: 'var(--fx-cyan)' }}>{urlObj ? `${urlObj.protocol}//${urlObj.hostname}` : host}</span>
                                          </div>

                                          {urlObj && urlObj.pathname && urlObj.pathname !== '/' && (
                                            <div>
                                              <span style={{ color: 'var(--fx-muted)', display: 'block', marginBottom: '2px' }}>Шлях (Path):</span>
                                              <span style={{ color: '#ffffff' }}>{urlObj.pathname}</span>
                                            </div>
                                          )}

                                          {urlObj && urlObj.search && (
                                            <div>
                                              <span style={{ color: 'var(--fx-muted)', display: 'block', marginBottom: '2px' }}>Параметри запиту:</span>
                                              <span style={{ color: '#f59e0b', wordBreak: 'break-all' }}>{urlObj.search}</span>
                                            </div>
                                          )}

                                          {rdapInfo && (
                                            <div>
                                              <span style={{ color: 'var(--fx-muted)', display: 'block', marginBottom: '2px' }}>Вік домену (ICANN RDAP):</span>
                                              <span style={{ color: (rdapInfo.isCritical0Day || rdapInfo.isNewlyRegistered) ? '#f59e0b' : 'var(--fx-green)' }}>
                                                {rdapInfo.ageDays !== null ? `${rdapInfo.ageDays} днів` : 'Невідомо'} ({rdapInfo.registrar || 'Реєстратор не вказаний'})
                                              </span>
                                            </div>
                                          )}

                                          {brandMatch && (
                                            <div>
                                              <span style={{ color: 'var(--fx-muted)', display: 'block', marginBottom: '2px' }}>Захист брендів:</span>
                                              <span style={{ color: brandMatch.isImpersonation ? 'var(--fx-red)' : 'var(--fx-green)' }}>
                                                {brandMatch.isImpersonation ? `Підміна: ${brandMatch.targetBrand?.name}` : 'Легітимний ресурс'}
                                              </span>
                                            </div>
                                          )}

                                          {badMatch && (
                                            <div style={{ gridColumn: '1 / -1' }}>
                                              <span style={{ color: 'var(--fx-red)', display: 'block', marginBottom: '2px' }}>Запис у базі загроз:</span>
                                              <span style={{ color: '#f87171' }}>{badMatch.threatType}: {badMatch.details || 'Шкідливий сайт'}</span>
                                            </div>
                                          )}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                             );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {state.context.extractedIndicators?.ips?.length ? (
                      <div style={{ width: '100%', marginTop: '12px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--fx-muted)' }}>
                          <Shield className="w-4 h-4" /> <span>Перевірені IP-адреси (AbuseIPDB):</span>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '24px', listStyleType: 'none', color: 'var(--fx-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {state.context.extractedIndicators.ips.map((ip, idx) => (
                             <li key={idx} style={{ color: 'var(--fx-green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                               <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                               <span>{ip}</span>
                             </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </Panel>
              </motion.section>
            )}
        </Container>
      )}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(11, 16, 19, 0.9)',
              backdropFilter: 'blur(10px)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
            onClick={() => setShowUploadModal(false)}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files?.[0];
              if (file && file.type.startsWith('image/')) processOcrFile(file);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '600px',
                height: '400px',
                border: '2px dashed var(--fx-cyan)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(108, 229, 220, 0.05)',
                cursor: 'pointer',
                position: 'relative'
              }}
            >
              <Camera size={64} className="mb-5 text-cyan-400" />
              <h2 style={{ color: 'var(--fx-text)', fontFamily: 'var(--fx-mono)', marginBottom: '10px' }}>
                Перетягніть зображення сюди
              </h2>
              <p style={{ color: 'var(--fx-muted)', marginBottom: '30px', textAlign: 'center' }}>
                або натисніть <strong style={{color: 'var(--fx-cyan)'}}>Ctrl + V</strong> щоб вставити з буфера обміну<br/>
                або натисніть тут, щоб вибрати файл
              </p>
              
              <button 
                className="fx-btn" 
                onClick={() => fileInputRef.current?.click()}
                style={{ background: 'var(--fx-cyan)', color: '#000' }}
              >
                Обрати файл
              </button>
              
              <button
                onClick={() => setShowUploadModal(false)}
                style={{
                  position: 'absolute',
                  top: '15px',
                  right: '15px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--fx-muted)',
                  fontSize: '24px',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
              
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleImageUpload} 
              />
            </motion.div>
          </motion.div>
        )}

        {showSecurityModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono"
            onClick={() => setShowSecurityModal(false)}
          >
            <motion.div 
              initial={{ y: 50, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 border border-cyan-500/30 rounded-lg p-6 shadow-2xl w-full max-w-xl"
            >
              <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-cyan-500" />
                  Двофакторна автентифікація (2FA)
                </h2>
                <button onClick={() => setShowSecurityModal(false)} className="text-gray-500 hover:text-white transition-colors" aria-label="Закрити">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="mb-6 p-4 rounded bg-gray-950 border border-gray-800 flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500 mb-1">Поточний статус</div>
                  <div className="flex items-center gap-2">
                    {is2FAEnabled ? (
                      <><Shield className="w-5 h-5 text-emerald-500" /> <span className="text-emerald-500 font-bold">Увімкнено</span></>
                    ) : (
                      <><ShieldAlert className="w-5 h-5 text-red-500" /> <span className="text-red-500 font-bold">Вимкнено</span></>
                    )}
                  </div>
                </div>
                {!is2FAEnabled && !qrCode && (
                  <button 
                    onClick={generateTotp}
                    disabled={securityLoading}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded text-sm font-semibold transition"
                  >
                    {securityLoading ? "Генерація..." : "Підключити Google Authenticator"}
                  </button>
                )}
              </div>

              {qrCode && !is2FAEnabled && (
                <div className="p-6 border border-cyan-500/30 bg-cyan-950/10 rounded">
                  <h3 className="text-white font-semibold mb-4 text-sm">Крок 1: Відскануйте QR-код</h3>
                  <p className="text-xs text-gray-400 mb-4">
                    Відкрийте додаток Google Authenticator на вашому телефоні та відскануйте цей код.
                  </p>
                  
                  <div className="flex justify-center mb-6">
                    <div className="bg-white p-2 rounded">
                      <img src={qrCode} alt="TOTP QR" width={180} height={180} />
                    </div>
                  </div>

                  <h3 className="text-white font-semibold mb-4 text-sm">Крок 2: Введіть код підтвердження</h3>
                  <div className="flex gap-2 mb-2">
                    <input 
                      type="text" 
                      value={totpToken}
                      onChange={e => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && totpToken.length === 6 && !securityLoading) {
                          e.preventDefault();
                          verifySetup();
                        }
                      }}
                      placeholder="000000"
                      className="bg-gray-950 border border-gray-700 text-white px-4 py-2 rounded flex-1 text-center text-xl tracking-[0.5em] outline-none focus:border-cyan-500"
                    />
                    <button 
                      onClick={verifySetup}
                      disabled={securityLoading || totpToken.length !== 6}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-6 py-2 rounded font-semibold transition"
                    >
                      Підтвердити
                    </button>
                  </div>
                  {securityError && <p className="text-red-500 text-sm mt-2 text-center">{securityError}</p>}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function ForensicDashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 text-cyan-500 flex items-center justify-center font-mono animate-pulse">Завантаження...</div>}>
      <ForensicDashboardContent />
    </Suspense>
  );
}

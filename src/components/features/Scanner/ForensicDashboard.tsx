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
  Building, Calendar, Clock, Globe, Fingerprint, Lock, X, Info 
} from "lucide-react";
import { Header } from '@/components/layout/Header';
import { Container } from '@/components/layout/Container';
import { InputPanel } from '@/components/features/Scanner/InputPanel';
import { GraphPanel } from '@/components/features/Scanner/GraphPanel';
import { VerdictPanel } from '@/components/features/Scanner/VerdictPanel';
import { StatusRow } from '@/components/features/Scanner/StatusRow';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';

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

  // Save analysis result to Inbox Email if we are scanning an email
  useEffect(() => {
    if (state.value === 'complete_with_xai' && emailId) {
       fetch('/api/inbox/analyze', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           emailId,
           oracleScore: state.context.oracleScore || 0,
           oracleLabel: state.context.oracleVerdict || 'safe',
           triggers: state.context.vectors
         })
       }).catch(err => console.error("Failed to save analysis to email:", err));
    }
  }, [state.value, state.context.vectors, emailId]);

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

  // ВЕРИФІКАЦІЯ ВІДПРАВНИКА: Якщо відправник перевірений (Google / Whitelist) і немає загроз у SafeBrowsing чи обфускації, загроза = 0
  if (state.context.isTrusted && safeBrowsingMatches.length === 0 && (!state.context.obfuscation || state.context.obfuscation.score === 0)) {
      threatLevel = 0;
  }

  // КРИТИЧНИЙ ПЕРЕВИЗНАЧНИК: Якщо Safe Browsing знаходить загрозу, ризик миттєво 100%
  if (safeBrowsingMatches.length > 0) {
      threatLevel = 100;
  }

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
                  <ArrowLeft className="w-3 h-3" /> В Інбокс
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
              >
                <VerdictPanel threatLevel={threatLevel} isSpam={state.context.isSpam} />

                {state.context.isTrusted && safeBrowsingMatches.length === 0 && (
                  <Panel title="Надійний відправник (BIMI / DMARC)" className="border-green-500">
                    <div style={{ padding: '18px', color: '#b3ffb3', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                         <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                         <span>Домен відправника знаходиться в системному White-List і лист не містить ознак обфускації. Системне сповіщення верифіковано.</span>
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
                  <Panel title="Google Safe Browsing: Критична загроза!" style={{ border: '1px solid var(--fx-red)' }}>
                    <div style={{ padding: '18px', color: '#ffb3b3', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {safeBrowsingMatches.map((match, idx) => {
                        const threatTypes: Record<string, string> = {
                          'MALWARE': 'Шкідливе ПЗ (Загроза зараження вірусом)',
                          'SOCIAL_ENGINEERING': 'Соціальна Інженерія (Фішинг, спроба вкрасти паролі чи дані)',
                          'UNWANTED_SOFTWARE': 'Небажане ПЗ (Програми, що змінюють налаштування без вашого дозволу)',
                          'POTENTIALLY_HARMFUL_APPLICATION': 'Потенційно Небезпечний Додаток'
                        };
                        const explanation = threatTypes[match.threatType] || match.threatType;
                        
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <div>
                               <div style={{ marginBottom: '4px' }}>Посилання <strong>{match.threat?.url}</strong> блокується глобальною базою Google!</div>
                               <div style={{ color: 'var(--fx-red)', fontWeight: 'bold' }}>Тип загрози: {explanation}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Panel>
                )}

                {/* Поглиблена криміналістична розвідка (SPF/DKIM/DMARC, Тайпосквотинг, RDAP Вік) */}
                {(state.context.emailAuth?.hasHeaders || (state.context.brandResults && state.context.brandResults.length > 0) || (state.context.rdapResults && Object.keys(state.context.rdapResults).length > 0)) && (
                  <Panel title="Криміналістична Розвідка: Автентифікація & Інфраструктура">
                    <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12px' }}>
                      
                      {/* 1. Поштова автентифікація */}
                      {state.context.emailAuth?.hasHeaders && (
                        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '4px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--fx-cyan)', fontWeight: 600 }}>
                              <Fingerprint className="w-4 h-4 text-cyan-400" />
                              <span>Автентичність відправника (RFC 7208 / 6376 / 7489)</span>
                            </div>
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
                          </div>

                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                            <div 
                              className="group relative cursor-help"
                              title="SPF (Sender Policy Framework) — захисний протокол, який перевіряє, чи дозволено поштовому серверу відправляти листи від імені цього домену."
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
                                <Info className="w-3 h-3 text-gray-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                              </span>
                            </div>

                            <div 
                              className="group relative cursor-help"
                              title="DKIM (DomainKeys Identified Mail) — цифровий криптографічний підпис відправника, що гарантує цілісність листа під час доставки."
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
                                <Info className="w-3 h-3 text-gray-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                              </span>
                            </div>

                            <div 
                              className="group relative cursor-help"
                              title="DMARC (Domain-based Message Authentication) — політика захисту від підробки адреси, яка вказує провайдерам, як обробляти листи з підозрілим SPF/DKIM."
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
                                <Info className="w-3 h-3 text-gray-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                              </span>
                            </div>
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
                                      {dom} {r.ageDays !== null ? `(Вік: ${r.ageDays} днів)` : ''}
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

                <Panel title="Знайдені тригери">
                  <div
                    style={{
                      padding: '18px',
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    {vectors.map((vec) => (
                      <motion.span
                        key={vec.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setActiveNode(activeNode?.id === vec.id ? null : vec)}
                        style={{
                          border: `1px solid ${vec.color}${activeNode?.id === vec.id ? 'ff' : '40'}`,
                          background: `${vec.color}${activeNode?.id === vec.id ? '30' : '15'}`,
                          color: vec.color,
                          padding: '6px 10px',
                          fontSize: '10px',
                          fontFamily: 'var(--fx-mono)',
                          letterSpacing: '0.05em',
                          cursor: 'pointer',
                          transition: 'background 0.2s, border 0.2s',
                        }}
                      >
                        {vec.trigger ? (vec.trigger.charAt(0).toUpperCase() + vec.trigger.slice(1)) : ''} ({(vec.score * 100).toFixed(1)}%)
                      </motion.span>
                    ))}
                    {vectors.length === 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', width: '100%', padding: '4px' }}>
                        <div style={{ color: 'var(--fx-green)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Shield className="w-4 h-4" /> <span>Евристичний аналіз: Маніпулятивних тригерів чи шкідливого контенту не знайдено</span>
                        </div>
                        <div style={{ color: 'var(--fx-green)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Shield className="w-4 h-4" /> <span>Обфускація: Текст кристально чистий (без прихованих символів чи підміни літер)</span>
                        </div>
                        <div style={{ color: 'var(--fx-muted)', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
                          <span style={{ color: 'var(--fx-cyan)' }}>ML-Аналітика:</span> Базовий рівень ризику ({threatLevel}%) 
                          {safeBrowsingMatches.length > 0 
                            ? ' встановлено на 100%, оскільки в тексті виявлено шкідливе посилання, занесене до глобальної бази загроз Google Safe Browsing!' 
                            : (threatLevel === 0 
                                ? ' встановлено завдяки верифікації надійного відправника та відсутності загроз.' 
                                : ' встановлено нейромережею через відсутність перевірених заголовків відправника (анонімний текст), але оскільки жодних експлойтів чи маніпуляцій не виявлено, повідомлення безпечне для прочитання.')
                          }
                        </div>
                      </div>
                    )}
                    
                    {/* Завжди показуємо перевірені URL та IP */}
                    {state.context.extractedIndicators?.urls?.length ? (
                      <div style={{ width: '100%', marginTop: vectors.length > 0 ? '16px' : '8px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: vectors.length > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none', paddingTop: vectors.length > 0 ? '16px' : '0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--fx-muted)' }}>
                          <Shield className="w-4 h-4" /> <span>Аналіз URL-адрес (DNS & Safe Browsing & ML):</span>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '24px', listStyleType: 'none', color: 'var(--fx-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {state.context.extractedIndicators.urls.map((url, idx) => {
                             const badMatch = safeBrowsingMatches.find(m => m.threat?.url === url || m.threat?.url?.includes(url) || url.includes(m.threat?.url));
                             return (
                                <li key={idx} style={{ color: badMatch ? '#ff5d5f' : 'var(--fx-green)', display: 'flex', alignItems: 'flex-start', gap: '8px', wordBreak: 'break-all' }}>
                                  <span style={{ marginTop: '2px' }}>
                                    {badMatch ? (
                                      <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                                    ) : (
                                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                                    )}
                                  </span>
                                  <div>
                                    <span>{url}</span>
                                    {badMatch && (
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#ff8a8a', fontStyle: 'italic', marginTop: '2px' }}>
                                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                        <span>{badMatch.threatType}: {badMatch.details || 'Підозрілий або неіснуючий ресурс'}</span>
                                      </span>
                                    )}
                                  </div>
                                </li>
                             );
                          })}
                        </ul>
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

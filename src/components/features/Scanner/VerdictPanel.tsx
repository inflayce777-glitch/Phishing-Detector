'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Panel } from '@/components/ui/Panel';
import { 
  ShieldAlert, ShieldCheck, Cpu, Globe, Fingerprint, 
  ChevronDown, ChevronUp, Info, AlertTriangle, Layers,
  FileDown, Printer
} from 'lucide-react';
import styles from './VerdictPanel.module.scss';
import { PhishingVector } from '@/core/heuristics';

export interface VerdictBreakdown {
  mlScore?: number;
  emailAuthStatus?: string;
  isSpoofed?: boolean;
  hasHardBlacklist?: boolean;
  hasMlUrlThreat?: boolean;
  obfuscationScore?: number;
  triggersCount?: number;
  isTrusted?: boolean;
}

interface VerdictPanelProps {
  threatLevel: number;
  isSpam?: boolean;
  breakdown?: VerdictBreakdown;
  vectors?: PhishingVector[];
  onExportReport?: () => void;
}

export const VerdictPanel = ({ 
  threatLevel, 
  isSpam, 
  breakdown,
  vectors = [],
  onExportReport 
}: VerdictPanelProps) => {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const getVerdictLabel = (level: number) => {
    if (level > 70) return 'Критична загроза';
    if (level > 40) return isSpam ? 'Підозріло (спам)' : 'Підозріло';
    return 'Безпечно';
  };

  const getVerdictColor = (level: number) => {
    if (level > 70) return 'var(--fx-red)';
    if (level > 40) return isSpam ? '#f39c12' : 'var(--fx-amber)';
    return 'var(--fx-green)';
  };

  const getVerdictDesc = (level: number) => {
    if (level > 70) {
      return 'Виявлено критичні ознаки фішингу, підміни відправника або шкідливого програмного забезпечення. Не переходьте за посиланнями та не передавайте конфіденційні дані.';
    }
    if (level > 40) {
      return isSpam 
        ? 'Повідомлення ідентифіковано як рекламну розсилку або спам-кампанію. Прямої деструктивної загрози немає, але контент є небажаним.'
        : 'Повідомлення містить маніпулятивні патерни або неперевірені посилання. Рекомендується підвищена обережність.';
    }
    return 'Повідомлення успішно пройшло перевірку цифрових підписів, репутаційних баз та семантичного ядра. Загроз не виявлено.';
  };

  return (
    <Panel 
      title="Висновок"
      headerRight={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {onExportReport && (
            <button
              onClick={onExportReport}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-all border border-cyan-500/40 hover:border-cyan-300 bg-cyan-950/30 hover:bg-cyan-950/60 text-cyan-300 hover:text-white"
              title="Сформувати офіційний криміналістичний PDF-звіт"
            >
              <FileDown className="w-3.5 h-3.5 text-cyan-400" />
              <span>Експорт звіту (PDF)</span>
            </button>
          )}

          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-all border border-cyan-500/30 hover:border-cyan-400 bg-cyan-950/20 text-cyan-400 hover:text-cyan-300"
            style={{ cursor: 'pointer' }}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{showBreakdown ? 'Приховати деталізацію' : 'Деталізація ризику'}</span>
            {showBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className={styles.verdictBody}>
          <div className={styles.scorebox}>
            <div 
              className={`${styles.scoreRing} ${threatLevel < 40 ? styles.safe : ''}`}
              style={{
                borderColor: getVerdictColor(threatLevel),
                boxShadow: `0 0 24px ${threatLevel > 70 ? 'rgba(255, 51, 102, 0.3)' : threatLevel > 40 ? 'rgba(243, 156, 18, 0.3)' : 'rgba(0, 255, 136, 0.25)'}`
              }}
            >
              <span 
                className={`${styles.scoreNum} ${threatLevel < 40 ? styles.safe : ''}`}
                style={{ color: getVerdictColor(threatLevel) }}
              >
                {threatLevel}
              </span>
            </div>
            <span className={styles.scoreSub}>Ризик / 100</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h3
                style={{
                  color: getVerdictColor(threatLevel),
                  fontWeight: 700,
                  fontSize: '18px',
                  letterSpacing: '0.02em',
                  margin: 0,
                }}
              >
                {getVerdictLabel(threatLevel)}
              </h3>

              {threatLevel > 40 && threatLevel <= 70 && isSpam && (
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--fx-mono)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(243, 156, 18, 0.15)',
                    border: '1px solid rgba(243, 156, 18, 0.4)',
                    color: '#f39c12',
                  }}
                >
                  Масова розсилка / спам
                </span>
              )}

              {breakdown?.isTrusted && (
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--fx-mono)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    color: '#34d399',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Довірена інфраструктура
                </span>
              )}
            </div>

            <p style={{ margin: 0, color: 'var(--fx-muted)', fontSize: '13px', lineHeight: '1.5', wordBreak: 'break-word' }}>
              {getVerdictDesc(threatLevel)}
            </p>
          </div>
        </div>

        {/* Interactive Risk Decomposition Drawer */}
        <AnimatePresence>
          {showBreakdown && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div 
                style={{ 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  border: '1px solid rgba(108, 229, 220, 0.15)', 
                  borderRadius: '6px', 
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--fx-cyan)', fontSize: '12px', fontWeight: 600 }}>
                    <Info className="w-4 h-4 text-cyan-400" />
                    <span>Факторна декомпозиція оцінки загрози</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--fx-muted)', fontFamily: 'var(--fx-mono)' }}>
                    Підсумковий скор: {threatLevel}/100
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs font-mono">
                  {/* Factor 1: Email Auth */}
                  <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between gap-1.5 min-w-0 transition-all hover:border-cyan-500/30">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Fingerprint className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="font-medium text-xs text-zinc-300 truncate">Автентичність</span>
                    </div>
                    <div className="font-semibold text-sm truncate" style={{ color: breakdown?.isSpoofed ? 'var(--fx-red)' : 'var(--fx-green)' }}>
                      {breakdown?.isSpoofed ? 'Спуфінг / fail' : breakdown?.emailAuthStatus || 'Верифіковано'}
                    </div>
                    <div className="text-[11px] text-zinc-500 leading-snug break-words">
                      {breakdown?.isSpoofed ? 'Провал перевірки SPF/DKIM' : 'Цифрові підписи валідні'}
                    </div>
                  </div>

                  {/* Factor 2: NLP Core */}
                  <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between gap-1.5 min-w-0 transition-all hover:border-purple-500/30">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
                      <span className="font-medium text-xs text-zinc-300 truncate">NLP ядро</span>
                    </div>
                    <div className="font-semibold text-sm text-white truncate">
                      {breakdown?.mlScore !== undefined ? `${(breakdown.mlScore * 100).toFixed(1)}%` : '0%'}
                    </div>
                    <div className="text-[11px] text-zinc-500 leading-snug break-words">
                      Семантичний скоринг тексту
                    </div>
                  </div>

                  {/* Factor 3: URL & Infrastructure (Clarified Blacklist wording) */}
                  <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between gap-1.5 min-w-0 transition-all hover:border-emerald-500/30">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-medium text-xs text-zinc-300 truncate">Репутація URL</span>
                    </div>
                    <div className="font-semibold text-sm truncate" style={{ color: breakdown?.hasHardBlacklist ? 'var(--fx-red)' : breakdown?.hasMlUrlThreat ? '#f39c12' : 'var(--fx-green)' }}>
                      {breakdown?.hasHardBlacklist ? 'Чорний список' : breakdown?.hasMlUrlThreat ? 'ML-підозра' : 'Чисті'}
                    </div>
                    <div className="text-[11px] text-zinc-500 leading-snug break-words">
                      {breakdown?.hasHardBlacklist 
                        ? 'Виявлено в глобальних базах (Google/URLhaus)' 
                        : breakdown?.hasMlUrlThreat 
                          ? 'Підозра нейромережевого аналізу URL'
                          : 'Перевірено: загроз у базах не виявлено'}
                    </div>
                  </div>

                  {/* Factor 4: Heuristics & Explicit Triggers List */}
                  <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between gap-1.5 min-w-0 transition-all hover:border-amber-500/30">
                    <div className="flex items-center justify-between gap-1 text-zinc-400">
                      <div className="flex items-center gap-1.5 truncate">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-medium text-xs text-zinc-300 truncate">Евристика</span>
                      </div>
                      <span className="text-[10px] text-cyan-400 font-mono">
                        {vectors.length} {vectors.length === 1 ? 'тригер' : 'тригерів'}
                      </span>
                    </div>

                    {/* Explicit list of triggers with scrollbar for long lists */}
                    {vectors.length > 0 ? (
                      <div className="flex flex-col gap-1 max-h-24 overflow-y-auto cyber-scrollbar pr-1 my-1">
                        {vectors.map((v, i) => (
                          <div 
                            key={v.id || i} 
                            className="flex items-center justify-between text-[10px] bg-zinc-900/90 px-1.5 py-0.5 rounded border border-zinc-800"
                            title={v.explanation || v.trigger}
                          >
                            <span className="truncate text-zinc-300">{v.trigger}</span>
                            <span className="font-mono text-amber-400 font-semibold shrink-0 ml-1">
                              {(v.score * 100).toFixed(0)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="font-semibold text-sm text-emerald-400 py-1">
                        Чистий текст
                      </div>
                    )}

                    <div className="text-[11px] text-zinc-500 leading-snug break-words">
                      {(breakdown?.obfuscationScore || 0) > 0 
                        ? `Обфускація (+${Math.round((breakdown?.obfuscationScore || 0) * 100)}%)` 
                        : 'Семантичні маркери та гомогліфи'}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Panel>
  );
};

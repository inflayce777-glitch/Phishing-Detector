'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Panel } from '@/components/ui/Panel';
import { 
  ShieldAlert, ShieldCheck, Cpu, Globe, Fingerprint, 
  ChevronDown, ChevronUp, Info, AlertTriangle, Layers
} from 'lucide-react';
import styles from './VerdictPanel.module.scss';

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
  onExportReport?: () => void;
}

export const VerdictPanel = ({ 
  threatLevel, 
  isSpam, 
  breakdown,
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
      return 'Виявлено критичні ознаки фішингу, підміни відправника або шкідливого програмного забезпечення. Не пере переходьте за посиланнями та не передавайте дані.';
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

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px', flex: 1 }}>
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

            <p style={{ margin: 0, color: 'var(--fx-muted)', fontSize: '13px', lineHeight: '1.5' }}>
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

                  {/* Factor 3: URL & Infrastructure */}
                  <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between gap-1.5 min-w-0 transition-all hover:border-emerald-500/30">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-medium text-xs text-zinc-300 truncate">Репутація URL</span>
                    </div>
                    <div className="font-semibold text-sm truncate" style={{ color: breakdown?.hasHardBlacklist ? 'var(--fx-red)' : breakdown?.hasMlUrlThreat ? '#f39c12' : 'var(--fx-green)' }}>
                      {breakdown?.hasHardBlacklist ? 'Чорний список' : breakdown?.hasMlUrlThreat ? 'ML-підозра' : 'Чисті'}
                    </div>
                    <div className="text-[11px] text-zinc-500 leading-snug break-words">
                      {breakdown?.hasHardBlacklist ? 'Занесено до баз загроз' : 'Перевірка DNS та Safe Browsing'}
                    </div>
                  </div>

                  {/* Factor 4: Heuristics & Obfuscation */}
                  <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between gap-1.5 min-w-0 transition-all hover:border-amber-500/30">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-medium text-xs text-zinc-300 truncate">Евристика</span>
                    </div>
                    <div className="font-semibold text-sm truncate" style={{ color: (breakdown?.obfuscationScore || 0) > 0 ? 'var(--fx-red)' : 'var(--fx-green)' }}>
                      {(breakdown?.obfuscationScore || 0) > 0 
                        ? `Обфускація (+${Math.round((breakdown?.obfuscationScore || 0) * 100)}%)` 
                        : (breakdown?.triggersCount ? `${breakdown.triggersCount} тригерів` : 'Без тригерів')}
                    </div>
                    <div className="text-[11px] text-zinc-500 leading-snug break-words">
                      Аналіз прихованих символів та слів
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

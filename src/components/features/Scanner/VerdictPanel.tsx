'use client';
import { motion } from 'framer-motion';
import { Panel } from '@/components/ui/Panel';
import styles from './VerdictPanel.module.scss';

interface VerdictPanelProps {
  threatLevel: number;
  isSpam?: boolean;
}

export const VerdictPanel = ({ threatLevel, isSpam }: VerdictPanelProps) => {
  const getVerdictLabel = (level: number) => {
    if (level > 70) return 'Критична загроза';
    if (level > 40) return isSpam ? 'Підозріло (Спам)' : 'Підозріло';
    return 'Безпечно';
  };

  const getVerdictColor = (level: number) => {
    if (level > 70) return 'var(--fx-red)';
    if (level > 40) return isSpam ? '#f39c12' : 'var(--fx-amber)';
    return 'var(--fx-green)';
  };

  return (
    <Panel title="Висновок">
      <div className={styles.verdictBody}>
        <div className={styles.scorebox}>
          <div className={`${styles.scoreRing} ${threatLevel < 40 ? styles.safe : ''}`}>
            <span className={`${styles.scoreNum} ${threatLevel < 40 ? styles.safe : ''}`}>
              {threatLevel}
            </span>
          </div>
          <span className={styles.scoreSub}>Ризик / 100</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
          <h3
            style={{
              color: getVerdictColor(threatLevel),
              fontWeight: 700,
              letterSpacing: '0.02em',
              margin: 0,
            }}
          >
            {getVerdictLabel(threatLevel)}
          </h3>
          {threatLevel > 40 && threatLevel <= 70 && isSpam && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'var(--fx-mono)',
                  padding: '2px 8px',
                  borderRadius: '3px',
                  background: 'rgba(243, 156, 18, 0.15)',
                  border: '1px solid rgba(243, 156, 18, 0.4)',
                  color: '#f39c12',
                }}
              >
                Масова розсилка / аутріч
              </span>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
};

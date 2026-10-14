'use client';
import { motion } from 'framer-motion';
import { Panel } from '@/components/ui/Panel';
import ThreatCanvas from '@/components/3d/ThreatCanvas';

interface GraphPanelProps {
  vectors: any[];
  activeNode: any;
  setActiveNode: (node: any) => void;
  threatLevel: number;
}

export const GraphPanel = ({ vectors, activeNode, setActiveNode, threatLevel }: GraphPanelProps) => {
  return (
    <Panel title="Граф ознак (3D)" noPadding>
      <div style={{ height: '350px', position: 'relative' }}>
        <ThreatCanvas vectors={vectors} onNodeClick={setActiveNode} riskScore={threatLevel} />

        {activeNode && activeNode.id !== 'root' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '20px',
              right: '20px',
              background: 'rgba(11, 16, 19, 0.85)',
              border: `1px solid ${activeNode.color}`,
              padding: '14px',
              backdropFilter: 'blur(8px)',
              zIndex: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ color: activeNode.color, fontFamily: 'var(--fx-mono)', fontSize: '11px', fontWeight: 'bold' }}>
                [ {activeNode.trigger ? (activeNode.trigger.charAt(0).toUpperCase() + activeNode.trigger.slice(1)) : ''} ]
              </div>
              <div style={{ color: activeNode.color, fontFamily: 'var(--fx-mono)', fontSize: '11px' }}>
                {(activeNode.score * 100).toFixed(1)}% ризик
              </div>
            </div>
            <div style={{ color: 'var(--fx-text)', fontSize: '13px', lineHeight: '1.5' }}>
              {activeNode.explanation || 'Пояснення відсутнє.'}
            </div>
          </motion.div>
        )}
      </div>
    </Panel>
  );
};

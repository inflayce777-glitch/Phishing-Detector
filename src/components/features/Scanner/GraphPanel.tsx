'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Panel } from '@/components/ui/Panel';
import ThreatCanvas from '@/components/3d/ThreatCanvas';
import { RotateCw, Crosshair, X, ShieldCheck, AlertOctagon, Info } from 'lucide-react';

interface GraphPanelProps {
  vectors: any[];
  activeNode: any;
  setActiveNode: (node: any) => void;
  threatLevel: number;
}

export const GraphPanel = ({ vectors, activeNode, setActiveNode, threatLevel }: GraphPanelProps) => {
  const [autoRotate, setAutoRotate] = useState(true);

  const isSafe = threatLevel <= 30 && vectors.length === 0;

  return (
    <Panel 
      title="Граф ознак (3D)" 
      noPadding
      className="h-full flex flex-col min-h-[420px]"
      headerRight={
        <div className="flex items-center gap-1.5">
          {/* Status Badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-mono border tracking-wider ${
            isSafe
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-400'
              : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
          }`}>
            {isSafe ? (
              <>
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>0 ЗАГРОЗ</span>
              </>
            ) : (
              <>
                <AlertOctagon className="w-3 h-3 text-rose-400 animate-pulse" />
                <span>{vectors.length} {vectors.length === 1 ? 'ВЕКТОР' : 'ВЕКТОРІВ'}</span>
              </>
            )}
          </div>

          {/* Auto-Rotate Toggle */}
          <button
            onClick={() => setAutoRotate(prev => !prev)}
            title={autoRotate ? "Вимкнути авто-обертання" : "Увімкнути авто-обертання"}
            className={`p-1.5 rounded transition-all border ${
              autoRotate
                ? 'bg-cyan-950/40 border-cyan-500/60 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
            }`}
          >
            <RotateCw className={`w-3.5 h-3.5 transition-transform ${autoRotate ? 'animate-spin-slow text-cyan-400' : ''}`} />
          </button>

          {/* Reset Camera Focus */}
          <button
            onClick={() => setActiveNode(null)}
            title="Центрувати камеру (скинути вибір)"
            className="p-1.5 rounded bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-cyan-300 hover:border-cyan-500/50 transition-all"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
        </div>
      }
    >
      <div className="relative w-full h-full min-h-[380px] flex-1 bg-black/40 overflow-hidden">
        {/* 3D WebGL Canvas */}
        <ThreatCanvas 
          vectors={vectors} 
          onNodeClick={setActiveNode} 
          riskScore={threatLevel} 
          activeNode={activeNode}
          autoRotate={autoRotate}
        />

        {/* Quick Hint Overlay on Top Left */}
        <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-950/80 backdrop-blur-md border border-zinc-800/80 text-[10px] font-mono text-zinc-400">
          <Info className="w-3 h-3 text-cyan-400 shrink-0" />
          <span>Клікніть по вузлу для фокусу камери</span>
        </div>

        {/* Interactive Active Node Details Card */}
        <AnimatePresence>
          {activeNode && activeNode.id !== 'root' && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-3 left-3 right-3 p-3.5 rounded-lg bg-zinc-950/95 backdrop-blur-md shadow-2xl z-20 border font-mono"
              style={{ borderColor: activeNode.color || 'var(--fx-cyan)' }}
            >
              <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <span 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: activeNode.color || 'var(--fx-cyan)', boxShadow: `0 0 8px ${activeNode.color}` }}
                  />
                  <span className="text-xs font-bold text-white tracking-wide">
                    {activeNode.trigger ? (activeNode.trigger.charAt(0).toUpperCase() + activeNode.trigger.slice(1)) : 'Ознака'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span 
                    className="text-xs font-semibold px-2 py-0.5 rounded border"
                    style={{ 
                      color: activeNode.color || 'var(--fx-cyan)',
                      borderColor: `${activeNode.color}60`,
                      backgroundColor: `${activeNode.color}15`
                    }}
                  >
                    {(activeNode.score * 100).toFixed(0)}% ризик
                  </span>

                  <button
                    onClick={() => setActiveNode(null)}
                    className="text-zinc-500 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors"
                    title="Закрити деталі"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Threat Probability Bar */}
              <div className="w-full bg-zinc-900 rounded-full h-1.5 mb-2 overflow-hidden border border-zinc-800">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${Math.round(activeNode.score * 100)}%`,
                    backgroundColor: activeNode.color || 'var(--fx-cyan)',
                    boxShadow: `0 0 8px ${activeNode.color}`
                  }}
                />
              </div>

              <div className="text-xs text-zinc-300 font-sans leading-relaxed">
                {activeNode.explanation || 'Виявлено семантичний маркер потенційної соціальної інженерії.'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Panel>
  );
};

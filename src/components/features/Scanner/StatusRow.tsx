'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Shield, History, LogOut, Cpu, Activity } from 'lucide-react';
import { SmartPopover } from '@/components/ui/SmartPopover/SmartPopover';
import { popoverManager } from '@/core/popoverManager';

interface StatusRowProps {
  statusText: string;
  sessionEmail: string | null;
  setShowSecurityModal: (val: boolean) => void;
  onLogout: () => void;
}

interface MLHealth {
  status: string;
  device?: string;
  gpu_name?: string;
  metrics?: {
    text_email_f1?: number;
    url_f1?: number;
  };
}

export const StatusRow = ({ 
  statusText, 
  sessionEmail, 
  setShowSecurityModal, 
  onLogout 
}: StatusRowProps) => {
  const [mlHealth, setMlHealth] = useState<MLHealth | null>(null);

  useEffect(() => {
    fetch('/api/python-ml')
      .then(res => res.json())
      .then(data => {
        if (data && data.status) {
          setMlHealth(data);
        }
      })
      .catch(() => {
        setMlHealth({ status: 'offline' });
      });
  }, []);

  const isOnline = mlHealth?.status === 'online';

  return (
    <motion.div 
      className="flex justify-between items-center flex-wrap gap-2.5 pb-1" 
      variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 80, damping: 15 } } }}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <span style={{ color: 'var(--fx-cyan)', fontFamily: 'var(--fx-mono)', fontSize: '12px', letterSpacing: '0.05em', fontWeight: 'bold' }}>
          Статус: {statusText}
        </span>

        {/* 1. ML Core Health Badge with SmartPopover */}
        {isOnline && (
          <SmartPopover
            id="popover-ml-health-details"
            placement="auto"
            trigger={({ isOpen, toggle, ref }) => (
              <div ref={ref}>
                <button
                  onClick={toggle}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono tracking-wider transition-all border ${
                    isOpen
                      ? 'bg-emerald-950/80 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400 hover:border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                  }`}
                  title="Деталі нейромережевого ядра"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <Cpu className="w-3.5 h-3.5" />
                  <span>ML: {mlHealth?.gpu_name ? 'RTX 3060 CUDA' : 'Online'}</span>
                </button>
              </div>
            )}
          >
            <div className="w-72 max-w-[calc(100vw-24px)] bg-zinc-950/98 backdrop-blur-md border border-emerald-500/30 rounded-lg shadow-2xl p-3 font-mono text-[11px] text-zinc-300">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-2 border-b border-emerald-500/20 pb-1.5">
                <Activity className="w-3.5 h-3.5" />
                <span>Нейромережеве ядро</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-zinc-500 shrink-0">Пристрій:</span>
                  <span className="text-zinc-200 text-right font-semibold break-words">
                    {mlHealth?.gpu_name || mlHealth?.device || 'CUDA'}
                  </span>
                </div>
                <div className="flex justify-between items-start gap-2 pt-1 border-t border-zinc-800/80 text-[10px] text-zinc-400">
                  <span>Статус середовища:</span>
                  <span className="text-emerald-400">Активно (PyTorch + CUDA)</span>
                </div>
              </div>
            </div>
          </SmartPopover>
        )}

        {!isOnline && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono tracking-wider bg-zinc-900 border border-zinc-700/50 text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            <Cpu className="w-3.5 h-3.5" />
            <span>ML: Offline</span>
          </div>
        )}
      </div>
      
      {/* 2. User Account Dropdown with SmartPopover */}
      <SmartPopover
        id="popover-user-account-menu"
        placement="bottom-end"
        trigger={({ isOpen, toggle, ref }) => (
          <div ref={ref}>
            <button 
              onClick={toggle}
              className={`flex items-center gap-2 text-xs transition-all border px-3 py-1 rounded-sm ${
                isOpen
                  ? 'border-cyan-400 bg-cyan-950/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                  : 'text-cyan-400 hover:text-cyan-300 border-cyan-500/50 hover:border-cyan-400 bg-cyan-950/20'
              }`}
            >
              <span className="max-w-[160px] truncate">{sessionEmail || "Акаунт"}</span>
              <ChevronDown className={`w-3 h-3 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180 text-cyan-300' : ''}`} />
            </button>
          </div>
        )}
      >
        <div className="w-48 max-w-[calc(100vw-24px)] bg-gray-950/98 backdrop-blur-md border border-cyan-500/30 rounded-lg shadow-2xl py-1.5 flex flex-col font-mono text-xs">
          <button 
            onClick={() => { 
              popoverManager.close(); 
              setShowSecurityModal(true); 
            }}
            className="flex items-center gap-2.5 px-4 py-2 text-emerald-400 hover:bg-zinc-900/80 transition-colors text-left"
          >
            <Shield className="w-4 h-4 shrink-0" />
            <span>Безпека (2FA)</span>
          </button>
          <a 
            href="/dashboard"
            onClick={() => popoverManager.close()}
            className="flex items-center gap-2.5 px-4 py-2 text-cyan-400 hover:bg-zinc-900/80 transition-colors"
          >
            <History className="w-4 h-4 shrink-0" />
            <span>Історія інбоксу</span>
          </a>
          <div className="h-px bg-zinc-800 my-1"></div>
          <button 
            onClick={() => {
              popoverManager.close();
              onLogout();
            }}
            className="flex items-center gap-2.5 px-4 py-2 text-rose-400 hover:bg-zinc-900/80 transition-colors text-left"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Вийти з акаунта</span>
          </button>
        </div>
      </SmartPopover>
    </motion.div>
  );
};

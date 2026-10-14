'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Shield, History, LogOut, Cpu, Activity } from 'lucide-react';

interface StatusRowProps {
  statusText: string;
  sessionEmail: string | null;
  showUserDropdown: boolean;
  setShowUserDropdown: (val: boolean) => void;
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
  statusText, sessionEmail, showUserDropdown, 
  setShowUserDropdown, setShowSecurityModal, onLogout 
}: StatusRowProps) => {
  const [mlHealth, setMlHealth] = useState<MLHealth | null>(null);
  const [showMlDetails, setShowMlDetails] = useState(false);

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
      className="flex justify-between items-center" 
      variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 80, damping: 15 } } }}
    >
      <div className="flex items-center gap-4">
        <span style={{ color: 'var(--fx-cyan)', fontFamily: 'var(--fx-mono)', fontSize: '12px', letterSpacing: '0.05em', fontWeight: 'bold' }}>
          Статус: {statusText}
        </span>

        {/* ML Core Health Badge */}
        <div className="relative">
          <button
            onClick={() => setShowMlDetails(!showMlDetails)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono tracking-wider transition-all border ${
              isOnline
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400 hover:border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                : 'bg-zinc-900 border-zinc-700/50 text-zinc-400'
            }`}
            title="Статус нейромережевого ядра"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
            <Cpu className="w-3 h-3" />
            <span>ML: {isOnline ? (mlHealth?.gpu_name ? 'RTX 3060 CUDA' : 'Online') : 'Offline'}</span>
          </button>

          {showMlDetails && isOnline && (
            <div className="absolute left-0 top-full mt-1 w-72 bg-zinc-950 border border-emerald-500/30 rounded shadow-2xl z-50 p-2.5 font-mono text-[11px] text-zinc-300">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1.5 border-b border-emerald-500/20 pb-1">
                <Activity className="w-3.5 h-3.5" />
                <span>Нейромережеве ядро</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-zinc-500 shrink-0">Пристрій:</span>
                  <span className="text-zinc-200 text-right">{mlHealth?.gpu_name || mlHealth?.device || 'CUDA'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="relative">
        <button 
          onClick={() => setShowUserDropdown(!showUserDropdown)}
          className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/50 hover:border-cyan-400 px-3 py-1 bg-cyan-950/20 transition-all rounded-sm"
        >
          <span>{sessionEmail || "Акаунт"}</span>
          <ChevronDown className="w-3 h-3" />
        </button>
        
        {showUserDropdown && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-gray-900 border border-cyan-500/30 rounded shadow-xl z-50 py-1 flex flex-col font-mono text-sm">
            <button 
              onClick={() => { setShowSecurityModal(true); setShowUserDropdown(false); }}
              className="flex items-center gap-2 px-4 py-2 text-emerald-400 hover:bg-gray-800 transition-colors text-left"
            >
              <Shield className="w-4 h-4" /> Безпека (2FA)
            </button>
            <a 
              href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 text-cyan-400 hover:bg-gray-800 transition-colors"
            >
              <History className="w-4 h-4" /> Історія
            </a>
            <div className="h-px bg-gray-800 my-1"></div>
            <button 
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-gray-800 transition-colors text-left"
            >
              <LogOut className="w-4 h-4" /> Вийти
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  className?: string;
  headerRight?: React.ReactNode;
  variant?: 'default' | 'danger' | 'warning' | 'success';
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  badge,
  children,
  defaultOpen = false,
  isOpen: controlledIsOpen,
  onToggle,
  className = '',
  headerRight,
  variant = 'default',
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);

  const isControlled = controlledIsOpen !== undefined;
  const open = isControlled ? controlledIsOpen : uncontrolledOpen;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    }
    if (!isControlled) {
      setUncontrolledOpen((prev) => !prev);
    }
  };

  const borderVariantMap = {
    default: 'border-zinc-800/80 hover:border-zinc-700/80',
    danger: 'border-rose-500/40 hover:border-rose-500/60 shadow-[0_0_15px_rgba(244,63,94,0.08)]',
    warning: 'border-amber-500/40 hover:border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.08)]',
    success: 'border-emerald-500/40 hover:border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.08)]',
  };

  return (
    <div
      className={`rounded-lg border bg-zinc-950/85 backdrop-blur-md overflow-hidden transition-all duration-200 ${borderVariantMap[variant]} ${className}`}
    >
      {/* Header bar */}
      <div
        onClick={handleToggle}
        className="flex items-center justify-between px-4 py-3.5 cursor-pointer select-none bg-zinc-900/30 hover:bg-zinc-900/60 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <span className="shrink-0 text-cyan-400">{icon}</span>}
          <span className="text-xs sm:text-sm font-semibold tracking-wide text-zinc-100 truncate">
            {title}
          </span>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>

        <div className="flex items-center gap-2.5 shrink-0 ml-3">
          {headerRight && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center"
            >
              {headerRight}
            </div>
          )}

          <div
            className={`p-1 rounded text-zinc-400 hover:text-white transition-transform duration-200 ${
              open ? 'rotate-180 text-cyan-400' : ''
            }`}
          >
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Expandable Content */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-zinc-800/60"
          >
            <div className="p-4 sm:p-5 text-xs text-zinc-300 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

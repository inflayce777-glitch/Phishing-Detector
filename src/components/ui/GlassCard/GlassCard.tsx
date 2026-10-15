'use client';
import React, { ReactNode } from 'react';

export type GlassCardVariant = 'default' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'indigo';

export interface GlassCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: GlassCardVariant;
  title?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  noPadding?: boolean;
}

const borderVariantStyles: Record<GlassCardVariant, string> = {
  default: 'border-zinc-800/80 hover:border-zinc-700/80',
  cyan: 'border-cyan-500/30 hover:border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.06)]',
  emerald: 'border-emerald-500/30 hover:border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.06)]',
  amber: 'border-amber-500/30 hover:border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.06)]',
  rose: 'border-rose-500/30 hover:border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.06)]',
  indigo: 'border-indigo-500/30 hover:border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.06)]',
};

export const GlassCard: React.FC<GlassCardProps> = ({
  variant = 'default',
  title,
  headerRight,
  children,
  noPadding = false,
  className = '',
  style,
  ...props
}) => {
  return (
    <div
      className={`rounded-xl bg-zinc-950/70 backdrop-blur-md border transition-all duration-200 overflow-hidden ${borderVariantStyles[variant]} ${className}`}
      style={style}
      {...props}
    >
      {(title || headerRight) && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/70 bg-zinc-900/30">
          {title && (
            <div className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-300">
              {title}
            </div>
          )}
          {headerRight && (
            <div className="flex items-center gap-2">
              {headerRight}
            </div>
          )}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5'}>
        {children}
      </div>
    </div>
  );
};

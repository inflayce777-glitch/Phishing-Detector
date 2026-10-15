'use client';
import React, { ReactNode } from 'react';

export type BadgeVariant = 'safe' | 'warning' | 'danger' | 'info' | 'tech' | 'neutral';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
  icon?: ReactNode;
  pulse?: boolean;
}

const variantStyles: Record<BadgeVariant, { bg: string; border: string; text: string; dot: string }> = {
  safe: {
    bg: 'bg-emerald-950/40',
    border: 'border-emerald-500/40',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400'
  },
  warning: {
    bg: 'bg-amber-950/40',
    border: 'border-amber-500/40',
    text: 'text-amber-400',
    dot: 'bg-amber-400'
  },
  danger: {
    bg: 'bg-rose-950/40',
    border: 'border-rose-500/40',
    text: 'text-rose-400',
    dot: 'bg-rose-400'
  },
  info: {
    bg: 'bg-cyan-950/40',
    border: 'border-cyan-500/40',
    text: 'text-cyan-400',
    dot: 'bg-cyan-400'
  },
  tech: {
    bg: 'bg-indigo-950/40',
    border: 'border-indigo-500/40',
    text: 'text-indigo-400',
    dot: 'bg-indigo-400'
  },
  neutral: {
    bg: 'bg-zinc-900/60',
    border: 'border-zinc-700/50',
    text: 'text-zinc-300',
    dot: 'bg-zinc-400'
  }
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-2 py-0.5 gap-1',
  md: 'text-[11px] px-2.5 py-1 gap-1.5',
  lg: 'text-xs px-3 py-1.5 gap-2'
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  children,
  icon,
  pulse = false,
  className = '',
  style,
  ...props
}) => {
  const styles = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded-full border transition-all ${styles.bg} ${styles.border} ${styles.text} ${sizeStyles[size]} ${className}`}
      style={style}
      {...props}
    >
      {pulse && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${styles.dot}`} />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  );
};

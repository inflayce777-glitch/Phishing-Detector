'use client';
import styles from './Header.module.scss';
import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, Inbox, BarChart3 } from 'lucide-react';

interface HeaderProps {
  children?: ReactNode;
}

export const Header = ({ children }: HeaderProps) => {
  const pathname = usePathname();

  const navItems = [
    { label: 'Сканер', href: '/', icon: Shield },
    { label: 'Інбокс', href: '/dashboard', icon: Inbox },
    { label: 'Статистика', href: '/analytics', icon: BarChart3 },
  ];

  return (
    <motion.header 
      className={styles.header}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 80, damping: 15 }}
    >
      <div className={styles.brand}>
        <Link href="/" className="flex items-center gap-2.5 no-underline text-white hover:text-cyan-400 transition-colors">
          <div className={styles.mark}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 2 17 5v4.8c0 4.1-2.9 6.9-7 8.2-4.1-1.3-7-4.1-7-8.2V5l7-3Z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="M6.5 10h2.2l1.2-2.2 1.6 4.4 1-2.2h1"
                stroke="currentColor"
                strokeWidth="1.1"
              />
            </svg>
          </div>
          <div className={styles.title}>Семантичний аналіз загроз</div>
        </Link>
      </div>

      <nav className="hidden sm:flex items-center gap-1 font-mono text-xs">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all no-underline ${
                isActive 
                  ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/40 font-semibold shadow-[0_0_10px_rgba(108,229,220,0.2)]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {children && <div className="flex items-center gap-2">{children}</div>}
    </motion.header>
  );
};

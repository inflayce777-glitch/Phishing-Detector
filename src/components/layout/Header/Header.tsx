'use client';
import styles from './Header.module.scss';
import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface HeaderProps {
  children?: ReactNode;
}

export const Header = ({ children }: HeaderProps) => {
  return (
    <motion.header 
      className={styles.header}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 80, damping: 15 }}
    >
      <div className={styles.brand}>
        <div className={styles.mark}>
          <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
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
      </div>
      {children && <div>{children}</div>}
    </motion.header>
  );
};

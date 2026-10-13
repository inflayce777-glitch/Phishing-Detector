'use client';
import { ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import styles from './Panel.module.scss';

interface PanelProps extends HTMLMotionProps<'article'> {
  title?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  noPadding?: boolean;
}

export const Panel = ({ title, headerRight, children, noPadding, className, ...props }: PanelProps) => {
  return (
    <motion.article className={`${styles.panel} ${className || ''}`} {...props}>
      {(title || headerRight) && (
        <div className={styles.head}>
          {title && <div className={styles.title}>{title}</div>}
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}
      <div className={noPadding ? '' : styles.body}>
        {children}
      </div>
    </motion.article>
  );
};

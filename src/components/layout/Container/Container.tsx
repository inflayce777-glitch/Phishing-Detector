'use client';
import { ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import styles from './Container.module.scss';

interface ContainerProps extends HTMLMotionProps<'main'> {
  children: ReactNode;
}

export const Container = ({ children, className, ...props }: ContainerProps) => {
  return (
    <motion.main 
      className={`${styles.container} ${className || ''}`} 
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.1 } }
      }}
      {...props}
    >
      <div className={styles.shell}>
        {children}
      </div>
    </motion.main>
  );
};

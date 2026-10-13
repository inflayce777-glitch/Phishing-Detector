'use client';
import { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.scss';
import { motion, HTMLMotionProps } from 'framer-motion';

interface ButtonProps extends HTMLMotionProps<'button'> {
  children: ReactNode;
  variant?: 'primary' | 'outline';
  className?: string;
}

export const Button = ({ children, variant = 'primary', className, ...props }: ButtonProps) => {
  const isOutline = variant === 'outline';
  
  return (
    <motion.button
      className={`${styles.button} ${isOutline ? styles.outline : ''} ${className || ''}`}
      whileHover={!props.disabled ? { scale: 1.02 } : {}}
      whileTap={!props.disabled ? { scale: 0.98 } : {}}
      {...props}
    >
      {children}
    </motion.button>
  );
};

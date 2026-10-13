'use client';
import { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import styles from './Input.module.scss';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Input = ({ className, ...props }: InputProps) => {
  return <input className={`${styles.input} ${className || ''}`} {...props} />;
};

export const Textarea = ({ className, ...props }: TextareaProps) => {
  return <textarea className={`${styles.input} ${styles.textarea} ${className || ''}`} {...props} />;
};

'use client';

import React, { useRef, useState, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useExclusivePopover, popoverManager } from '@/core/popoverManager';

export interface SmartTooltipProps {
  id?: string;
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  tooltipClassName?: string;
  arrowClassName?: string;
  offset?: number;
  padding?: number;
  variant?: 'cyan' | 'gray';
}

export const SmartTooltip: React.FC<SmartTooltipProps> = ({
  id: customId,
  children,
  content,
  className = '',
  tooltipClassName = '',
  arrowClassName = '',
  offset = 8,
  padding = 12,
  variant = 'cyan',
}) => {
  const autoId = useId();
  const id = customId || autoId;
  const { isOpen, open, close, toggle } = useExclusivePopover(id);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    placeBelow: boolean;
    arrowX: number;
  } | null>(null);

  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();

    const tooltipEl = tooltipRef.current;
    const tooltipWidth = tooltipEl ? tooltipEl.offsetWidth : 288;
    const tooltipHeight = tooltipEl ? tooltipEl.offsetHeight : 140;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const safePad = padding;

    // --- 1. HORIZONTAL POSITIONING & STRICT CLAMPING ---
    const triggerCenter = triggerRect.left + triggerRect.width / 2;
    let left = triggerCenter - tooltipWidth / 2;

    // Strict left boundary check
    if (left < safePad) {
      left = safePad;
    }
    // Strict right boundary check
    if (left + tooltipWidth > viewportW - safePad) {
      left = Math.max(safePad, viewportW - safePad - tooltipWidth);
    }

    // --- 2. VERTICAL POSITIONING & AUTO-FLIP ---
    let top = triggerRect.bottom + offset;
    let placeBelow = true;

    if (top + tooltipHeight > viewportH - safePad) {
      const topAbove = triggerRect.top - tooltipHeight - offset;
      if (topAbove >= safePad) {
        top = topAbove;
        placeBelow = false;
      } else {
        top = Math.max(safePad, Math.min(top, viewportH - safePad - tooltipHeight));
      }
    }

    if (top < safePad) {
      top = safePad;
    }

    // --- 3. DYNAMIC ARROW POSITIONING ---
    const rawArrowX = triggerCenter - left;
    const arrowX = Math.max(16, Math.min(rawArrowX, tooltipWidth - 16));

    setCoords({ top, left, placeBelow, arrowX });
  }, [offset, padding]);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    const rAF = requestAnimationFrame(updatePosition);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      cancelAnimationFrame(rAF);
    };
  }, [isOpen, updatePosition]);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    open();
  };

  const handleMouseLeave = () => {
    timerRef.current = setTimeout(() => {
      close();
    }, 150);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggle();
  };

  const borderStyles = variant === 'gray' 
    ? 'border border-gray-700' 
    : 'border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]';

  const arrowStyles = variant === 'gray'
    ? 'border-gray-700'
    : 'border-cyan-500/50';

  return (
    <>
      <div
        ref={triggerRef}
        data-popover-trigger={id}
        className={`inline-block cursor-help ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {children}
      </div>

      {mounted && isOpen && createPortal(
        <AnimatePresence>
          <motion.div
            ref={tooltipRef}
            data-popover-root={id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              top: coords ? `${coords.top}px` : '-9999px',
              left: coords ? `${coords.left}px` : '-9999px',
              maxWidth: `calc(100vw - ${padding * 2}px)`,
              maxHeight: `calc(100vh - ${padding * 2}px)`,
              zIndex: 99999,
            }}
            className={`w-72 p-3 bg-gray-950/98 backdrop-blur-md rounded-lg shadow-2xl text-xs text-gray-200 pointer-events-auto overflow-y-auto ${borderStyles} ${tooltipClassName}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {content}

            {coords && (
              <div
                style={{
                  left: `${coords.arrowX}px`,
                }}
                className={`absolute w-2.5 h-2.5 bg-gray-950 transform rotate-45 -translate-x-1/2 pointer-events-none ${
                  coords.placeBelow
                    ? `-top-[5px] border-t border-l ${arrowStyles}`
                    : `-bottom-[5px] border-b border-r ${arrowStyles}`
                } ${arrowClassName}`}
              />
            )}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

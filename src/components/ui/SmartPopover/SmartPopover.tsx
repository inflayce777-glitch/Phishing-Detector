'use client';

import React, { useRef, useState, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useExclusivePopover, popoverManager } from '@/core/popoverManager';

export interface SmartPopoverProps {
  id?: string;
  trigger: (props: {
    isOpen: boolean;
    toggle: () => void;
    open: () => void;
    close: () => void;
    ref: React.RefObject<HTMLDivElement | null>;
  }) => React.ReactNode;
  children: React.ReactNode;
  className?: string;
  hasArrow?: boolean;
  arrowClassName?: string;
  offset?: number;
  padding?: number;
  placement?: 'auto' | 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
}

export const SmartPopover: React.FC<SmartPopoverProps> = ({
  id: customId,
  trigger,
  children,
  className = '',
  hasArrow = true,
  arrowClassName = '',
  offset = 8,
  padding = 12,
  placement = 'auto',
}) => {
  const autoId = useId();
  const id = customId || autoId;
  const { isOpen, toggle, open, close } = useExclusivePopover(id);
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    placeBelow: boolean;
    arrowX: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popoverEl = popoverRef.current;

    const popoverWidth = popoverEl ? popoverEl.offsetWidth : 288;
    const popoverHeight = popoverEl ? popoverEl.offsetHeight : 120;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const safePad = padding;

    // --- HORIZONTAL POSITIONING & STRICT CLAMPING ---
    const triggerCenter = triggerRect.left + triggerRect.width / 2;
    let left: number;

    if (placement === 'bottom-end' || placement === 'top-end') {
      left = triggerRect.right - popoverWidth;
    } else if (placement === 'bottom-start' || placement === 'top-start') {
      left = triggerRect.left;
    } else {
      left = triggerCenter - popoverWidth / 2;
    }

    // Strict boundary checks
    if (left < safePad) {
      left = safePad;
    }
    if (left + popoverWidth > viewportW - safePad) {
      left = Math.max(safePad, viewportW - safePad - popoverWidth);
    }

    // --- VERTICAL POSITIONING & AUTO-FLIP ---
    let top: number;
    let placeBelow = true;

    if (placement.startsWith('top')) {
      top = triggerRect.top - popoverHeight - offset;
      placeBelow = false;
      if (top < safePad) {
        top = triggerRect.bottom + offset;
        placeBelow = true;
      }
    } else {
      top = triggerRect.bottom + offset;
      placeBelow = true;
      if (top + popoverHeight > viewportH - safePad) {
        const topAbove = triggerRect.top - popoverHeight - offset;
        if (topAbove >= safePad) {
          top = topAbove;
          placeBelow = false;
        } else {
          top = Math.max(safePad, Math.min(top, viewportH - safePad - popoverHeight));
        }
      }
    }

    if (top < safePad) {
      top = safePad;
    }

    // Dynamic arrow X alignment with the trigger element
    const rawArrowX = triggerCenter - left;
    const arrowX = Math.max(16, Math.min(rawArrowX, popoverWidth - 16));

    setCoords({ top, left, placeBelow, arrowX });
  }, [offset, padding, placement]);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleReposition = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);

    const rAF = requestAnimationFrame(updatePosition);

    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
      cancelAnimationFrame(rAF);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <div 
        ref={triggerRef} 
        data-popover-trigger={id} 
        className="inline-block"
      >
        {trigger({ isOpen, toggle, open, close, ref: triggerRef })}
      </div>

      {mounted && isOpen && createPortal(
        <AnimatePresence>
          <motion.div
            ref={popoverRef}
            data-popover-root={id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              top: coords ? `${coords.top}px` : '-9999px',
              left: coords ? `${coords.left}px` : '-9999px',
              maxWidth: `calc(100vw - ${padding * 2}px)`,
              zIndex: 99999,
            }}
            className={`pointer-events-auto ${className}`}
          >
            {children}

            {hasArrow && coords && (
              <div
                style={{
                  left: `${coords.arrowX}px`,
                }}
                className={`absolute w-2.5 h-2.5 bg-zinc-950 transform rotate-45 -translate-x-1/2 pointer-events-none ${
                  coords.placeBelow
                    ? '-top-[5px] border-t border-l border-zinc-800'
                    : '-bottom-[5px] border-b border-r border-zinc-800'
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

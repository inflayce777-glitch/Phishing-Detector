'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface SmartTooltipProps {
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
  children,
  content,
  className = '',
  tooltipClassName = '',
  arrowClassName = '',
  offset = 8,
  padding = 14,
  variant = 'cyan'
}) => {
  const [isOpen, setIsOpen] = useState(false);
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

    // Use measured width/height if available, otherwise sensible defaults
    const tooltipEl = tooltipRef.current;
    const tooltipWidth = tooltipEl ? tooltipEl.offsetWidth : 288;
    const tooltipHeight = tooltipEl ? tooltipEl.offsetHeight : 140;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const safePad = padding; // Minimum padding from any screen edge

    // --- 1. HORIZONTAL POSITIONING (LEFT & RIGHT) ---
    // Start by centering over the trigger
    const triggerCenter = triggerRect.left + triggerRect.width / 2;
    let left = triggerCenter - tooltipWidth / 2;

    // Strict 4-side check: Left boundary
    if (left < safePad) {
      left = safePad;
    }
    // Strict 4-side check: Right boundary
    if (left + tooltipWidth > viewportW - safePad) {
      left = Math.max(safePad, viewportW - safePad - tooltipWidth);
    }

    // --- 2. VERTICAL POSITIONING (TOP & BOTTOM) ---
    // Default: try placing below
    let top = triggerRect.bottom + offset;
    let placeBelow = true;

    // Strict 4-side check: Bottom boundary -> flip to above if it overflows
    if (top + tooltipHeight > viewportH - safePad) {
      const topAbove = triggerRect.top - tooltipHeight - offset;
      if (topAbove >= safePad) {
        top = topAbove;
        placeBelow = false;
      } else {
        // If neither top nor bottom fits without overflow, clamp within safe boundaries
        top = Math.max(safePad, Math.min(top, viewportH - safePad - tooltipHeight));
      }
    }

    // Strict 4-side check: Top boundary
    if (top < safePad) {
      top = safePad;
    }

    // --- 3. DYNAMIC ARROW POSITIONING ---
    // Arrow always points directly at the center of the trigger element
    const rawArrowX = triggerCenter - left;
    const arrowX = Math.max(16, Math.min(rawArrowX, tooltipWidth - 16));

    setCoords({ top, left, placeBelow, arrowX });
  }, [offset, padding]);

  // Recalculate position when opened, or on scroll/resize
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    // Double-check after render to accommodate exact DOM measurement
    const rAF = requestAnimationFrame(updatePosition);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      cancelAnimationFrame(rAF);
    };
  }, [isOpen, updatePosition]);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 100);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(prev => !prev);
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
        className={`inline-block cursor-help ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {children}
      </div>

      {mounted && isOpen && createPortal(
        <div
          ref={tooltipRef}
          style={{
            position: 'fixed',
            top: coords ? `${coords.top}px` : '-9999px',
            left: coords ? `${coords.left}px` : '-9999px',
            maxWidth: `calc(100vw - ${padding * 2}px)`,
            zIndex: 99999,
          }}
          className={`w-72 p-3 bg-gray-950/98 backdrop-blur-md rounded-lg shadow-2xl text-xs text-gray-200 transition-opacity duration-150 animate-in fade-in zoom-in-95 pointer-events-auto ${borderStyles} ${tooltipClassName}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {content}

          {coords && (
            <div
              style={{
                left: `${coords.arrowX}px`,
              }}
              className={`absolute w-2.5 h-2.5 bg-gray-950 transform rotate-45 -translate-x-1/2 ${
                coords.placeBelow
                  ? `-top-1.5 border-t border-l ${arrowStyles}`
                  : `-bottom-1.5 border-b border-r ${arrowStyles}`
              } ${arrowClassName}`}
            />
          )}
        </div>,
        document.body
      )}
    </>
  );
};

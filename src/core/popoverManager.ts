'use client';

import { useState, useEffect, useCallback, useId } from 'react';

type PopoverId = string;
type Listener = (activeId: PopoverId | null) => void;

class PopoverManager {
  private activeId: PopoverId | null = null;
  private listeners: Set<Listener> = new Set();
  private isListening = false;

  public getActiveId(): PopoverId | null {
    return this.activeId;
  }

  public open(id: PopoverId) {
    if (this.activeId === id) return;
    this.activeId = id;
    this.notify();
    this.attachGlobalListeners();
  }

  public close(id?: PopoverId) {
    if (id && this.activeId !== id) return;
    if (this.activeId === null) return;
    this.activeId = null;
    this.notify();
  }

  public toggle(id: PopoverId) {
    if (this.activeId === id) {
      this.close(id);
    } else {
      this.open(id);
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.activeId));
  }

  private attachGlobalListeners() {
    if (this.isListening || typeof window === 'undefined') return;
    this.isListening = true;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (!this.activeId) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Do not close if clicking inside an active popover container or its trigger
      if (
        target.closest('[data-popover-root]') ||
        target.closest('[data-popover-trigger]') ||
        target.closest('[data-popover-keep]')
      ) {
        return;
      }

      this.close();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
  }
}

export const popoverManager = new PopoverManager();

/**
 * Hook to coordinate single-active popover / tooltip states across the app.
 * Guarantees that opening one popover automatically closes all others.
 */
export function useExclusivePopover(customId?: string) {
  const generatedId = useId();
  const id = customId || generatedId;
  const [isOpen, setIsOpenState] = useState(false);

  useEffect(() => {
    return popoverManager.subscribe((activeId) => {
      setIsOpenState(activeId === id);
    });
  }, [id]);

  const open = useCallback(() => popoverManager.open(id), [id]);
  const close = useCallback(() => popoverManager.close(id), [id]);
  const toggle = useCallback(() => popoverManager.toggle(id), [id]);

  return { id, isOpen, open, close, toggle };
}

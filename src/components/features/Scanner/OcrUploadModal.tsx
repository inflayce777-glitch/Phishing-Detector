'use client';
import React, { useRef, useEffect } from 'react';
import { Camera, UploadCloud } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface OcrUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
}

export const OcrUploadModal: React.FC<OcrUploadModalProps> = ({
  isOpen,
  onClose,
  onFileSelect,
  isLoading = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            onFileSelect(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, onFileSelect]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onFileSelect(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Оптичне розпізнавання тексту (OCR)"
      description="Завантажте знімок екрана підозрілого листа або повідомлення"
      icon={<Camera className="w-5 h-5 text-cyan-400" />}
      maxWidth="lg"
    >
      <div
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="w-full h-72 border-2 border-dashed border-cyan-500/40 hover:border-cyan-400 rounded-xl bg-cyan-950/10 hover:bg-cyan-950/20 transition-all flex flex-col items-center justify-center p-6 text-center cursor-pointer group"
      >
        <div className="w-16 h-16 rounded-full bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
          <UploadCloud className="w-8 h-8 text-cyan-400" />
        </div>

        <h4 className="text-sm font-semibold text-white mb-1.5 font-mono">
          Перетягніть скріншот сюди
        </h4>

        <p className="text-xs text-zinc-400 mb-4 max-w-xs leading-relaxed">
          або натисніть <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-cyan-300 font-mono text-[10px] border border-zinc-700">Ctrl + V</kbd> для вставки з буфера, або оберіть файл
        </p>

        <Button
          variant="primary"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          disabled={isLoading}
          style={{ fontSize: '11px', padding: '6px 16px' }}
        >
          {isLoading ? 'Розпізнавання тексту...' : 'Обрати файл зображення'}
        </Button>

        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    </Modal>
  );
};

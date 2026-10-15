'use client';
import React, { useState } from 'react';
import { 
  Sparkles, Search, CheckCircle, ShieldAlert, AlertTriangle, 
  Mail, MessageSquare, ArrowRight, Shield 
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { 
  THREAT_TEMPLATES, THREAT_CATEGORIES, ThreatTemplate, searchTemplates 
} from '@/core/templates';

interface ThreatTemplatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: ThreatTemplate) => void;
}

export const ThreatTemplatePicker: React.FC<ThreatTemplatePickerProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [previewTemplate, setPreviewTemplate] = useState<ThreatTemplate | null>(THREAT_TEMPLATES[0]);

  const filtered = searchTemplates(searchQuery, selectedCategory);

  const handleApply = (template: ThreatTemplate) => {
    onSelectTemplate(template);
    onClose();
  };

  const getThreatBadge = (type: ThreatTemplate['threatType']) => {
    switch (type) {
      case 'phishing':
        return (
          <Badge variant="danger" size="sm" icon={<ShieldAlert className="w-3 h-3" />}>
            Фішинг
          </Badge>
        );
      case 'spam':
        return (
          <Badge variant="warning" size="sm" icon={<AlertTriangle className="w-3 h-3" />}>
            Спам
          </Badge>
        );
      case 'safe':
        return (
          <Badge variant="safe" size="sm" icon={<Shield className="w-3 h-3" />}>
            Безпечно
          </Badge>
        );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Шаблони загроз та тестові сценарії"
      description="Оберіть реалістичний тестовий шаблон для швидкої перевірки роботи детектора"
      icon={<Sparkles className="w-5 h-5 text-cyan-400" />}
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {/* Search & Categories */}
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Пошук шаблону за назвою, текстом чи відправником..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900/80 border border-zinc-700/60 rounded-lg pl-9 pr-4 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {THREAT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-md text-[11px] font-mono whitespace-nowrap transition-all border ${
                  selectedCategory === cat.id
                    ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300 font-semibold shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                    : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Master / Detail Split View */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[380px]">
          {/* List of Templates (Left 5 cols) */}
          <div className="md:col-span-5 overflow-y-auto pr-1 space-y-2 max-h-[380px]">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 border border-zinc-800/80 rounded-lg">
                Нічого не знайдено за цим запитом.
              </div>
            ) : (
              filtered.map((item) => {
                const isSelected = previewTemplate?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setPreviewTemplate(item)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-cyan-950/30 border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                        : 'bg-zinc-900/30 border-zinc-800/70 hover:border-zinc-700 hover:bg-zinc-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 text-zinc-400 text-[10px]">
                        {item.mode === 'email' ? (
                          <Mail className="w-3 h-3 text-cyan-400" />
                        ) : (
                          <MessageSquare className="w-3 h-3 text-purple-400" />
                        )}
                        <span>{item.mode === 'email' ? 'Пошта' : 'Месенджер'}</span>
                      </div>
                      {getThreatBadge(item.threatType)}
                    </div>
                    <div className="text-xs font-semibold text-zinc-200 truncate mb-1">
                      {item.title}
                    </div>
                    <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Template Detail & Preview (Right 7 cols) */}
          <div className="md:col-span-7 bg-zinc-900/30 border border-zinc-800/80 rounded-lg p-4 flex flex-col justify-between overflow-hidden">
            {previewTemplate ? (
              <div className="space-y-3 overflow-y-auto pr-1">
                <div className="flex items-start justify-between gap-3 border-b border-zinc-800/80 pb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      {previewTemplate.title}
                    </h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {previewTemplate.description}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {getThreatBadge(previewTemplate.threatType)}
                  </div>
                </div>

                {previewTemplate.senderEmail && (
                  <div className="text-xs font-mono">
                    <span className="text-zinc-500">Відправник: </span>
                    <span className="text-cyan-400">{previewTemplate.senderEmail}</span>
                  </div>
                )}

                {previewTemplate.linkUrl && (
                  <div className="text-xs font-mono">
                    <span className="text-zinc-500">Посилання: </span>
                    <span className="text-amber-400 break-all">{previewTemplate.linkUrl}</span>
                  </div>
                )}

                <div>
                  <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider mb-1">
                    Текст повідомлення:
                  </div>
                  <pre className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-md font-mono text-[11px] text-zinc-300 whitespace-pre-wrap max-h-[160px] overflow-y-auto leading-relaxed">
                    {previewTemplate.text}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                Оберіть шаблон зі списку ліворуч для перегляду
              </div>
            )}

            {previewTemplate && (
              <div className="pt-3 border-t border-zinc-800/80 flex justify-end">
                <Button
                  variant="primary"
                  onClick={() => handleApply(previewTemplate)}
                  className="flex items-center gap-2"
                >
                  <span>Завантажити у сканер</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

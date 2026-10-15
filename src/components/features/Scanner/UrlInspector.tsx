'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, CheckCircle, XCircle, ChevronDown, ChevronRight, Shield } from 'lucide-react';

interface UrlInspectorProps {
  urls?: string[];
  ips?: string[];
  safeBrowsingMatches?: any[];
  rdapResults?: Record<string, any>;
  brandResults?: any[];
}

export const UrlInspector: React.FC<UrlInspectorProps> = ({
  urls = [],
  ips = [],
  safeBrowsingMatches = [],
  rdapResults = {},
  brandResults = [],
}) => {
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);

  if (!urls.length && !ips.length) return null;

  return (
    <div className="w-full mt-3 pt-3 border-t border-zinc-800/80 space-y-3 font-mono text-xs">
      {/* URLs section */}
      {urls.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>Аналіз URL-адрес (Safe Browsing та інфраструктура):</span>
            </div>
            <span className="text-[10px] text-cyan-400">
              Знайдено: {urls.length}
            </span>
          </div>

          <div className="space-y-1.5">
            {urls.map((url, idx) => {
              const badMatch = safeBrowsingMatches.find(
                (m) => m.threat?.url === url || m.threat?.url?.includes(url) || url.includes(m.threat?.url)
              );
              const isExpanded = expandedUrl === url;

              let urlObj: URL | null = null;
              try {
                urlObj = new URL(url);
              } catch (e) {
                // relative or malformed URL fallback
              }

              const host = urlObj ? urlObj.hostname : url.replace(/^https?:\/\//i, '').split('/')[0];
              const rdapInfo = rdapResults[host];
              const brandMatch = brandResults.find((b: any) => b.candidateDomain === host);

              return (
                <div
                  key={idx}
                  className={`rounded-lg border transition-all ${
                    isExpanded
                      ? 'bg-cyan-950/20 border-cyan-500/50'
                      : badMatch
                        ? 'bg-rose-950/20 border-rose-500/30'
                        : 'bg-zinc-900/30 border-zinc-800/70 hover:border-zinc-700'
                  }`}
                >
                  <div
                    onClick={() => setExpandedUrl(isExpanded ? null : url)}
                    className="flex items-center justify-between gap-3 p-2.5 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {badMatch ? (
                        <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      <span
                        className={`truncate text-xs ${
                          badMatch ? 'text-rose-400 font-semibold' : 'text-zinc-200'
                        }`}
                      >
                        {url}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {badMatch ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950/60 border border-rose-500/40 text-rose-400">
                          Загроза
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
                          Чистий
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Accordion Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-zinc-800/70 px-3 py-2.5 space-y-2 bg-zinc-950/40 text-[11px]"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <span className="text-zinc-500 block text-[10px]">Хост / протокол:</span>
                            <span className="text-cyan-400 break-all">
                              {urlObj ? `${urlObj.protocol}//${urlObj.hostname}` : host}
                            </span>
                          </div>

                          {rdapInfo && (
                            <div>
                              <span className="text-zinc-500 block text-[10px]">Вік домену (RDAP):</span>
                              <span className={rdapInfo.isCritical0Day || rdapInfo.isNewlyRegistered ? 'text-amber-400' : 'text-emerald-400'}>
                                {rdapInfo.ageDays !== null ? `${rdapInfo.ageDays} днів` : 'Невідомо'} ({rdapInfo.registrar || 'Реєстратор приховано'})
                              </span>
                            </div>
                          )}

                          {brandMatch && (
                            <div>
                              <span className="text-zinc-500 block text-[10px]">Захист брендів:</span>
                              <span className={brandMatch.isImpersonation ? 'text-rose-400' : 'text-emerald-400'}>
                                {brandMatch.isImpersonation ? `Підміна: ${brandMatch.targetBrand?.name}` : 'Легітимний ресурс'}
                              </span>
                            </div>
                          )}
                        </div>

                        {urlObj && urlObj.pathname && urlObj.pathname !== '/' && (
                          <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800">
                            <span className="text-zinc-500 block text-[10px] uppercase">Шлях (Path):</span>
                            <span className="text-zinc-200 break-all">{urlObj.pathname}</span>
                          </div>
                        )}

                        {urlObj && urlObj.search && (
                          <div className="p-2 rounded bg-amber-950/20 border border-amber-500/30">
                            <span className="text-amber-400 block text-[10px] uppercase">Параметри запиту:</span>
                            <span className="text-amber-200 break-all">{urlObj.search}</span>
                          </div>
                        )}

                        {badMatch && (
                          <div className="p-2 rounded bg-rose-950/30 border border-rose-500/40">
                            <span className="text-rose-400 block text-[10px] font-bold">Запис у базі загроз:</span>
                            <span className="text-rose-200 break-words">
                              {badMatch.threatType}: {badMatch.details || 'Шкідливий сайт'}
                            </span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* IPs section */}
      {ips.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-2 text-zinc-400">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>Перевірені IP-адреси:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {ips.map((ip, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900/60 border border-zinc-800 text-emerald-400 text-[11px]"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{ip}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

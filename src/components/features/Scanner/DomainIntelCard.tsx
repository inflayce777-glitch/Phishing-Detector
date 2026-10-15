'use client';
import React from 'react';
import { Building, Globe, ShieldAlert, CheckCircle, Clock } from 'lucide-react';

interface DomainIntelCardProps {
  brandResults?: any[];
  rdapResults?: Record<string, any>;
}

export const DomainIntelCard: React.FC<DomainIntelCardProps> = ({
  brandResults = [],
  rdapResults = {},
}) => {
  const hasBrands = brandResults && brandResults.length > 0;
  const hasRdap = rdapResults && Object.keys(rdapResults).length > 0;

  if (!hasBrands && !hasRdap) return null;

  return (
    <div className="space-y-3">
      {/* 1. Brand Impersonation & Typosquatting */}
      {hasBrands && (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-3.5 space-y-2.5">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs font-mono">
            <Building className="w-4 h-4 text-cyan-400" />
            <span>Ідентифікація брендів та захист від тайпосквотингу</span>
          </div>

          <div className="space-y-2">
            {brandResults.map((b: any, bIdx: number) => (
              <div key={bIdx} className="flex items-start gap-2.5 text-xs">
                {b.isImpersonation ? (
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <span
                    className={`font-semibold font-mono break-all ${
                      b.isImpersonation ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {b.candidateDomain}
                  </span>
                  <p className="text-zinc-400 text-[11px] mt-0.5 leading-relaxed">
                    {b.explanation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. ICANN RDAP Domain Age */}
      {hasRdap && (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-3.5 space-y-2.5">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs font-mono">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>Життєвий цикл та вік доменів (ICANN RDAP)</span>
          </div>

          <div className="space-y-2">
            {Object.entries(rdapResults).map(([dom, r]: [string, any], rIdx: number) => {
              const isBad = r.isCritical0Day || r.isNewlyRegistered;
              return (
                <div key={rIdx} className="flex items-start gap-2.5 text-xs">
                  {isBad ? (
                    <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-semibold font-mono break-all ${
                          isBad ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      >
                        {dom}
                      </span>
                      {r.ageDays !== null && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                          вік: {r.ageDays} днів
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-400 text-[11px] mt-0.5 leading-relaxed">
                      {r.details}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

'use client';
import React from 'react';
import { Fingerprint, ShieldCheck, ShieldAlert, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { SmartTooltip } from '@/components/ui/SmartTooltip/SmartTooltip';
import { EmailAuthResult } from '@/core/emailAuth';

interface EmailAuthCardProps {
  emailAuth?: EmailAuthResult | null;
}

export const EmailAuthCard: React.FC<EmailAuthCardProps> = ({ emailAuth }) => {
  if (!emailAuth || !emailAuth.hasHeaders) return null;

  const getSpfLabel = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'pass') return 'Пройдено';
    if (s === 'dns_active') return 'Захищено в DNS';
    if (s === 'fail') return 'Невдача';
    if (s === 'softfail') return "М'яка невдача";
    if (s === 'neutral') return 'Нейтрально';
    if (s === 'missing') return 'Відсутній у DNS';
    if (s === 'none') return 'Відсутній';
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Невідомо';
  };

  const getDkimLabel = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'pass') return 'Пройдено';
    if (s === 'dns_active') return 'Декларується';
    if (s === 'fail') return 'Невдача';
    if (s === 'none') return 'Відсутній';
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Невідомо';
  };

  const getDmarcLabel = (alignment: string, status?: string) => {
    const a = (alignment || '').toLowerCase();
    const s = (status || '').toLowerCase();
    if (s === 'dns_active') return 'Активно в DNS';
    if (a === 'aligned' || s === 'pass') return 'Співпадає';
    if (a === 'unaligned' || s === 'fail') return 'Невідповідність';
    if (s === 'missing') return 'Відсутній у DNS';
    if (a === 'unknown') return 'Невідомо';
    if (a === 'none') return 'Відсутній';
    return a ? a.charAt(0).toUpperCase() + a.slice(1) : 'Невідомо';
  };

  const isSpfGood = emailAuth.spf.status === 'pass' || emailAuth.spf.status === 'dns_active';
  const isSpfWarn = emailAuth.spf.status === 'softfail' || emailAuth.spf.status === 'neutral';
  const isDkimGood = emailAuth.dkim.status === 'pass' || emailAuth.dkim.status === 'dns_active';
  const isDmarcGood = emailAuth.dmarc.alignment === 'aligned' || emailAuth.dmarc.status === 'pass' || emailAuth.dmarc.status === 'dns_active';

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-3.5 flex flex-col gap-2.5 overflow-visible">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
        <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs font-mono">
          <Fingerprint className="w-4 h-4 text-cyan-400" />
          <span>Автентичність відправника (RFC 7208 / 6376 / 7489)</span>
        </div>

        <SmartTooltip
          variant="gray"
          content={
            emailAuth.isSpoofed ? (
              <span className="text-rose-400 font-medium leading-relaxed block text-xs">
                Увага! Сервер відправника або цифровий підпис не відповідає заявленому домену. Виявлено ознаки підміни адреси (спуфінгу).
              </span>
            ) : (
              <span className="text-emerald-400 font-medium leading-relaxed block text-xs">
                Лист успішно пройшов комплексну перевірку автентичності. Всі цифрові підписи валідні, ознак підміни (спуфінгу) не виявлено.
              </span>
            )
          }
        >
          <span
            className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold inline-flex items-center gap-1.5 ${
              emailAuth.isSpoofed
                ? 'bg-rose-950/40 border-rose-500/40 text-rose-400'
                : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
            }`}
          >
            {emailAuth.isSpoofed ? (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Виявлено спуфінг</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Верифіковано</span>
              </>
            )}
          </span>
        </SmartTooltip>
      </div>

      {/* Badges Row */}
      <div className="flex gap-2 flex-wrap items-center pt-1 font-mono text-[11px]">
        {/* SPF */}
        <SmartTooltip
          content={
            <div className="text-xs">
              <div className="font-bold text-cyan-400 mb-1 flex items-center gap-1.5">
                <Fingerprint className="w-3.5 h-3.5" />
                SPF (Sender Policy Framework)
              </div>
              <div className="text-zinc-300 mb-2 leading-relaxed">
                {emailAuth.spf.details || 'Міжнародний поштовий стандарт (RFC 7208). Перевіряє у DNS-записах домену, чи має сервер-відправник легітимне право надсилати листи від цього імені.'}
              </div>
              {emailAuth.spf.record && (
                <div className="text-[10px] bg-zinc-950 p-1.5 rounded text-cyan-300 font-mono mb-2 break-all">
                  DNS: {emailAuth.spf.record}
                </div>
              )}
              <div className="text-[10px] text-zinc-400 border-t border-zinc-800 pt-1 flex justify-between">
                <span>Результат: <strong className={isSpfGood ? 'text-emerald-400' : isSpfWarn ? 'text-amber-400' : 'text-rose-400'}>{getSpfLabel(emailAuth.spf.status)}</strong></span>
                <span>RFC 7208</span>
              </div>
            </div>
          }
        >
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors cursor-help ${
              isSpfGood
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300 hover:border-emerald-400'
                : isSpfWarn
                  ? 'bg-amber-950/30 border-amber-500/30 text-amber-300 hover:border-amber-400'
                  : 'bg-rose-950/30 border-rose-500/30 text-rose-300 hover:border-rose-400'
            }`}
          >
            {isSpfGood ? (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span>SPF: {getSpfLabel(emailAuth.spf.status)}</span>
            <Info className="w-3 h-3 text-cyan-400 opacity-70" />
          </span>
        </SmartTooltip>

        {/* DKIM */}
        <SmartTooltip
          content={
            <div className="text-xs">
              <div className="font-bold text-cyan-400 mb-1 flex items-center gap-1.5">
                <Fingerprint className="w-3.5 h-3.5" />
                DKIM (DomainKeys Identified Mail)
              </div>
              <div className="text-zinc-300 mb-2 leading-relaxed">
                {emailAuth.dkim.details || 'Криптографічний цифровий підпис листа (RFC 6376). Гарантує цілісність вмісту і доводить, що лист не був перехоплений або змінений зловмисниками в дорозі.'}
              </div>
              <div className="text-[10px] text-zinc-400 border-t border-zinc-800 pt-1 flex justify-between">
                <span>Результат: <strong className={isDkimGood ? 'text-emerald-400' : 'text-rose-400'}>{getDkimLabel(emailAuth.dkim.status)}</strong></span>
                <span>RFC 6376</span>
              </div>
            </div>
          }
        >
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors cursor-help ${
              isDkimGood
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300 hover:border-emerald-400'
                : 'bg-rose-950/30 border-rose-500/30 text-rose-300 hover:border-rose-400'
            }`}
          >
            {isDkimGood ? (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span>DKIM: {getDkimLabel(emailAuth.dkim.status)}</span>
            <Info className="w-3 h-3 text-cyan-400 opacity-70" />
          </span>
        </SmartTooltip>

        {/* DMARC */}
        <SmartTooltip
          content={
            <div className="text-xs">
              <div className="font-bold text-cyan-400 mb-1 flex items-center gap-1.5">
                <Fingerprint className="w-3.5 h-3.5" />
                DMARC (Domain-based Authentication)
              </div>
              <div className="text-zinc-300 mb-2 leading-relaxed">
                {emailAuth.dmarc.details || "Політика поштової відповідності (RFC 7489). Пов'язує SPF і DKIM з адресою у заголовку 'From', захищаючи від фішингової підміни імені відомих брендів."}
              </div>
              {emailAuth.dmarc.record && (
                <div className="text-[10px] bg-zinc-950 p-1.5 rounded text-cyan-300 font-mono mb-2 break-all">
                  DNS: {emailAuth.dmarc.record}
                </div>
              )}
              <div className="text-[10px] text-zinc-400 border-t border-zinc-800 pt-1 flex justify-between">
                <span>Результат: <strong className={isDmarcGood ? 'text-emerald-400' : 'text-rose-400'}>{getDmarcLabel(emailAuth.dmarc.alignment, emailAuth.dmarc.status)}</strong></span>
                <span>RFC 7489</span>
              </div>
            </div>
          }
        >
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors cursor-help ${
              isDmarcGood
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300 hover:border-emerald-400'
                : 'bg-rose-950/30 border-rose-500/30 text-rose-300 hover:border-rose-400'
            }`}
          >
            {isDmarcGood ? (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span>DMARC: {getDmarcLabel(emailAuth.dmarc.alignment, emailAuth.dmarc.status)}</span>
            <Info className="w-3 h-3 text-cyan-400 opacity-70" />
          </span>
        </SmartTooltip>
      </div>

      {emailAuth.spoofingReason && (
        <div className="text-rose-400 text-xs italic mt-1 bg-rose-950/20 border border-rose-500/20 p-2 rounded">
          {emailAuth.spoofingReason}
        </div>
      )}
    </div>
  );
};

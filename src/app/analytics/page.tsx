'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  ShieldAlert, ShieldCheck, AlertTriangle, Activity, 
  Globe, Calendar, ArrowLeft, RefreshCw, Filter, 
  ExternalLink, Layers, Sparkles, Terminal, Info, 
  ChevronRight, Database, TrendingUp, Search
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Container } from '@/components/layout/Container';
import { Panel } from '@/components/ui/Panel';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

interface AnalyticsData {
  stats: {
    totalScans: number;
    phishingCount: number;
    suspiciousCount: number;
    safeCount: number;
    spamCount: number;
    avgThreatScore: number;
    phishingPercentage: number;
  };
  dailyTimeline: Array<{
    date: string;
    dateLabel: string;
    safe: number;
    suspicious: number;
    phishing: number;
    total: number;
  }>;
  topTriggers: Array<{
    trigger: string;
    count: number;
    avgScore: number;
  }>;
  topDomains: Array<{
    domain: string;
    count: number;
    isMalicious: boolean;
  }>;
  recentIncidents: Array<{
    id: string;
    threatScore: number;
    verdictLabel: string;
    scanType: string;
    senderEmail?: string;
    targetUrl?: string;
    subject?: string;
    textSnippet?: string;
    triggers?: Array<{ trigger: string; score: number }>;
    hasObfuscation?: boolean;
    createdAt: string;
  }>;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [range, setRange] = useState<'7d' | '30d' | 'all'>('7d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [incidentFilter, setIncidentFilter] = useState<'all' | 'phishing' | 'suspicious' | 'safe'>('all');

  const fetchAnalytics = async (r = range) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?range=${r}&_t=${Date.now()}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (e) {
      console.error('Failed to load analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(range);
  }, [range]);

  const stats = data?.stats || {
    totalScans: 0,
    phishingCount: 0,
    suspiciousCount: 0,
    safeCount: 0,
    spamCount: 0,
    avgThreatScore: 0,
    phishingPercentage: 0,
  };

  const timeline = data?.dailyTimeline || [];
  const maxDayTotal = Math.max(...timeline.map(d => d.total), 1);

  const filteredIncidents = (data?.recentIncidents || []).filter(inc => {
    if (incidentFilter === 'phishing') return inc.threatScore > 70 || inc.verdictLabel === 'phishing';
    if (incidentFilter === 'suspicious') return inc.threatScore > 40 && inc.threatScore <= 70;
    if (incidentFilter === 'safe') return inc.threatScore <= 40;
    return true;
  });

  return (
    <Container className="fx-console min-h-screen pb-16">
      <Header>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 px-3 py-1 bg-cyan-950/20 transition-all rounded-sm font-mono"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Сканер
          </button>
          <button 
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700 px-3 py-1 bg-zinc-900/40 transition-all rounded-sm font-mono"
          >
            Інбокс
          </button>
        </div>
      </Header>

      {/* Top Banner & Range Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold tracking-tight text-white m-0">
              Аналітичний центр розвідки кіберзагроз
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1 font-mono m-0">
            Багатогранна статистика атак, семантичних тригерів та репутації інфраструктури
          </p>
        </div>

        {/* Range Selector */}
        <div className="flex items-center gap-1 p-1 rounded-md bg-zinc-950/80 border border-cyan-500/20 font-mono text-xs">
          <button
            onClick={() => setRange('7d')}
            className={`px-3 py-1.5 rounded transition-all ${range === '7d' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-[0_0_10px_rgba(108,229,220,0.2)]' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            7 днів
          </button>
          <button
            onClick={() => setRange('30d')}
            className={`px-3 py-1.5 rounded transition-all ${range === '30d' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-[0_0_10px_rgba(108,229,220,0.2)]' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            30 днів
          </button>
          <button
            onClick={() => setRange('all')}
            className={`px-3 py-1.5 rounded transition-all ${range === 'all' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-[0_0_10px_rgba(108,229,220,0.2)]' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Увесь час
          </button>
          <button
            onClick={() => fetchAnalytics(range)}
            title="Оновити статистику"
            className="p-1.5 text-zinc-400 hover:text-cyan-400 transition-colors ml-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 1. HUD Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Total Scans */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative p-4 rounded-lg bg-zinc-950/70 border border-cyan-500/30 overflow-hidden shadow-[0_0_15px_rgba(108,229,220,0.06)]"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
            <span>Всього перевірок</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2">
            {stats.totalScans}
          </div>
          <div className="text-[11px] text-zinc-500 font-mono mt-1 flex items-center gap-1.5">
            <span className="text-cyan-400">●</span> Моніторинг активний
          </div>
        </motion.div>

        {/* Card 2: Phishing Detected */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="relative p-4 rounded-lg bg-zinc-950/70 border border-rose-500/40 overflow-hidden shadow-[0_0_20px_rgba(255,51,102,0.1)]"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
            <span>Цільовий фішинг</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-2 flex items-baseline gap-2">
            <span>{stats.phishingCount}</span>
            <span className="text-xs text-rose-500/80 font-normal">({stats.phishingPercentage}%)</span>
          </div>
          <div className="text-[11px] text-rose-400/70 font-mono mt-1">
            Критичний рівень небезпеки
          </div>
        </motion.div>

        {/* Card 3: Suspicious & Spam */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="relative p-4 rounded-lg bg-zinc-950/70 border border-amber-500/30 overflow-hidden shadow-[0_0_15px_rgba(245,158,11,0.06)]"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
            <span>Підозріло / Спам</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-2">
            {stats.suspiciousCount + stats.spamCount}
          </div>
          <div className="text-[11px] text-zinc-500 font-mono mt-1">
            {stats.spamCount} спам-розсилок, {stats.suspiciousCount} підозрілих
          </div>
        </motion.div>

        {/* Card 4: Average Threat Score */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="relative p-4 rounded-lg bg-zinc-950/70 border border-emerald-500/30 overflow-hidden shadow-[0_0_15px_rgba(16,185,129,0.06)]"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-zinc-400 text-xs font-mono">
            <span>Середній ризик</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2 flex items-baseline gap-1">
            <span>{stats.avgThreatScore}</span>
            <span className="text-xs text-zinc-500 font-normal">/ 100</span>
          </div>
          <div className="text-[11px] text-emerald-400 font-mono mt-1">
            {stats.safeCount} верифікованих чистих листів
          </div>
        </motion.div>
      </div>

      {/* 2. Charts Section: Daily Activity & Triggers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Daily Timeline Bar Chart (2 columns) */}
        <div className="lg:col-span-2">
          <Panel title="Динаміка сканувань та рівнів загроз по днях">
            <div className="p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400 border-b border-zinc-800/80 pb-2">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Фішинг
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Підозріло
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Безпечно
                  </span>
                </div>
                <span>Період: {range === '7d' ? 'Останній тиждень' : range === '30d' ? '30 днів' : '90 днів'}</span>
              </div>

              {/* Chart Bars */}
              <div className="h-48 flex items-end gap-2 pt-6 pb-2 px-1">
                {timeline.map((day, idx) => {
                  const hTotal = Math.max((day.total / maxDayTotal) * 100, 8);
                  const pPct = day.total > 0 ? (day.phishing / day.total) * 100 : 0;
                  const sPct = day.total > 0 ? (day.suspicious / day.total) * 100 : 0;
                  const okPct = day.total > 0 ? (day.safe / day.total) * 100 : 0;

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative">
                      {/* Tooltip on hover */}
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center bg-zinc-950 border border-cyan-500/40 text-[10px] font-mono px-2 py-1 rounded shadow-xl z-20 pointer-events-none whitespace-nowrap">
                        <span className="text-cyan-300 font-bold">{day.dateLabel}</span>
                        <span className="text-zinc-300">Всього: {day.total} (⛔{day.phishing} ⚠️{day.suspicious} ✓{day.safe})</span>
                      </div>

                      {/* Stacked bar */}
                      <div 
                        className="w-full max-w-[28px] rounded-t overflow-hidden flex flex-col justify-end transition-all group-hover:brightness-125"
                        style={{ height: `${hTotal}%` }}
                      >
                        {pPct > 0 && (
                          <div style={{ height: `${pPct}%` }} className="bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
                        )}
                        {sPct > 0 && (
                          <div style={{ height: `${sPct}%` }} className="bg-amber-500" />
                        )}
                        {okPct > 0 && (
                          <div style={{ height: `${okPct}%` }} className="bg-emerald-500" />
                        )}
                      </div>

                      {/* Date label */}
                      <span className="text-[10px] font-mono text-zinc-500 group-hover:text-cyan-400 transition-colors">
                        {day.dateLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>
        </div>

        {/* Severity Distribution Donut / Ring (1 column) */}
        <div>
          <Panel title="Розподіл вердиктів безпеки">
            <div className="p-4 flex flex-col items-center justify-center gap-4">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  {/* Background Circle */}
                  <path
                    className="text-zinc-800"
                    strokeWidth="3.8"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Phishing Segment */}
                  {stats.totalScans > 0 && (
                    <path
                      className="text-rose-500"
                      strokeDasharray={`${(stats.phishingCount / stats.totalScans) * 100}, 100`}
                      strokeWidth="3.8"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  )}
                </svg>
                <div className="absolute flex flex-col items-center font-mono">
                  <span className="text-xl font-bold text-white">{stats.totalScans}</span>
                  <span className="text-[10px] text-zinc-400">сканів</span>
                </div>
              </div>

              <div className="w-full flex flex-col gap-2 font-mono text-xs">
                <div className="flex items-center justify-between p-1.5 rounded bg-zinc-950/50 border border-rose-500/20">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> Фішинг (Критично)
                  </span>
                  <span className="text-rose-400 font-bold">{stats.phishingCount}</span>
                </div>

                <div className="flex items-center justify-between p-1.5 rounded bg-zinc-950/50 border border-amber-500/20">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Підозріло / Спам
                  </span>
                  <span className="text-amber-400 font-bold">{stats.suspiciousCount + stats.spamCount}</span>
                </div>

                <div className="flex items-center justify-between p-1.5 rounded bg-zinc-950/50 border border-emerald-500/20">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Верифіковано (Чисто)
                  </span>
                  <span className="text-emerald-400 font-bold">{stats.safeCount}</span>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {/* 3. Top Triggers & Detected Domains */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Semantic Triggers */}
        <Panel title="Найбільш повторювані семантичні тригери (NLP/Heuristics)">
          <div className="p-4 flex flex-col gap-3">
            {(data?.topTriggers || []).length > 0 ? (
              (data?.topTriggers || []).map((t, idx) => {
                const maxTrigCount = Math.max(...(data?.topTriggers || []).map(x => x.count), 1);
                const pct = (t.count / maxTrigCount) * 100;

                return (
                  <div key={idx} className="flex flex-col gap-1 font-mono text-xs">
                    <div className="flex items-center justify-between text-zinc-300">
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-400 font-bold">#{idx + 1}</span>
                        <span>{t.trigger}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-400">
                        <span>{t.count} спрацювань</span>
                        <span className="text-amber-400 font-semibold">({t.avgScore}%)</span>
                      </div>
                    </div>
                    {/* Glowing progress bar */}
                    <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-cyan-500 to-amber-500 rounded-full shadow-[0_0_8px_rgba(108,229,220,0.4)]"
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-zinc-500 text-xs italic py-4 text-center">
                Немає зареєстрованих тригерів у вибраному діапазоні
              </div>
            )}
          </div>
        </Panel>

        {/* Top Flagged Domains & Brands */}
        <Panel title="Підозрілі домени та імітація брендів (IoC)">
          <div className="p-4 flex flex-col gap-2.5">
            {(data?.topDomains || []).length > 0 ? (
              (data?.topDomains || []).map((d, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800 hover:border-cyan-500/30 transition-all font-mono text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe className={`w-4 h-4 shrink-0 ${d.isMalicious ? 'text-rose-400' : 'text-cyan-400'}`} />
                    <span className="text-white truncate font-medium">{d.domain}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-zinc-400 text-[11px]">{d.count} разів</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] ${d.isMalicious ? 'bg-rose-950/60 text-rose-300 border border-rose-500/40' : 'bg-zinc-800 text-zinc-300'}`}>
                      {d.isMalicious ? '⛔ Блоковано' : '⚠️ Моніторинг'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-zinc-500 text-xs italic py-4 text-center">
                Підозрілих доменів не зафіксовано
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* 4. Recent Incidents Audit Feed */}
      <Panel 
        title="Журнал останніх криміналістичних експертиз"
        headerRight={
          <div className="flex items-center gap-1 font-mono text-[11px]">
            <button
              onClick={() => setIncidentFilter('all')}
              className={`px-2 py-1 rounded transition-all ${incidentFilter === 'all' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Всі
            </button>
            <button
              onClick={() => setIncidentFilter('phishing')}
              className={`px-2 py-1 rounded transition-all ${incidentFilter === 'phishing' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Фішинг
            </button>
            <button
              onClick={() => setIncidentFilter('suspicious')}
              className={`px-2 py-1 rounded transition-all ${incidentFilter === 'suspicious' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Підозрілі
            </button>
            <button
              onClick={() => setIncidentFilter('safe')}
              className={`px-2 py-1 rounded transition-all ${incidentFilter === 'safe' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Чисті
            </button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-[10px] uppercase bg-zinc-950/40">
                <th className="py-2.5 px-3">Дата / Час</th>
                <th className="py-2.5 px-3">Тип</th>
                <th className="py-2.5 px-3">Відправник / Ціль</th>
                <th className="py-2.5 px-3">Семантичні тригери</th>
                <th className="py-2.5 px-3 text-right">Ризик</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredIncidents.map((inc) => {
                const isPhish = inc.threatScore > 70;
                const isWarn = inc.threatScore > 40 && !isPhish;
                const d = new Date(inc.createdAt);
                const timeStr = d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

                return (
                  <tr 
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc)}
                    className="hover:bg-cyan-950/20 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 text-zinc-400 text-[11px] whitespace-nowrap">
                      {timeStr}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-900 border border-zinc-800 text-zinc-300 uppercase">
                        {inc.scanType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-white max-w-[200px] truncate">
                      {inc.senderEmail || inc.targetUrl || 'Текстове повідомлення'}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap gap-1 max-w-[260px]">
                        {(inc.triggers || []).slice(0, 2).map((t, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-900/90 text-amber-300 border border-amber-500/30">
                            {t.trigger}
                          </span>
                        ))}
                        {(inc.triggers || []).length > 2 && (
                          <span className="text-[10px] text-zinc-500">+{inc.triggers!.length - 2}</span>
                        )}
                        {(!inc.triggers || inc.triggers.length === 0) && (
                          <span className="text-[10px] text-emerald-400">✓ Чисто</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        isPhish ? 'bg-rose-950/70 text-rose-300 border border-rose-500/40' :
                        isWarn ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40' :
                        'bg-emerald-950/50 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {inc.threatScore}/100
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <Modal 
          isOpen={Boolean(selectedIncident)} 
          onClose={() => setSelectedIncident(null)}
          title={`Деталізація інциденту #${selectedIncident.id}`}
        >
          <div className="space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between p-3 rounded bg-zinc-950 border border-zinc-800">
              <div>
                <div className="text-zinc-500 text-[10px] uppercase">Оцінка загрози</div>
                <div className="text-lg font-bold text-white mt-0.5">
                  {selectedIncident.threatScore} / 100
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded text-xs uppercase font-semibold ${
                selectedIncident.threatScore > 70 ? 'bg-rose-950 text-rose-400 border border-rose-500/40' :
                selectedIncident.threatScore > 40 ? 'bg-amber-950 text-amber-400 border border-amber-500/40' :
                'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
              }`}>
                {selectedIncident.threatScore > 70 ? 'Критичний фішинг' : selectedIncident.threatScore > 40 ? 'Підозріло' : 'Безпечно'}
              </span>
            </div>

            <div>
              <div className="text-zinc-500 text-[10px] uppercase mb-1">Відправник / Цільовий URL:</div>
              <div className="p-2 rounded bg-zinc-900 border border-zinc-800 text-cyan-300 break-all">
                {selectedIncident.senderEmail || selectedIncident.targetUrl || 'Не вказано'}
              </div>
            </div>

            {selectedIncident.textSnippet && (
              <div>
                <div className="text-zinc-500 text-[10px] uppercase mb-1">Фрагмент тексту:</div>
                <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px] leading-relaxed max-h-36 overflow-y-auto cyber-scrollbar">
                  {selectedIncident.textSnippet}
                </div>
              </div>
            )}

            {selectedIncident.triggers && selectedIncident.triggers.length > 0 && (
              <div>
                <div className="text-zinc-500 text-[10px] uppercase mb-1">Виявлені тригери:</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedIncident.triggers.map((t: any, i: number) => (
                    <span key={i} className="px-2 py-0.5 rounded text-[10px] bg-amber-950/40 text-amber-300 border border-amber-500/40">
                      {t.trigger} ({(Number(t.score) * 100).toFixed(0)}%)
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedIncident(null)}
                className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-white transition-all text-xs"
              >
                Закрити
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Container>
  );
}

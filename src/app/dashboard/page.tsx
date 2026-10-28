"use client";

import { useEffect, useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Mail, RefreshCw, ArrowLeft, Search, Trash2, ShieldCheck, 
  ShieldAlert, AlertTriangle, Clock, Filter, ArrowUpDown, 
  CheckCircle, ChevronLeft, ChevronRight, Inbox, Eye, Send, Copy
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface EmailRecord {
  id: string;
  messageId: string;
  senderEmail: string;
  sender?: string;
  subject: string | null;
  textBody: string;
  oracleScore: number | null;
  oracleLabel: string | null;
  status: 'PENDING' | 'ANALYZED' | 'DELETED';
  createdAt: string;
}

interface CategoryCounts {
  all: number;
  safe: number;
  phishing: number;
  spam: number;
  pending: number;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Filters & Pagination State
  const [activeFilter, setActiveFilter] = useState<'all' | 'safe' | 'phishing' | 'spam' | 'pending'>('all');
  const [sortBy, setSortBy] = useState<string>('date_desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [counts, setCounts] = useState<CategoryCounts>({ all: 0, safe: 0, phishing: 0, spam: 0, pending: 0 });
  const [systemEmail, setSystemEmail] = useState<string>(
    process.env.NEXT_PUBLIC_SYSTEM_EMAIL || "inflayce777@gmail.com"
  );
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Deletion Modal State
  const [emailToDelete, setEmailToDelete] = useState<EmailRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1); // reset to page 1 on new search
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchInbox = async (targetPage = page, filter = activeFilter, sort = sortBy) => {
    try {
      const url = `/api/inbox?page=${targetPage}&limit=${limit}&query=${encodeURIComponent(debouncedQuery)}&filter=${filter}&sortBy=${sort}&_t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setEmails(data.emails || []);
        setTotalPages(data.pagination.pages || 1);
        setTotalCount(data.pagination.total || 0);
        if (data.counts) {
          setCounts(data.counts);
        }
        if (data.systemEmail) {
          setSystemEmail(data.systemEmail);
        }
      }
    } catch (error) {
      console.error("Помилка завантаження поштової скриньки:", error);
    } finally {
      setLoading(false);
    }
  };

  const syncEmails = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/inbox/sync", { 
        method: "POST",
        headers: { 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();
      if (data.success) {
        setPage(1);
        await fetchInbox(1, activeFilter, sortBy);
      }
    } catch (error) {
      console.error("Помилка синхронізації:", error);
    } finally {
      setSyncing(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!emailToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/inbox/${emailToDelete.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setEmailToDelete(null);
        await fetchInbox(page, activeFilter, sortBy);
      }
    } catch (error) {
      console.error("Помилка видалення:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFilterChange = (newFilter: 'all' | 'safe' | 'phishing' | 'spam' | 'pending') => {
    setActiveFilter(newFilter);
    setPage(1);
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    } else if (status === "authenticated") {
      fetchInbox(page, activeFilter, sortBy);
    }
  }, [status, router, page, activeFilter, sortBy, debouncedQuery, limit]);

  if (status === "loading" || (loading && emails.length === 0)) {
    return (
      <div className="min-h-screen bg-[#09090b] text-cyan-500 flex items-center justify-center font-mono animate-pulse">
        Завантаження поштової скриньки...
      </div>
    );
  }

  const startRecord = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalCount);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300 font-mono p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-zinc-800 pb-5 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="w-10 h-10 rounded-lg bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center">
                <Mail className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Поштова скринька та сховище листів
                </h1>
                <p className="text-xs text-zinc-400">
                  Скринька моніторингу: <span className="text-cyan-400">{session?.user?.email}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <button 
              onClick={syncEmails}
              disabled={syncing}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 text-xs bg-zinc-900 border border-zinc-700 hover:border-cyan-500 text-zinc-200 px-4 py-2 transition-all rounded-md disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-cyan-400' : ''}`} />
              <span>{syncing ? 'Синхронізація...' : 'Оновити пошту'}</span>
            </button>

            <button 
              onClick={() => router.push("/")}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/40 hover:border-cyan-400 px-4 py-2 bg-cyan-950/20 transition-all rounded-md cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>До сканера</span>
            </button>
          </div>
        </header>

        {/* Banner with system email forwarding and direct send button */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-zinc-950/70 to-zinc-950/90 border border-cyan-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-[0_0_20px_rgba(108,229,220,0.06)]">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <Send className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                <span>Адреса для пересилання підозрілих листів</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  Авто-перевірка
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed max-w-2xl">
                Перешліть підозрілий лист зі своєї поштової програми на цю адресу. Система автоматично збереже його у сховищі, верифікує цифрові підписи (SPF/DKIM/DMARC) та проведе криміналістичну експертизу.
              </p>
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <span className="text-xs font-mono font-bold text-cyan-300 bg-black/60 px-2.5 py-1 rounded border border-cyan-500/30 select-all">
                  {systemEmail}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(systemEmail);
                    setCopiedEmail(true);
                    setTimeout(() => setCopiedEmail(false), 2000);
                  }}
                  className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 px-2.5 py-1 rounded border border-zinc-700 transition-all cursor-pointer"
                  title="Скопіювати адресу в буфер обміну"
                >
                  <Copy className="w-3 h-3 text-cyan-400" />
                  <span>{copiedEmail ? 'Скопійовано!' : 'Копіювати адресу'}</span>
                </button>
              </div>
            </div>
          </div>

          <a
            href={`mailto:${systemEmail}?subject=Перевірка підозрілого листа`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 hover:text-white border border-cyan-500/40 hover:border-cyan-300 font-semibold text-xs tracking-wide transition-all shadow-[0_0_12px_rgba(108,229,220,0.2)] no-underline whitespace-nowrap self-stretch md:self-center justify-center cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-cyan-400" />
            <span>Надіслати лист на перевірку</span>
          </a>
        </div>

        {/* Filter Pills and Quick Stats */}
        <div className="space-y-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800/80 pb-3">
            <button
              onClick={() => handleFilterChange('all')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all border ${
                activeFilter === 'all'
                  ? 'bg-zinc-800 border-zinc-600 text-white font-semibold'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <Inbox className="w-3.5 h-3.5 text-zinc-400" />
              <span>Усі листи</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-700/60 text-zinc-300">
                {counts.all}
              </span>
            </button>

            <button
              onClick={() => handleFilterChange('safe')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all border ${
                activeFilter === 'safe'
                  ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300 font-semibold shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-emerald-300 hover:border-emerald-500/30'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Безпечні</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-900/40 text-emerald-400">
                {counts.safe}
              </span>
            </button>

            <button
              onClick={() => handleFilterChange('phishing')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all border ${
                activeFilter === 'phishing'
                  ? 'bg-rose-950/50 border-rose-500/50 text-rose-300 font-semibold shadow-[0_0_12px_rgba(244,63,94,0.15)]'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-rose-300 hover:border-rose-500/30'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Фішинг</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-900/40 text-rose-400">
                {counts.phishing}
              </span>
            </button>

            <button
              onClick={() => handleFilterChange('spam')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all border ${
                activeFilter === 'spam'
                  ? 'bg-amber-950/50 border-amber-500/50 text-amber-300 font-semibold shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-amber-300 hover:border-amber-500/30'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Спам</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-900/40 text-amber-400">
                {counts.spam}
              </span>
            </button>

            <button
              onClick={() => handleFilterChange('pending')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all border ${
                activeFilter === 'pending'
                  ? 'bg-cyan-950/50 border-cyan-500/50 text-cyan-300 font-semibold shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-cyan-300 hover:border-cyan-500/30'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Очікують перевірки</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-900/40 text-cyan-400">
                {counts.pending}
              </span>
            </button>
          </div>

          {/* Search Bar & Sorters Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Пошук за темою, відправником або змістом..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-zinc-900/80 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end text-xs">
              {/* Sort Order Selector */}
              <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800 px-2.5 py-1.5 rounded-lg">
                <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent text-zinc-300 focus:outline-none text-xs cursor-pointer"
                >
                  <option value="date_desc" className="bg-zinc-900 text-white">Найновіші спочатку</option>
                  <option value="date_asc" className="bg-zinc-900 text-white">Найстаріші спочатку</option>
                  <option value="risk_desc" className="bg-zinc-900 text-white">Найвищий ризик</option>
                  <option value="risk_asc" className="bg-zinc-900 text-white">Найнижчий ризик</option>
                </select>
              </div>

              {/* Page size limit */}
              <div className="flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800 px-2.5 py-1.5 rounded-lg">
                <span className="text-zinc-500 text-[11px]">По:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-transparent text-zinc-300 focus:outline-none text-xs cursor-pointer"
                >
                  <option value={10} className="bg-zinc-900 text-white">10</option>
                  <option value={25} className="bg-zinc-900 text-white">25</option>
                  <option value={50} className="bg-zinc-900 text-white">50</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Emails List */}
        {emails.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/40 p-6 space-y-3">
            {searchQuery || activeFilter !== 'all' ? (
              <>
                <Search className="w-12 h-12 text-zinc-600 mx-auto" />
                <h3 className="text-base font-semibold text-zinc-300">
                  За обраними фільтрами листів не знайдено
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Спробуйте змінити фільтр або очистити пошуковий запит
                </p>
                <button
                  onClick={() => {
                    setActiveFilter('all');
                    setSearchQuery('');
                  }}
                  className="mt-2 text-xs text-cyan-400 hover:underline"
                >
                  Скинути всі фільтри
                </button>
              </>
            ) : (
              <>
                <Mail className="w-12 h-12 text-zinc-600 mx-auto" />
                <h3 className="text-base font-semibold text-zinc-300">
                  Поштова скринька порожня
                </h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
                  Перешліть будь-який підозрілий лист на пошту моніторингу або скористайтеся прямим аналізом у сканері.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {emails.map((email) => {
              const isPhish = email.oracleLabel === 'phishing' || (!email.oracleLabel && (email.oracleScore || 0) > 0.6);
              const isSpam = email.oracleLabel === 'spam';
              const isSafe = email.status === 'ANALYZED' && !isPhish && !isSpam;

              const borderHighlight = email.status === 'PENDING'
                ? 'border-l-4 border-l-cyan-500'
                : isPhish
                  ? 'border-l-4 border-l-rose-500'
                  : isSpam
                    ? 'border-l-4 border-l-amber-500'
                    : 'border-l-4 border-l-emerald-500';

              return (
                <div 
                  key={email.id} 
                  className={`bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between transition-all hover:border-zinc-700 hover:shadow-lg ${borderHighlight}`}
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Status & Date Row */}
                    <div className="flex items-center gap-3 flex-wrap text-xs">
                      <span className="text-zinc-500 text-[11px]">
                        {new Date(email.createdAt).toLocaleString('uk-UA')}
                      </span>

                      {email.status === 'PENDING' ? (
                        <Badge variant="info" size="sm" pulse icon={<Clock className="w-3 h-3" />}>
                          Очікує аналізу
                        </Badge>
                      ) : isPhish ? (
                        <Badge variant="danger" size="sm" icon={<ShieldAlert className="w-3 h-3" />}>
                          Фішинг {email.oracleScore !== null ? `(${Math.round(email.oracleScore * 100)}%)` : ''}
                        </Badge>
                      ) : isSpam ? (
                        <Badge variant="warning" size="sm" icon={<AlertTriangle className="w-3 h-3" />}>
                          Спам {email.oracleScore !== null ? `(${Math.round(email.oracleScore * 100)}%)` : ''}
                        </Badge>
                      ) : (
                        <Badge variant="safe" size="sm" icon={<ShieldCheck className="w-3 h-3" />}>
                          Безпечно
                        </Badge>
                      )}
                    </div>

                    {/* Subject */}
                    <h3 className="text-sm sm:text-base font-semibold text-white truncate">
                      {email.subject || "Без теми"}
                    </h3>

                    {/* Sender */}
                    <p className="text-xs text-zinc-400 truncate">
                      <span className="text-zinc-500">Відправник: </span>
                      <span className="text-cyan-400">{email.senderEmail || email.sender}</span>
                    </p>

                    {/* Snippet */}
                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed font-sans">
                      {email.textBody}
                    </p>
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center gap-2 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-zinc-800/80">
                    {email.status === 'PENDING' ? (
                      <Button
                        variant="primary"
                        onClick={() => router.push(`/?emailId=${email.id}`)}
                        className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 text-xs py-2 px-4"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>Аналіз</span>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/?emailId=${email.id}`)}
                        className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 text-xs py-2 px-3 border-zinc-700 hover:border-cyan-400 text-zinc-200"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Звіт</span>
                      </Button>
                    )}

                    <button
                      onClick={() => setEmailToDelete(email)}
                      className="p-2 rounded-md border border-zinc-800 hover:border-rose-500/40 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 transition-all"
                      title="Видалити лист зі скриньки"
                      aria-label="Видалити"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-zinc-800 text-xs">
              <div className="text-zinc-500 text-[11px]">
                Показано <span className="text-white font-medium">{startRecord}–{endRecord}</span> з{" "}
                <span className="text-white font-medium">{totalCount}</span> листів
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="p-2 border border-zinc-800 rounded-md text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    aria-label="Попередня сторінка"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {/* Page numbers */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .map((p, idx, arr) => {
                      const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                      return (
                        <div key={p} className="flex items-center">
                          {showEllipsis && <span className="px-1 text-zinc-600">...</span>}
                          <button
                            onClick={() => setPage(p)}
                            className={`w-8 h-8 rounded-md text-xs font-mono transition-all border ${
                              p === page
                                ? 'bg-cyan-950/50 border-cyan-500/60 text-cyan-300 font-bold shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                                : 'border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 bg-zinc-900/40'
                            }`}
                          >
                            {p}
                          </button>
                        </div>
                      );
                    })}

                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="p-2 border border-zinc-800 rounded-md text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    aria-label="Наступна сторінка"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Delete Confirmation Modal using Reusable Modal */}
      <Modal
        isOpen={Boolean(emailToDelete)}
        onClose={() => setEmailToDelete(null)}
        title="Видалення листа"
        description="Підтвердіть видалення обраного листа зі сховища скриньки"
        icon={<AlertTriangle className="w-5 h-5 text-rose-400" />}
        maxWidth="md"
        footer={
          <>
            <button
              onClick={() => setEmailToDelete(null)}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800/80 border border-zinc-700 rounded-md transition"
            >
              Скасувати
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 border border-rose-500 rounded-md shadow-[0_0_15px_rgba(244,63,94,0.3)] transition"
            >
              {isDeleting ? "Видалення..." : "Видалити"}
            </button>
          </>
        }
      >
        <div className="space-y-3 font-mono text-xs">
          <p className="text-zinc-300 leading-relaxed font-sans">
            Ви дійсно бажаєте видалити цей лист із результатами аналізу?
          </p>
          {emailToDelete && (
            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
              <div className="text-white font-semibold truncate">
                {emailToDelete.subject || "Без теми"}
              </div>
              <div className="text-zinc-400 text-[11px] truncate">
                Від: <span className="text-cyan-400">{emailToDelete.senderEmail}</span>
              </div>
            </div>
          )}
        </div>
      </Modal>

    </div>
  );
}

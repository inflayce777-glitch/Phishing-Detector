"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Shield, ArrowLeft, Mail, RefreshCw, AlertTriangle, CheckCircle, Search, Trash2 } from "lucide-react";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [emailToDelete, setEmailToDelete] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchInbox = async (targetPage = page) => {
    try {
      const res = await fetch(`/api/inbox?page=${targetPage}&limit=10&query=${encodeURIComponent(debouncedQuery)}&_t=${Date.now()}`, {
        cache: 'no-store'
      });
      const data = await res.json();
      if (data.success) {
        setEmails(data.emails);
        setTotalPages(data.pagination.pages || 1);
      }
    } catch (error) {
      console.error("Failed to load inbox", error);
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
        await fetchInbox(1);
      }
    } catch (error) {
      console.error("Failed to sync", error);
    } finally {
      setSyncing(false);
    }
  };
  
  const deleteEmail = async (id: string) => {
    setEmailToDelete(id); return;
    try {
      const res = await fetch(`/api/inbox/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        fetchInbox();
      }
    } catch (error) {
      console.error("Failed to delete", error);
    }
  };
  
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    } else if (status === "authenticated") {
      fetchInbox();
    }
  }, [status, router, page, debouncedQuery]);

  if (status === "loading" || loading) {
    return <div className="min-h-screen bg-[#0b1013] text-cyan-500 flex items-center justify-center font-mono animate-pulse">Завантаження пошти...</div>;
  }

  const confirmDelete = async () => { if (!emailToDelete) return; try { const res = await fetch(`/api/inbox/${emailToDelete}`, { method: "DELETE" }); const data = await res.json(); if (data.success) { fetchInbox(); } } catch (error) { console.error("Failed to delete", error); } finally { setEmailToDelete(null); } };
  return (
    <div className="min-h-screen bg-[#0b1013] text-gray-300 font-mono p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-gray-800 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Mail className="w-8 h-8 text-cyan-400" />
              <h1 className="text-3xl font-bold text-white tracking-tight">Інбокс</h1>
            </div>
            <p className="text-sm text-gray-500">
              Листи, переслані від <span className="text-cyan-400">{session?.user?.email}</span>
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-500" />
              </div>
              <input
                type="text"
                placeholder="Пошук листів..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-700 rounded bg-gray-900 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={syncEmails}
                disabled={syncing}
                className="flex items-center gap-2 text-xs bg-gray-900 border border-gray-700 hover:border-cyan-500 px-4 py-2 transition-all rounded disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Синхронізація...' : 'Синхронізувати'}
              </button>
              <button 
                onClick={() => router.push("/")}
                className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/50 hover:border-cyan-400 px-4 py-2 bg-cyan-950/20 transition-all rounded whitespace-nowrap"
              >
                <ArrowLeft className="w-4 h-4" /> Назад
              </button>
            </div>
          </div>
        </header>

        {emails.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-gray-800 rounded-lg bg-gray-900/50">
            {searchQuery ? (
               <>
                 <Search className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                 <h2 className="text-xl text-gray-400">Нічого не знайдено</h2>
                 <p className="text-gray-600 mt-2">За запитом "{searchQuery}" листів немає.</p>
               </>
            ) : (
               <>
                 <Mail className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                 <h2 className="text-xl text-gray-400">Скринька порожня</h2>
                 <p className="text-gray-600 mt-2">
                   Перешліть будь-який підозрілий лист на <strong className="text-cyan-500">{process.env.NEXT_PUBLIC_SMTP_USER || "нашу пошту"}</strong>, 
                   і натисніть "Синхронізувати".
                 </p>
               </>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {emails.map((email) => (
              <div key={email.id} className="bg-gray-900/80 border border-gray-800 rounded p-5 flex flex-col md:flex-row gap-6 items-start md:items-center relative overflow-hidden transition-all hover:border-gray-600">
                
                {email.status === 'ANALYZED' && email.oracleScore !== null && (
                   <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                     (email.oracleLabel === 'phishing' || (!email.oracleLabel && email.oracleScore > 0.6))
                       ? 'bg-red-500'
                       : email.oracleLabel === 'spam'
                         ? 'bg-amber-500'
                         : 'bg-emerald-500'
                   }`}></div>
                )}
                {email.status === 'PENDING' && (
                   <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400"></div>
                )}

                <div className="flex-1 min-w-0 pl-2">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs text-gray-500">{new Date(email.createdAt).toLocaleString()}</span>
                    {email.status === 'PENDING' ? (
                      <span className="text-xs font-medium text-amber-400 border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                        Не проаналізовано
                      </span>
                    ) : (() => {
                      const isPhish = email.oracleLabel === 'phishing' || (!email.oracleLabel && email.oracleScore > 0.6);
                      const isSpam = email.oracleLabel === 'spam';
                      const label = isPhish ? 'Фішинг' : isSpam ? 'Спам' : 'Безпечно';
                      const badgeColor = isPhish 
                        ? 'text-red-400 border-red-500/30 bg-red-500/10' 
                        : isSpam 
                          ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' 
                          : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
                      const dotColor = isPhish ? 'bg-red-400' : isSpam ? 'bg-amber-400' : 'bg-emerald-400';
                      const percent = email.oracleScore !== null ? `${(email.oracleScore * 100).toFixed(1)}%` : '';

                      return (
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1.5 ${badgeColor}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                          {label} {percent ? `(${percent})` : ''}
                        </span>
                      );
                    })()}
                  </div>
                  <h3 className="text-lg text-white font-semibold truncate mb-1">{email.subject}</h3>
                  <p className="text-sm text-gray-400 truncate mb-2">Від: <span className="text-cyan-400">{email.senderEmail || email.sender}</span></p>
                  <p className="text-xs text-gray-500 line-clamp-2">{email.textBody}</p>
                </div>

                <div className="flex flex-col gap-2 min-w-[140px] w-full md:w-auto">
                  {email.status === 'PENDING' ? (
                    <button 
                      onClick={() => router.push(`/?emailId=${email.id}`)}
                      className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded text-xs flex items-center justify-center gap-2 transition"
                    >
                      <Search className="w-4 h-4" /> Аналіз
                    </button>
                  ) : (
                    <button 
                      onClick={() => router.push(`/?emailId=${email.id}`)}
                      className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded text-xs flex items-center justify-center gap-2 transition border border-gray-600"
                    >
                      Переглянути
                    </button>
                  )}
                  <button 
                    onClick={() => deleteEmail(email.id)}
                    className="w-full bg-transparent hover:bg-red-500/10 text-red-500 border border-red-500/30 hover:border-red-500 py-1.5 px-4 rounded text-xs flex items-center justify-center gap-2 transition"
                  >
                    <Trash2 className="w-4 h-4" /> Видалити
                  </button>
                </div>
              </div>
            ))}
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-6">
                <button 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-4 py-2 border border-gray-700 rounded text-sm text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  Попередня
                </button>
                <span className="text-sm text-gray-500">Сторінка <span className="text-white">{page}</span> з {totalPages}</span>
                <button 
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-4 py-2 border border-gray-700 rounded text-sm text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  Наступна
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {emailToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="bg-[#11181b] border border-red-500/30 p-6 rounded-lg max-w-sm w-full shadow-2xl shadow-red-500/10 transform transition-all scale-100">
            <h3 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Видалення листа
            </h3>
            <p className="text-gray-400 text-sm mb-6 font-sans">
              Ви впевнені, що хочете назавжди видалити цей лист? Цю дію неможливо скасувати.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setEmailToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-transparent border border-gray-700 hover:bg-gray-800 rounded transition"
              >
                Скасувати
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500/80 hover:bg-red-500 border border-red-600 rounded shadow-[0_0_10px_rgba(239,68,68,0.3)] transition"
              >
                Видалити
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


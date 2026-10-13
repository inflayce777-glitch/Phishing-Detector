"use client";

import { useState } from "react";
import { Shield } from "lucide-react";
import { useRouter } from "next/navigation";

export default function VerifyLogin() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetRequested, setResetRequested] = useState(false);
  const router = useRouter();

  const verify = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/totp/verify-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success) {
        router.push("/"); // Redirect to main scanner on success
        router.refresh(); // Force middleware to re-evaluate
      } else {
        setError(data.error || "Невірний код");
      }
    } catch (e) {
      setError("Помилка сервера");
    }
    setLoading(false);
  };

  const requestReset = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/totp/reset-request", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setResetRequested(true);
      } else {
        setError(data.error || "Помилка відправки листа");
      }
    } catch (e) {
      setError("Помилка сервера");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4 font-mono">
      <div className="w-full max-w-md bg-gray-900 border border-cyan-500/30 p-8 rounded-lg shadow-[0_0_30px_rgba(6,182,212,0.15)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500"></div>
        
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-gray-950 rounded-full border border-cyan-500/50">
            <Shield className="w-10 h-10 text-cyan-400" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center text-white mb-2 tracking-tight">
          ДВОФАКТОРНА ПЕРЕВІРКА
        </h1>
        <p className="text-gray-400 text-center mb-8 text-sm">
          Введіть 6-значний код з Google Authenticator для доступу до аналізатора.
        </p>

        <div className="space-y-4">
          <input 
            type="text" 
            value={token}
            onChange={e => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000 000"
            className="w-full bg-gray-950 border border-gray-700 focus:border-cyan-500 outline-none text-white px-4 py-4 rounded text-center text-3xl tracking-[0.3em] font-bold"
          />
          {error && <p className="text-red-500 text-center text-sm">{error}</p>}
          
          <button 
            onClick={verify}
            disabled={loading || token.length !== 6}
            className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold py-4 px-4 rounded transition-colors"
          >
            {loading ? "Зачекайте..." : "ПІДТВЕРДИТИ"}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-800 text-center">
          {resetRequested ? (
             <p className="text-emerald-400 text-sm font-semibold">Лист для скидання надіслано на вашу пошту!</p>
          ) : (
             <button onClick={requestReset} disabled={loading} className="text-gray-500 hover:text-cyan-400 text-xs transition-colors underline underline-offset-4">
               Втратили доступ до телефону? Скинути 2FA
             </button>
          )}
        </div>
      </div>
    </div>
  );
}

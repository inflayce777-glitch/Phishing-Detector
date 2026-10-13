"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Shield, ShieldAlert, ArrowLeft, Key } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function Profile() {
  const { data: session, update } = useSession();
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const isEnabled = (session?.user as any)?.totpEnabled;

  const generateTotp = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/totp/setup", { method: "POST" });
      const data = await res.json();
      setQrCode(data.qrCodeUrl);
      setSecret(data.secret);
    } catch (e) {
      setError("Помилка генерації TOTP");
    }
    setLoading(false);
  };

  const verifySetup = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/totp/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success) {
        await update(); // refresh NextAuth session
        window.location.reload();
      } else {
        setError(data.error || "Невірний код");
      }
    } catch (e) {
      setError("Помилка підтвердження");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-300 font-mono p-8 flex justify-center">
      <div className="w-full max-w-2xl">
        <header className="flex justify-between items-center mb-10 pb-6 border-b border-gray-800">
          <h1 className="text-3xl font-bold text-white tracking-tight">НАЛАШТУВАННЯ БЕЗПЕКИ</h1>
          <Link href="/" className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm transition-colors flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Назад
          </Link>
        </header>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 shadow-xl mb-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-cyan-500" />
            Двофакторна автентифікація (2FA)
          </h2>
          
          <div className="mb-6 p-4 rounded bg-gray-950 border border-gray-800 flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 mb-1">Поточний статус</div>
              <div className="flex items-center gap-2">
                {isEnabled ? (
                  <><Shield className="w-5 h-5 text-emerald-500" /> <span className="text-emerald-500 font-bold">УВІМКНЕНО</span></>
                ) : (
                  <><ShieldAlert className="w-5 h-5 text-red-500" /> <span className="text-red-500 font-bold">ВИМКНЕНО</span></>
                )}
              </div>
            </div>
            {!isEnabled && !qrCode && (
              <button 
                onClick={generateTotp}
                disabled={loading}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded text-sm font-semibold transition"
              >
                {loading ? "Генерація..." : "Підключити Google Authenticator"}
              </button>
            )}
          </div>

          {qrCode && !isEnabled && (
            <div className="p-6 border border-cyan-500/30 bg-cyan-950/10 rounded">
              <h3 className="text-white font-semibold mb-4">Крок 1: Відскануйте QR-код</h3>
              <p className="text-sm text-gray-400 mb-4">
                Відкрийте додаток Google Authenticator на вашому телефоні та відскануйте цей код.
              </p>
              
              <div className="flex justify-center mb-6">
                <div className="bg-white p-2 rounded">
                  <Image src={qrCode} alt="TOTP QR" width={200} height={200} />
                </div>
              </div>

              <h3 className="text-white font-semibold mb-4">Крок 2: Введіть код підтвердження</h3>
              <div className="flex gap-2 mb-2">
                <input 
                  type="text" 
                  value={token}
                  onChange={e => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="bg-gray-950 border border-gray-700 text-white px-4 py-2 rounded flex-1 text-center text-xl tracking-[0.5em]"
                />
                <button 
                  onClick={verifySetup}
                  disabled={loading || token.length !== 6}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-6 py-2 rounded font-semibold transition"
                >
                  Підтвердити
                </button>
              </div>
              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

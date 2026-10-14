"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldAlert, CheckCircle } from "lucide-react";

import { Suspense } from "react";

function ResetTotpContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const router = useRouter();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token || !email) {
      setStatus("error");
      setErrorMessage("Недійсне посилання для скидання.");
      return;
    }

    fetch("/api/totp/reset-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatus("success");
          setTimeout(() => {
            router.push("/dashboard");
            router.refresh();
          }, 3000);
        } else {
          setStatus("error");
          setErrorMessage(data.error || "Недійсний або прострочений токен.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMessage("Помилка підключення до сервера.");
      });
  }, [token, email, router]);

  return (
    <div className="w-full max-w-md bg-gray-900 border border-gray-800 p-8 rounded-lg text-center">
      {status === "loading" && (
        <div className="animate-pulse">
          <h2 className="text-xl text-white mb-2">Перевірка токена...</h2>
          <p className="text-gray-500">Зачекайте хвилинку.</p>
        </div>
      )}

      {status === "success" && (
        <div>
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-emerald-400 mb-2">2FA успішно скинуто!</h2>
          <p className="text-gray-400 mb-6">Тепер ви можете увійти без коду та налаштувати 2FA заново у профілі.</p>
          <p className="text-sm text-gray-500">Перенаправлення в панель керування...</p>
        </div>
      )}

      {status === "error" && (
        <div>
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-400 mb-2">Помилка скидання</h2>
          <p className="text-gray-400 mb-6">{errorMessage}</p>
          <button 
            onClick={() => router.push("/auth/verify")}
            className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded"
          >
            Повернутися
          </button>
        </div>
      )}
    </div>
  );
}

export default function ResetTotpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4 font-mono">
      <Suspense fallback={<div className="text-cyan-500">Завантаження...</div>}>
        <ResetTotpContent />
      </Suspense>
    </div>
  );
}

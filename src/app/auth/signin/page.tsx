"use client";

import { signIn } from "next-auth/react";
import { Shield, Mail } from "lucide-react";

export default function SignIn() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4 font-mono">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 p-8 rounded-lg shadow-2xl relative overflow-hidden">
        {/* Cyberpunk Accents */}
        <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.5)]"></div>
        
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-gray-800 rounded-full border border-gray-700">
            <Shield className="w-10 h-10 text-cyan-400" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center text-white mb-2 tracking-tight">
          Авторизація
        </h1>
        <p className="text-gray-400 text-center mb-8 text-sm">
          Система доступу до аналізатора фішингу. Для продовження підтвердіть свою особу.
        </p>

        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full bg-white hover:bg-gray-200 text-black font-semibold py-3 px-4 rounded transition-colors flex items-center justify-center gap-3"
        >
          <Mail className="w-5 h-5" />
          Увійти через Google
        </button>

        <div className="mt-8 pt-6 border-t border-gray-800 text-center">
          <p className="text-xs text-gray-500">
            Доступ до системи надається виключно авторизованим користувачам з метою безпеки.
          </p>
        </div>
      </div>
    </div>
  );
}

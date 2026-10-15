'use client';
import React, { useState } from 'react';
import { Key, Shield, ShieldAlert } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useSession } from 'next-auth/react';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({ isOpen, onClose }) => {
  const { data: session, update } = useSession();
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState('');

  const is2FAEnabled = Boolean((session?.user as any)?.totpEnabled);

  const generateTotp = async () => {
    setSecurityLoading(true);
    setSecurityError('');
    try {
      const res = await fetch('/api/totp/setup', { method: 'POST' });
      const data = await res.json();
      if (data.qrCodeUrl) {
        setQrCode(data.qrCodeUrl);
        setSecret(data.secret);
      } else {
        setSecurityError(data.error || 'Помилка генерації TOTP');
      }
    } catch (e) {
      setSecurityError('Помилка з’єднання із сервером');
    } finally {
      setSecurityLoading(false);
    }
  };

  const verifySetup = async () => {
    setSecurityLoading(true);
    setSecurityError('');
    try {
      const res = await fetch('/api/totp/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: totpToken }),
      });
      const data = await res.json();
      if (data.success) {
        await update();
        onClose();
        window.location.reload();
      } else {
        setSecurityError(data.error || 'Невірний 6-значний код');
      }
    } catch (e) {
      setSecurityError('Помилка підтвердження');
    } finally {
      setSecurityLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Двофакторна автентифікація (2FA)"
      description="Підвищіть безпеку вашого облікового запису за допомогою Time-based One-Time Password"
      icon={<Key className="w-5 h-5 text-cyan-400" />}
      maxWidth="lg"
    >
      <div className="space-y-5 font-mono text-xs">
        {/* Current Status Card */}
        <div className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
          <div>
            <div className="text-zinc-500 mb-1">Поточний статус 2FA:</div>
            <div className="flex items-center gap-2">
              {is2FAEnabled ? (
                <>
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Увімкнено</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span className="text-rose-400 font-bold">Вимкнено</span>
                </>
              )}
            </div>
          </div>

          {!is2FAEnabled && !qrCode && (
            <button
              onClick={generateTotp}
              disabled={securityLoading}
              className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-4 py-2 rounded-md font-semibold transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)]"
            >
              {securityLoading ? 'Генерація...' : 'Підключити Authenticator'}
            </button>
          )}
        </div>

        {/* Setup Flow */}
        {qrCode && !is2FAEnabled && (
          <div className="p-5 border border-cyan-500/30 bg-cyan-950/10 rounded-lg space-y-4">
            <div>
              <h4 className="text-white font-semibold mb-1">
                Крок 1: Відскануйте QR-код
              </h4>
              <p className="text-zinc-400 text-[11px] leading-relaxed">
                Відкрийте додаток Google Authenticator або Authy на вашому смартфоні та відскануйте код:
              </p>
            </div>

            <div className="flex justify-center p-3 bg-white rounded-lg w-fit mx-auto shadow-md">
              <img src={qrCode} alt="TOTP QR Code" width={180} height={180} />
            </div>

            {secret && (
              <div className="text-center">
                <span className="text-zinc-500 text-[10px]">Або введіть секрет вручну: </span>
                <code className="text-cyan-300 bg-zinc-900 px-2 py-0.5 rounded text-[11px] select-all">
                  {secret}
                </code>
              </div>
            )}

            <div>
              <h4 className="text-white font-semibold mb-2">
                Крок 2: Введіть 6-значний код підтвердження
              </h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && totpToken.length === 6 && !securityLoading) {
                      e.preventDefault();
                      verifySetup();
                    }
                  }}
                  placeholder="000000"
                  className="bg-zinc-950 border border-zinc-700 text-white px-4 py-2.5 rounded-md flex-1 text-center text-xl tracking-[0.4em] outline-none focus:border-cyan-500 font-mono"
                  autoFocus
                />
                <button
                  onClick={verifySetup}
                  disabled={securityLoading || totpToken.length !== 6}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-6 py-2 rounded-md font-semibold transition"
                >
                  {securityLoading ? 'Перевірка...' : 'Підтвердити'}
                </button>
              </div>
              {securityError && (
                <p className="text-rose-400 text-xs mt-2 text-center">{securityError}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

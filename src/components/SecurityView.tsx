import React, { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import type { Language, SecurityStatus } from '../types/crypto';
import { TRANSLATIONS } from '../i18n/translations';

interface SecurityViewProps {
  security: SecurityStatus;
  language: Language;
  onRefreshSecurity: (next: SecurityStatus) => void;
}

export const SecurityView: React.FC<SecurityViewProps> = ({
  security,
  language,
  onRefreshSecurity,
}) => {
  const t = TRANSLATIONS[language];
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [manualSecret, setManualSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleSetup2FA = async () => {
    setFeedback(null);
    const resp = await fetch('/api/security/2fa/setup', { method: 'POST' });
    const data = await resp.json();
    if (resp.ok) {
      setQrDataUrl(data.qrDataUrl);
      setManualSecret(data.manualSecret);
    } else {
      setFeedback({ type: 'err', text: data.error || 'Erro ao gerar configuração 2FA.' });
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const resp = await fetch('/api/security/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: totpCode }),
    });
    const data = await resp.json();
    if (resp.ok && data.security) {
      onRefreshSecurity(data.security);
      setQrDataUrl(null);
      setManualSecret(null);
      setTotpCode('');
      setFeedback({ type: 'ok', text: 'Autenticação de Dois Fatores (2FA TOTP) ativada!' });
    } else {
      setFeedback({ type: 'err', text: data.error || 'Código 2FA inválido.' });
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const resp = await fetch('/api/security/2fa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: totpCode }),
    });
    const data = await resp.json();
    if (resp.ok && data.security) {
      onRefreshSecurity(data.security);
      setTotpCode('');
      setFeedback({ type: 'ok', text: '2FA desativado.' });
    } else {
      setFeedback({ type: 'err', text: data.error || 'Código inválido.' });
    }
  };

  const handleTogglePolicy = async () => {
    const resp = await fetch('/api/security/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ require2FAForLiveOrders: !security.require2FAForLiveOrders }),
    });
    const data = await resp.json();
    if (resp.ok && data.security) {
      onRefreshSecurity(data.security);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* TOTP 2FA Panel */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t.security.twoFactorTitle}
              </h2>
            </div>
            <span
              className={`text-xs font-semibold ${
                security.twoFactorEnabled
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {security.twoFactorEnabled ? 'Proteção Ativa' : 'Não Configurado'}
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Compatível com Google Authenticator, Authy e 1Password (padrão RFC 6238 SHA-1, 6 dígitos).
          </p>

          {!security.twoFactorEnabled && !qrDataUrl && (
            <button
              type="button"
              onClick={handleSetup2FA}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            >
              {t.security.setup2FA}
            </button>
          )}

          {qrDataUrl && (
            <form onSubmit={handleVerify2FA} className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <img
                  src={qrDataUrl}
                  alt="QR Code 2FA TOTP"
                  className="w-36 h-36 rounded-lg border border-slate-200 dark:border-slate-700 bg-white p-1.5"
                />
                <div className="space-y-2 text-xs">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    1. Escaneie o QR Code no aplicativo autenticador
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">
                    Chave manual Base32:
                  </div>
                  <code className="block p-2 rounded bg-slate-100 dark:bg-slate-900 font-mono text-[11px] break-all select-all text-slate-900 dark:text-slate-100">
                    {manualSecret}
                  </code>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  aria-label="Código TOTP de 6 dígitos"
                  maxLength={6}
                  placeholder="Digite o código de 6 dígitos"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap"
                >
                  {t.security.verifyEnable}
                </button>
              </div>
            </form>
          )}

          {security.twoFactorEnabled && (
            <form onSubmit={handleDisable2FA} className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">
                  Exigir 2FA para ordens via Exchange API
                </span>
                <button
                  type="button"
                  onClick={handleTogglePolicy}
                  className={`px-3 py-1 rounded-md border text-xs font-medium ${
                    security.require2FAForLiveOrders
                      ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                      : 'border-slate-300 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  {security.require2FAForLiveOrders ? 'Obrigatório' : 'Opcional'}
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  aria-label="Código 2FA atual para desativar"
                  maxLength={6}
                  placeholder="Código 2FA atual"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                >
                  {t.security.disable2FA}
                </button>
              </div>
            </form>
          )}

          {feedback && (
            <div
              className={`p-2.5 rounded-lg text-xs ${
                feedback.type === 'ok'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}
            >
              {feedback.text}
            </div>
          )}
        </section>

        {/* End-to-End Encryption Vault Summary */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t.security.vaultTitle}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs pt-1">
            <div>
              <div className="text-slate-500 dark:text-slate-400">Algoritmo do Cofre</div>
              <div className="font-mono font-semibold text-slate-900 dark:text-white mt-0.5">
                {security.encryptionStandard}
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">Isolamento de Chaves IA</div>
              <div className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                100% Server-Side
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">Exposição de Segredos no Cliente</div>
              <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                Bloqueada (Somente Máscara)
              </div>
            </div>
            <div>
              <div className="text-slate-500 dark:text-slate-400">Permissões Recomendadas</div>
              <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                Leitura + Spot (Sem Saque)
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Audit Log */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t.security.auditLog}
          </h2>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
          {security.auditLogs.slice(0, 20).map((log) => (
            <div key={log.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">{log.event}</span>
                <span className="text-slate-400 mx-2">·</span>
                <span className="text-slate-600 dark:text-slate-300">{log.detail}</span>
              </div>
              <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

import React, { useState } from 'react';
import { Bell, Mail, Send, Trash2 } from 'lucide-react';
import type {
  EmailReportSchedule,
  Language,
  MarketTicker,
  VolatilityAlert,
} from '../types/crypto';
import { TRANSLATIONS } from '../i18n/translations';

interface AlertsReportsViewProps {
  alerts: VolatilityAlert[];
  emailSchedules: EmailReportSchedule[];
  tickers: MarketTicker[];
  language: Language;
  pushPermission: NotificationPermission | 'unsupported';
  onRequestPush: () => Promise<void>;
  onSendTestPush: () => void;
  onCreateAlert: (payload: {
    symbol: string;
    condition: VolatilityAlert['condition'];
    threshold: number;
    pushEnabled: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  onToggleAlert: (id: string) => Promise<void>;
  onDeleteAlert: (id: string) => Promise<void>;
  onCreateEmailSchedule: (payload: {
    recipientEmail: string;
    cadence: EmailReportSchedule['cadence'];
    format: EmailReportSchedule['format'];
    scope: EmailReportSchedule['scope'];
  }) => Promise<{ ok: boolean; error?: string }>;
  onSendEmailPreview: (id: string) => Promise<{
    to: string;
    subject: string;
    sentAt: string;
    summaryLines: string[];
  } | null>;
  onDeleteEmailSchedule: (id: string) => Promise<void>;
}

export const AlertsReportsView: React.FC<AlertsReportsViewProps> = ({
  alerts,
  emailSchedules,
  tickers,
  language,
  pushPermission,
  onRequestPush,
  onSendTestPush,
  onCreateAlert,
  onToggleAlert,
  onDeleteAlert,
  onCreateEmailSchedule,
  onSendEmailPreview,
  onDeleteEmailSchedule,
}) => {
  const t = TRANSLATIONS[language];

  const [symbol, setSymbol] = useState('BTC');
  const [condition, setCondition] = useState<VolatilityAlert['condition']>('CHANGE_24H_ABS');
  const [threshold, setThreshold] = useState('4.0');
  const [pushEnabled, setPushEnabled] = useState(true);
  const [alertFeedback, setAlertFeedback] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [cadence, setCadence] = useState<EmailReportSchedule['cadence']>('weekly');
  const [format, setFormat] = useState<EmailReportSchedule['format']>('PDF');
  const [scope, setScope] = useState<EmailReportSchedule['scope']>('portfolio_pnl');
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);
  const [digestPreview, setDigestPreview] = useState<{
    to: string;
    subject: string;
    sentAt: string;
    summaryLines: string[];
  } | null>(null);

  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertFeedback(null);
    const res = await onCreateAlert({
      symbol,
      condition,
      threshold: Number(threshold),
      pushEnabled,
    });
    if (res.ok) {
      setAlertFeedback('Alerta de volatilidade registrado em tempo real.');
    } else {
      setAlertFeedback(res.error || 'Erro ao criar alerta.');
    }
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailFeedback(null);
    const res = await onCreateEmailSchedule({
      recipientEmail: email,
      cadence,
      format,
      scope,
    });
    if (res.ok) {
      setEmail('');
      setEmailFeedback('Entrega automatizada por e-mail agendada.');
    } else {
      setEmailFeedback(res.error || 'Informe um e-mail válido.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Push Notification Controls */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t.alerts.pushNotifications}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Status da permissão:{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {pushPermission === 'granted'
                  ? 'Autorizado'
                  : pushPermission === 'denied'
                  ? 'Bloqueado pelo navegador'
                  : pushPermission === 'unsupported'
                  ? 'Indisponível neste contexto'
                  : 'Aguardando ativação'}
              </strong>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRequestPush}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {t.alerts.enablePush}
          </button>
          <button
            type="button"
            onClick={onSendTestPush}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
          >
            {t.alerts.testPush}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Volatility Rules */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t.alerts.volatilityRules}
          </h2>

          <form onSubmit={handleAddAlert} className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label htmlFor="al-sym" className="block text-xs text-slate-500 mb-1">
                Ativo
              </label>
              <select
                id="al-sym"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                {tickers.map((tk) => (
                  <option key={tk.symbol} value={tk.symbol}>
                    {tk.symbol}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="al-cond" className="block text-xs text-slate-500 mb-1">
                Condição
              </label>
              <select
                id="al-cond"
                value={condition}
                onChange={(e) => setCondition(e.target.value as VolatilityAlert['condition'])}
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="CHANGE_24H_ABS">Oscilação 24h (%)</option>
                <option value="ATR_SPIKE">Amplitude Volátil (%)</option>
                <option value="PRICE_ABOVE">Preço Acima ($)</option>
                <option value="PRICE_BELOW">Preço Abaixo ($)</option>
              </select>
            </div>

            <div>
              <label htmlFor="al-val" className="block text-xs text-slate-500 mb-1">
                Gatilho
              </label>
              <input
                id="al-val"
                type="number"
                step="any"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            <button
              type="submit"
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            >
              Criar Alerta
            </button>
          </form>

          <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={pushEnabled}
              onChange={(e) => setPushEnabled(e.target.checked)}
              className="rounded border-slate-300"
            />
            Enviar Push Notification imediata quando disparar
          </label>

          {alertFeedback && (
            <div className="text-xs text-blue-600 dark:text-blue-400">{alertFeedback}</div>
          )}

          <div className="divide-y divide-slate-100 dark:divide-slate-800/70 border-t border-slate-200 dark:border-slate-800">
            {alerts.map((al) => (
              <div key={al.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">
                    {al.symbol}/USDT · {al.condition} ({al.threshold})
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {al.triggered && al.lastMessage
                      ? `Disparado: ${al.lastMessage}`
                      : al.pushEnabled
                      ? 'Monitorando com Push ativo'
                      : 'Monitorando em painel'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleAlert(al.id)}
                    className={`px-2.5 py-1 text-xs rounded-md border ${
                      al.enabled
                        ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                        : 'border-slate-300 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    {al.enabled ? 'Ativo' : 'Pausado'}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover alerta ${al.symbol}`}
                    onClick={() => onDeleteAlert(al.id)}
                    className="p-1 text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Automated Email Report Delivery */}
        <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t.alerts.emailScheduler}
            </h2>
          </div>

          <form onSubmit={handleAddSchedule} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="rep-email" className="block text-xs text-slate-500 mb-1">
                E-mail de Destino
              </label>
              <input
                id="rep-email"
                type="email"
                placeholder="investidor@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <label htmlFor="rep-cadence" className="block text-xs text-slate-500 mb-1">
                Frequência
              </label>
              <select
                id="rep-cadence"
                value={cadence}
                onChange={(e) => setCadence(e.target.value as EmailReportSchedule['cadence'])}
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="daily">Diário (08:00)</option>
                <option value="weekly">Semanal (Segunda)</option>
                <option value="monthly">Mensal (Dia 1)</option>
              </select>
            </div>

            <div>
              <label htmlFor="rep-format" className="block text-xs text-slate-500 mb-1">
                Formato / Escopo
              </label>
              <div className="flex gap-2">
                <select
                  id="rep-format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as EmailReportSchedule['format'])}
                  className="px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="PDF">PDF</option>
                  <option value="EXCEL">Excel</option>
                  <option value="CSV">CSV</option>
                </select>
                <select
                  aria-label="Escopo do relatório"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as EmailReportSchedule['scope'])}
                  className="flex-1 min-w-0 px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="portfolio_pnl">Portfólio & P&L</option>
                  <option value="backtest_digest">Backtesting</option>
                  <option value="alerts_audit">Alertas & Auditoria</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="sm:col-span-2 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            >
              Agendar Entrega Automática
            </button>
          </form>

          {emailFeedback && (
            <div className="text-xs text-blue-600 dark:text-blue-400">{emailFeedback}</div>
          )}

          <div className="divide-y divide-slate-100 dark:divide-slate-800/70 border-t border-slate-200 dark:border-slate-800">
            {emailSchedules.map((sc) => (
              <div key={sc.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">
                    {sc.recipientEmail}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {sc.cadence} · {sc.format} · {sc.scope}
                    {sc.lastSentAt
                      ? ` · Último envio: ${new Date(sc.lastSentAt).toLocaleDateString()}`
                      : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const d = await onSendEmailPreview(sc.id);
                      if (d) setDigestPreview(d);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                  >
                    <Send className="w-3 h-3" />
                    <span>{t.alerts.sendPreview}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover agendamento ${sc.recipientEmail}`}
                    onClick={() => onDeleteEmailSchedule(sc.id)}
                    className="p-1 text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {digestPreview && (
            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 space-y-2 text-xs">
              <div className="font-semibold text-slate-900 dark:text-white">
                Prévia de Envio · {digestPreview.subject}
              </div>
              <div className="text-slate-500">Para: {digestPreview.to}</div>
              <ul className="space-y-1 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                {digestPreview.summaryLines.map((line, i) => (
                  <li key={i}>• {line}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

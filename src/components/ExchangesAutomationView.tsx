import React, { useState } from 'react';
import { Lock, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type {
  AutomationRule,
  ExchangeConnection,
  Language,
  MarketTicker,
} from '../types/crypto';
import { TRANSLATIONS } from '../i18n/translations';

interface ExchangesAutomationViewProps {
  exchanges: ExchangeConnection[];
  automationRules: AutomationRule[];
  tickers: MarketTicker[];
  language: Language;
  onAddExchange: (payload: {
    exchange: ExchangeConnection['exchange'];
    label: string;
    apiKey: string;
    apiSecret: string;
    permissions: ('READ' | 'SPOT_TRADE' | 'FUTURES')[];
  }) => Promise<{ ok: boolean; error?: string }>;
  onPingExchange: (id: string) => Promise<void>;
  onDeleteExchange: (id: string) => Promise<void>;
  onCreateRule: (payload: {
    name: string;
    symbol: string;
    conditionType: AutomationRule['conditionType'];
    threshold: number;
    actionSide: 'BUY' | 'SELL';
    amountUsd: number;
    targetExchange: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onToggleRule: (id: string) => Promise<void>;
  onTestRule: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onDeleteRule: (id: string) => Promise<void>;
}

export const ExchangesAutomationView: React.FC<ExchangesAutomationViewProps> = ({
  exchanges,
  automationRules,
  tickers,
  language,
  onAddExchange,
  onPingExchange,
  onDeleteExchange,
  onCreateRule,
  onToggleRule,
  onTestRule,
  onDeleteRule,
}) => {
  const t = TRANSLATIONS[language];

  // Exchange form state
  const [exName, setExName] = useState<ExchangeConnection['exchange']>('Binance');
  const [exLabel, setExLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [exFeedback, setExFeedback] = useState<string | null>(null);

  // Automation rule form state
  const [ruleName, setRuleName] = useState('');
  const [ruleSymbol, setRuleSymbol] = useState('BTC');
  const [conditionType, setConditionType] =
    useState<AutomationRule['conditionType']>('RSI_BELOW');
  const [threshold, setThreshold] = useState('30');
  const [actionSide, setActionSide] = useState<'BUY' | 'SELL'>('BUY');
  const [amountUsd, setAmountUsd] = useState('1500');
  const [targetExchange, setTargetExchange] = useState('KronoQuant Paper');
  const [ruleFeedback, setRuleFeedback] = useState<string | null>(null);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setExFeedback(null);
    const res = await onAddExchange({
      exchange: exName,
      label: exLabel,
      apiKey,
      apiSecret,
      permissions: ['READ', 'SPOT_TRADE'],
    });
    if (res.ok) {
      setExLabel('');
      setApiKey('');
      setApiSecret('');
      setExFeedback('Corretora conectada e criptografada com AES-256-GCM no cofre.');
    } else {
      setExFeedback(res.error || 'Erro ao conectar corretora.');
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuleFeedback(null);
    const res = await onCreateRule({
      name: ruleName,
      symbol: ruleSymbol,
      conditionType,
      threshold: Number(threshold),
      actionSide,
      amountUsd: Number(amountUsd),
      targetExchange,
    });
    if (res.ok) {
      setRuleName('');
      setRuleFeedback('Gatilho automatizado ativado no motor de execução.');
    } else {
      setRuleFeedback(res.error || 'Erro ao criar regra.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Exchanges Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t.exchanges.connectTitle}
            </h2>
          </div>

          <form onSubmit={handleConnect} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ex-select" className="block text-xs text-slate-500 mb-1">
                  Corretora
                </label>
                <select
                  id="ex-select"
                  value={exName}
                  onChange={(e) => setExName(e.target.value as ExchangeConnection['exchange'])}
                  className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="Binance">Binance</option>
                  <option value="Coinbase Advanced">Coinbase Advanced</option>
                  <option value="Kraken">Kraken</option>
                  <option value="Bybit">Bybit</option>
                  <option value="OKX">OKX</option>
                </select>
              </div>
              <div>
                <label htmlFor="ex-label" className="block text-xs text-slate-500 mb-1">
                  Rótulo da Conta
                </label>
                <input
                  id="ex-label"
                  type="text"
                  placeholder="Ex: Conta Spot Principal"
                  value={exLabel}
                  onChange={(e) => setExLabel(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            <div>
              <label htmlFor="ex-key" className="block text-xs text-slate-500 mb-1">
                API Key
              </label>
              <input
                id="ex-key"
                type="text"
                placeholder="Cole sua chave pública da exchange"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <label htmlFor="ex-secret" className="block text-xs text-slate-500 mb-1">
                API Secret (armazenada com AES-256-GCM)
              </label>
              <input
                id="ex-secret"
                type="password"
                placeholder="••••••••••••••••"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            {exFeedback && (
              <p className="text-xs text-blue-600 dark:text-blue-400">{exFeedback}</p>
            )}

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.exchanges.addExchange}</span>
            </button>
          </form>
        </section>

        <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Corretoras Integradas ({exchanges.length})
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Criptografia AES-256-GCM · Sem permissão de saque
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {exchanges.map((ex) => (
              <div
                key={ex.id}
                className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {ex.exchange} · {ex.label}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                    Key {ex.maskedApiKey} · {ex.permissions.join(' / ')} · Latência {ex.latencyMs}ms
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onPingExchange(ex.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{t.exchanges.testLatency}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover ${ex.label}`}
                    onClick={() => onDeleteExchange(ex.id)}
                    className="p-1.5 rounded-md border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Automated Execution Rules */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] p-5 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {t.exchanges.automationTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Execute ordens automaticamente quando preço, RSI ou volatilidade atingirem seus gatilhos predefinidos.
          </p>
        </div>

        <form onSubmit={handleAddRule} className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-7 gap-3 items-end">
          <div className="sm:col-span-2">
            <label htmlFor="rule-name" className="block text-xs text-slate-500 mb-1">
              Nome do Gatilho
            </label>
            <input
              id="rule-name"
              type="text"
              placeholder="Ex: Compra SOL em rompimento"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>

          <div>
            <label htmlFor="rule-asset" className="block text-xs text-slate-500 mb-1">
              Ativo
            </label>
            <select
              id="rule-asset"
              value={ruleSymbol}
              onChange={(e) => setRuleSymbol(e.target.value)}
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
            <label htmlFor="rule-cond" className="block text-xs text-slate-500 mb-1">
              Condição
            </label>
            <select
              id="rule-cond"
              value={conditionType}
              onChange={(e) =>
                setConditionType(e.target.value as AutomationRule['conditionType'])
              }
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <option value="RSI_BELOW">RSI(14) Abaixo de</option>
              <option value="RSI_ABOVE">RSI(14) Acima de</option>
              <option value="PRICE_ABOVE">Preço Acima ($)</option>
              <option value="PRICE_BELOW">Preço Abaixo ($)</option>
              <option value="VOLATILITY_SPIKE">Volatilidade 24h &ge; (%)</option>
            </select>
          </div>

          <div>
            <label htmlFor="rule-thresh" className="block text-xs text-slate-500 mb-1">
              Limiar
            </label>
            <input
              id="rule-thresh"
              type="number"
              step="any"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>

          <div>
            <label htmlFor="rule-action" className="block text-xs text-slate-500 mb-1">
              Ação / Valor ($)
            </label>
            <div className="flex gap-1.5">
              <select
                id="rule-action"
                value={actionSide}
                onChange={(e) => setActionSide(e.target.value as 'BUY' | 'SELL')}
                className="px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
              <input
                type="number"
                aria-label="Valor da ordem automática em USD"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                className="w-full min-w-0 px-2 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
          >
            {t.exchanges.createRule}
          </button>
        </form>

        <div className="flex items-center gap-3 text-xs">
          <label htmlFor="rule-dest" className="text-slate-500">
            Roteamento da execução:
          </label>
          <select
            id="rule-dest"
            value={targetExchange}
            onChange={(e) => setTargetExchange(e.target.value)}
            className="px-2.5 py-1 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="KronoQuant Paper">KronoQuant Paper (Banca Simulada)</option>
            {exchanges.map((ex) => (
              <option key={ex.id} value={ex.label}>
                {ex.exchange} · {ex.label}
              </option>
            ))}
          </select>
          {ruleFeedback && <span className="text-blue-600 dark:text-blue-400">{ruleFeedback}</span>}
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/70 border-t border-slate-200 dark:border-slate-800">
          {automationRules.map((rule) => (
            <div
              key={rule.id}
              className="py-3 flex flex-wrap items-center justify-between gap-4"
            >
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {rule.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                  {rule.symbol} · {rule.conditionType} ({rule.threshold}) → {rule.actionSide} $
                  {rule.amountUsd} · {rule.targetExchange} · Disparos: {rule.triggeredCount}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleRule(rule.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-md border ${
                    rule.enabled
                      ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                      : 'border-slate-300 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  {rule.enabled ? 'Ativo' : 'Pausado'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await onTestRule(rule.id);
                    if (!res.ok) {
                      setRuleFeedback(res.error || 'Erro ao disparar regra.');
                    } else {
                      setRuleFeedback(`Regra "${rule.name}" executada e registrada no Portfólio!`);
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                >
                  <Play className="w-3 h-3" />
                  <span>{t.exchanges.triggerNow}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Excluir regra ${rule.name}`}
                  onClick={() => onDeleteRule(rule.id)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-rose-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

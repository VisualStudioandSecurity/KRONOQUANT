import React, { useEffect, useState } from 'react';
import { Sparkles, RefreshCw, ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';
import type {
  AIPredictionResult,
  Candle,
  ExchangeConnection,
  ExecutionMode,
  Language,
  MarketTicker,
  OrderBookData,
  PaperAccountState,
  RiskProfile,
  TechnicalSnapshot,
  ThemeMode,
  Timeframe,
} from '../types/crypto';
import { CandlestickChart } from './CandlestickChart';
import { TRANSLATIONS } from '../i18n/translations';

interface TerminalViewProps {
  tickers: MarketTicker[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  timeframe: Timeframe;
  onChangeTimeframe: (tf: Timeframe) => void;
  candles: Candle[];
  candleSource: string;
  snapshot: TechnicalSnapshot | null;
  orderBook: OrderBookData | null;
  theme: ThemeMode;
  language: Language;
  riskProfile: RiskProfile;
  executionMode: ExecutionMode;
  onChangeExecutionMode: (mode: ExecutionMode) => void;
  exchanges: ExchangeConnection[];
  paperAccount: PaperAccountState;
  twoFactorEnabled: boolean;
  require2FAForLiveOrders: boolean;
  prefilledOrder: {
    symbol?: string;
    side?: 'BUY' | 'SELL';
    price?: number;
    stopLoss?: number;
    takeProfit?: number;
    note?: string;
  } | null;
  onClearPrefill: () => void;
  onPlaceOrder: (payload: {
    symbol: string;
    side: 'BUY' | 'SELL';
    orderType: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
    mode: ExecutionMode;
    exchange: string;
    quantity: number;
    price: number;
    stopLoss?: number;
    takeProfit?: number;
    totpCode?: string;
    note?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onResetBankroll: (action: 'reset' | 'topup', amountUsd: number) => Promise<void>;
  orderTicketInputRef?: React.RefObject<HTMLInputElement | null>;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  tickers,
  selectedSymbol,
  onSelectSymbol,
  timeframe,
  onChangeTimeframe,
  candles,
  candleSource,
  snapshot,
  orderBook,
  theme,
  language,
  riskProfile,
  executionMode,
  onChangeExecutionMode,
  exchanges,
  paperAccount,
  twoFactorEnabled,
  require2FAForLiveOrders,
  prefilledOrder,
  onClearPrefill,
  onPlaceOrder,
  onResetBankroll,
  orderTicketInputRef,
}) => {
  const t = TRANSLATIONS[language];
  const activeTicker = tickers.find((x) => x.symbol === selectedSymbol) ?? tickers[0];

  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT'>('MARKET');
  const [selectedExchange, setSelectedExchange] = useState<string>(
    exchanges[0]?.label || 'Binance Spot Institucional'
  );
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [amountUsd, setAmountUsd] = useState<string>('2500');
  const [stopLossInput, setStopLossInput] = useState<string>('');
  const [takeProfitInput, setTakeProfitInput] = useState<string>('');
  const [totpCode, setTotpCode] = useState<string>('');
  const [orderFeedback, setOrderFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Bankroll dialog state
  const [showBankrollPanel, setShowBankrollPanel] = useState(false);
  const [bankrollAmount, setBankrollAmount] = useState('100000');
  const [bankrollAction, setBankrollAction] = useState<'reset' | 'topup'>('reset');

  // Gemini AI prediction state
  const [aiResult, setAiResult] = useState<AIPredictionResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (exchanges.length > 0 && !exchanges.some((e) => e.label === selectedExchange)) {
      setSelectedExchange(exchanges[0].label);
    }
  }, [exchanges, selectedExchange]);

  useEffect(() => {
    if (activeTicker && orderType === 'MARKET') {
      setLimitPrice(activeTicker.price.toFixed(activeTicker.price < 10 ? 4 : 2));
    }
  }, [activeTicker?.price, selectedSymbol, orderType]);

  useEffect(() => {
    if (prefilledOrder) {
      if (prefilledOrder.symbol) onSelectSymbol(prefilledOrder.symbol);
      if (prefilledOrder.side) setSide(prefilledOrder.side);
      if (prefilledOrder.price) {
        setOrderType('LIMIT');
        setLimitPrice(String(prefilledOrder.price));
      }
      if (prefilledOrder.stopLoss) setStopLossInput(String(prefilledOrder.stopLoss));
      if (prefilledOrder.takeProfit) setTakeProfitInput(String(prefilledOrder.takeProfit));
      onClearPrefill();
    }
  }, [prefilledOrder, onSelectSymbol, onClearPrefill]);

  const effectivePrice =
    orderType === 'MARKET'
      ? activeTicker?.price ?? 0
      : Number(limitPrice) || activeTicker?.price || 0;

  const usdNumeric = Number(amountUsd) || 0;
  const computedQuantity = effectivePrice > 0 ? usdNumeric / effectivePrice : 0;

  const activePosition = paperAccount.positions.find((p) => p.symbol === selectedSymbol);

  const handleQuickPct = (pct: number) => {
    if (side === 'BUY') {
      const target = paperAccount.cashUsd * pct;
      setAmountUsd(target.toFixed(2));
    } else if (activePosition && effectivePrice > 0) {
      const target = activePosition.quantity * pct * effectivePrice;
      setAmountUsd(target.toFixed(2));
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderFeedback(null);
    if (!Number.isFinite(computedQuantity) || computedQuantity <= 0) {
      setOrderFeedback({ type: 'err', text: 'Informe um valor válido em USDT maior que zero.' });
      return;
    }
    setSubmittingOrder(true);
    const res = await onPlaceOrder({
      symbol: selectedSymbol,
      side,
      orderType,
      mode: executionMode,
      exchange: executionMode === 'paper' ? 'KronoQuant Paper' : selectedExchange,
      quantity: computedQuantity,
      price: effectivePrice,
      stopLoss: stopLossInput ? Number(stopLossInput) : undefined,
      takeProfit: takeProfitInput ? Number(takeProfitInput) : undefined,
      totpCode: totpCode || undefined,
    });
    setSubmittingOrder(false);
    if (res.ok) {
      setOrderFeedback({
        type: 'ok',
        text: `${side} ${computedQuantity.toFixed(5)} ${selectedSymbol} @ $${effectivePrice.toFixed(2)} executada com sucesso.`,
      });
      setTotpCode('');
    } else {
      setOrderFeedback({ type: 'err', text: res.error || 'Falha ao executar ordem.' });
    }
  };

  const handleGeneratePrediction = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const resp = await fetch('/api/ai/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedSymbol,
          timeframe,
          riskProfile,
          language,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setAiError(data.error || 'Não foi possível gerar a análise preditiva.');
      } else {
        setAiResult(data as AIPredictionResult);
      }
    } catch {
      setAiError('Erro de rede ao consultar análise preditiva.');
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiRecommendation = () => {
    if (!aiResult || !activeTicker) return;
    const rec = aiResult.personalizedRecommendation;
    const isSell = rec.action === 'take_profit' || rec.action === 'hedge';
    setSide(isSell ? 'SELL' : 'BUY');
    setOrderType('MARKET');
    const suggestedUsd = Math.max(
      100,
      Math.round((paperAccount.cashUsd * (rec.positionSizePct || 5)) / 100)
    );
    setAmountUsd(String(suggestedUsd));
    const slPrice = activeTicker.price * (1 - rec.stopLossPct / 100);
    const tpPrice = activeTicker.price * (1 + rec.takeProfitPct / 100);
    setStopLossInput(slPrice.toFixed(activeTicker.price < 10 ? 4 : 2));
    setTakeProfitInput(tpPrice.toFixed(activeTicker.price < 10 ? 4 : 2));
  };

  return (
    <div className="space-y-6">
      {/* Live Market Strip */}
      <section aria-label={t.terminal.marketOverview}>
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          {tickers.map((tk) => {
            const selected = tk.symbol === selectedSymbol;
            const pos = tk.change24h >= 0;
            return (
              <button
                key={tk.symbol}
                type="button"
                onClick={() => onSelectSymbol(tk.symbol)}
                className={`text-left p-3 rounded-xl border transition-colors focus-visible:outline-2 focus-visible:outline-blue-500 ${
                  selected
                    ? 'border-blue-500 bg-blue-500/8 dark:bg-blue-500/12'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    {tk.symbol}
                  </span>
                  <span
                    className={`text-[11px] font-mono tabular-nums font-medium ${
                      pos
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {pos ? '+' : ''}
                    {tk.change24h.toFixed(2)}%
                  </span>
                </div>
                <div className="mt-1.5 text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                  ${tk.price.toLocaleString('en-US', {
                    minimumFractionDigits: tk.price < 10 ? 3 : 2,
                    maximumFractionDigits: tk.price < 10 ? 3 : 2,
                  })}
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Vol {tk.volatility24h.toFixed(1)}% · {tk.name}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Workspace Split: Chart (8 cols) + Order Ticket (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-6">
          <CandlestickChart
            symbol={selectedSymbol}
            candles={candles}
            timeframe={timeframe}
            onChangeTimeframe={onChangeTimeframe}
            theme={theme}
            language={language}
            dataSource={candleSource}
          />

          {/* Gemini AI Predictive Analysis & Personalized Risk Engine */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {t.terminal.aiPredictiveTitle}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedSymbol}/USDT · Timeframe {timeframe} · Perfil{' '}
                  <strong className="text-slate-700 dark:text-slate-200">
                    {t.riskProfiles[riskProfile]}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={handleGeneratePrediction}
                disabled={aiLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white transition-colors whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{aiLoading ? t.terminal.aiGenerating : t.terminal.aiGenerateBtn}</span>
              </button>
            </div>

            {/* Technical Snapshot Strip */}
            {snapshot && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                <div>
                  <div className="text-slate-500 dark:text-slate-400">RSI (14)</div>
                  <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white mt-0.5">
                    {snapshot.rsi14.toFixed(1)}{' '}
                    <span className="text-[11px] font-normal text-slate-500">
                      {snapshot.rsi14 < 30 ? '· Sobrevenda' : snapshot.rsi14 > 70 ? '· Sobrecompra' : '· Neutro'}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">MACD Hist</div>
                  <div
                    className={`font-mono tabular-nums font-semibold mt-0.5 ${
                      snapshot.macdHist >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {snapshot.macdHist >= 0 ? '+' : ''}
                    {snapshot.macdHist.toFixed(3)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">ATR (14) Volatilidade</div>
                  <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white mt-0.5">
                    {snapshot.atrPercent.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Suporte / Resistência</div>
                  <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white mt-0.5">
                    ${snapshot.support.toFixed(0)} / ${snapshot.resistance.toFixed(0)}
                  </div>
                </div>
              </div>
            )}

            {aiError && (
              <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-600 dark:text-rose-300">
                {aiError}
              </div>
            )}

            {aiResult && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Viés Preditivo</div>
                    <div
                      className={`mt-0.5 text-sm font-semibold inline-flex items-center gap-1 ${
                        aiResult.bias === 'bullish'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : aiResult.bias === 'bearish'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {aiResult.bias === 'bullish' && <ArrowUpRight className="w-4 h-4" />}
                      {aiResult.bias === 'bearish' && <ArrowDownRight className="w-4 h-4" />}
                      {aiResult.bias === 'bullish'
                        ? 'Alta'
                        : aiResult.bias === 'bearish'
                        ? 'Baixa'
                        : 'Neutro'}{' '}
                      ({aiResult.confidence}%)
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{t.terminal.aiTarget24h}</div>
                    <div className="mt-0.5 text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      ${aiResult.target24hLow.toFixed(0)} – ${aiResult.target24hHigh.toFixed(0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{t.terminal.aiTarget7d}</div>
                    <div className="mt-0.5 text-sm font-mono tabular-nums font-semibold text-blue-600 dark:text-blue-400">
                      ${aiResult.target7d.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{t.terminal.aiInvalidation}</div>
                    <div className="mt-0.5 text-sm font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                      ${aiResult.invalidationLevel.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{t.terminal.aiVolatility}</div>
                    <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white capitalize">
                      {aiResult.volatilityRegime}
                    </div>
                  </div>
                </div>

                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {aiResult.summary}
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {t.terminal.aiRecommendation}:{' '}
                      <span className="uppercase text-blue-600 dark:text-blue-400">
                        {aiResult.personalizedRecommendation.action}
                      </span>{' '}
                      · Alocação {aiResult.personalizedRecommendation.positionSizePct}% · SL -
                      {aiResult.personalizedRecommendation.stopLossPct}% / TP +
                      {aiResult.personalizedRecommendation.takeProfitPct}%
                    </div>
                    <p>{aiResult.personalizedRecommendation.rationale}</p>
                  </div>
                  <button
                    type="button"
                    onClick={applyAiRecommendation}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors whitespace-nowrap shrink-0"
                  >
                    Aplicar no Simulador
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Paper Trading Simulator + Order Book */}
        <div className="xl:col-span-4 space-y-6">
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t.terminal.orderTicketTitle}
              </h2>
              <button
                type="button"
                onClick={() => setShowBankrollPanel((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>{t.terminal.resetBankroll}</span>
              </button>
            </div>

            {/* Execution Mode Toggle */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80">
              <button
                type="button"
                onClick={() => onChangeExecutionMode('paper')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  executionMode === 'paper'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {t.topbar.paperMode}
              </button>
              <button
                type="button"
                onClick={() => onChangeExecutionMode('exchange')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  executionMode === 'exchange'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {t.topbar.liveExchangeMode}
              </button>
            </div>

            {showBankrollPanel && (
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Banca Simulada sem Risco
                  </span>
                  <span className="font-mono tabular-nums text-slate-500">
                    Livre: ${paperAccount.cashUsd.toFixed(2)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <select
                    aria-label="Ação na banca"
                    value={bankrollAction}
                    onChange={(e) => setBankrollAction(e.target.value as 'reset' | 'topup')}
                    className="px-2 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="reset">Reiniciar Banca</option>
                    <option value="topup">Adicionar Saldo</option>
                  </select>
                  <input
                    type="number"
                    aria-label="Valor da banca em USDT"
                    value={bankrollAmount}
                    onChange={(e) => setBankrollAmount(e.target.value)}
                    min={100}
                    step={500}
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono tabular-nums rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await onResetBankroll(bankrollAction, Number(bankrollAmount) || 100000);
                      setShowBankrollPanel(false);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitOrder} className="space-y-3.5">
              {/* Buy / Sell Tabs */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSide('BUY')}
                  className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${
                    side === 'BUY'
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t.terminal.buy} {selectedSymbol}
                </button>
                <button
                  type="button"
                  onClick={() => setSide('SELL')}
                  className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${
                    side === 'SELL'
                      ? 'bg-rose-600 border-rose-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t.terminal.sell} {selectedSymbol}
                </button>
              </div>

              {executionMode === 'exchange' && (
                <div>
                  <label
                    htmlFor="ticket-exchange"
                    className="block text-xs text-slate-500 dark:text-slate-400 mb-1"
                  >
                    Corretora Conectada
                  </label>
                  <select
                    id="ticket-exchange"
                    value={selectedExchange}
                    onChange={(e) => setSelectedExchange(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    {exchanges.length === 0 ? (
                      <option value="">Nenhuma corretora conectada</option>
                    ) : (
                      exchanges.map((ex) => (
                        <option key={ex.id} value={ex.label}>
                          {ex.exchange} · {ex.label} ({ex.maskedApiKey})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="ticket-order-type"
                    className="block text-xs text-slate-500 dark:text-slate-400 mb-1"
                  >
                    Tipo de Ordem
                  </label>
                  <select
                    id="ticket-order-type"
                    value={orderType}
                    onChange={(e) =>
                      setOrderType(
                        e.target.value as 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT'
                      )
                    }
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="MARKET">{t.terminal.market}</option>
                    <option value="LIMIT">{t.terminal.limit}</option>
                    <option value="STOP_LOSS">{t.terminal.stopLoss}</option>
                    <option value="TAKE_PROFIT">{t.terminal.takeProfit}</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="ticket-price"
                    className="block text-xs text-slate-500 dark:text-slate-400 mb-1"
                  >
                    Preço (USDT)
                  </label>
                  <input
                    id="ticket-price"
                    type="number"
                    step="any"
                    disabled={orderType === 'MARKET'}
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 disabled:opacity-60 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <label htmlFor="ticket-amount-usd" className="text-slate-500 dark:text-slate-400">
                    {t.terminal.amountUsd}
                  </label>
                  <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {side === 'BUY'
                      ? `Disp: $${paperAccount.cashUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                      : `Pos: ${(activePosition?.quantity ?? 0).toFixed(5)} ${selectedSymbol}`}
                  </span>
                </div>
                <input
                  id="ticket-amount-usd"
                  ref={orderTicketInputRef}
                  type="number"
                  step="any"
                  min="1"
                  value={amountUsd}
                  onChange={(e) => setAmountUsd(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {[0.25, 0.5, 0.75, 1].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleQuickPct(pct)}
                      className="py-1 text-[11px] font-mono font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {pct * 100}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="ticket-sl"
                    className="block text-xs text-slate-500 dark:text-slate-400 mb-1"
                  >
                    Stop-Loss (Opcional)
                  </label>
                  <input
                    id="ticket-sl"
                    type="number"
                    step="any"
                    placeholder="Ex: 85000"
                    value={stopLossInput}
                    onChange={(e) => setStopLossInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="ticket-tp"
                    className="block text-xs text-slate-500 dark:text-slate-400 mb-1"
                  >
                    Take-Profit (Opcional)
                  </label>
                  <input
                    id="ticket-tp"
                    type="number"
                    step="any"
                    placeholder="Ex: 98000"
                    value={takeProfitInput}
                    onChange={(e) => setTakeProfitInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {executionMode === 'exchange' && twoFactorEnabled && require2FAForLiveOrders && (
                <div>
                  <label
                    htmlFor="ticket-totp"
                    className="block text-xs text-amber-600 dark:text-amber-400 mb-1 font-medium"
                  >
                    Código 2FA TOTP (6 dígitos)
                  </label>
                  <input
                    id="ticket-totp"
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-amber-500/50 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
                <span>{t.terminal.quantity} estimada</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {computedQuantity.toFixed(6)} {selectedSymbol}
                </span>
              </div>

              {orderFeedback && (
                <div
                  className={`p-2.5 rounded-lg text-xs ${
                    orderFeedback.type === 'ok'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {orderFeedback.text}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingOrder}
                className={`w-full py-2.5 text-xs font-semibold rounded-lg text-white transition-colors disabled:opacity-60 ${
                  side === 'BUY'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {submittingOrder
                  ? 'Processando...'
                  : `${t.terminal.executeOrder} (${side === 'BUY' ? t.terminal.buy : t.terminal.sell})`}
              </button>
            </form>
          </section>

          {/* Live Order Book */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t.terminal.orderBook} · {selectedSymbol}/USDT
              </h2>
              {orderBook && (
                <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {t.terminal.spread}: {orderBook.spreadPct.toFixed(3)}%
                </span>
              )}
            </div>

            {!orderBook ? (
              <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Carregando profundidade...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-xs font-mono tabular-nums">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-sans text-slate-500 pb-1 border-b border-slate-100 dark:border-slate-800">
                    <span>{t.terminal.bids}</span>
                    <span>Qtd</span>
                  </div>
                  {orderBook.bids.slice(0, 6).map((b, i) => (
                    <div key={i} className="flex justify-between py-0.5">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {b.price.toFixed(b.price < 10 ? 4 : 2)}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300">{b.size.toFixed(3)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-sans text-slate-500 pb-1 border-b border-slate-100 dark:border-slate-800">
                    <span>{t.terminal.asks}</span>
                    <span>Qtd</span>
                  </div>
                  {orderBook.asks.slice(0, 6).map((a, i) => (
                    <div key={i} className="flex justify-between py-0.5">
                      <span className="text-rose-600 dark:text-rose-400">
                        {a.price.toFixed(a.price < 10 ? 4 : 2)}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300">{a.size.toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

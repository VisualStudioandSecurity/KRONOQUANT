import React, { useMemo, useState } from 'react';
import { Download, Play } from 'lucide-react';
import type { BacktestResult, BacktestStrategy, Language, MarketTicker } from '../types/crypto';
import { runBacktest } from '../utils/backtestEngine';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportReports';
import { TRANSLATIONS } from '../i18n/translations';

interface BacktestViewProps {
  tickers: MarketTicker[];
  language: Language;
}

export const BacktestView: React.FC<BacktestViewProps> = ({ tickers, language }) => {
  const t = TRANSLATIONS[language];

  const [symbol, setSymbol] = useState('BTC');
  const [strategy, setStrategy] = useState<BacktestStrategy>('rsi_mean_reversion');
  const [days, setDays] = useState(90);
  const [initialCapital, setInitialCapital] = useState(25000);
  const [feePct, setFeePct] = useState(0.1);
  const [stopLossPct, setStopLossPct] = useState(5);
  const [takeProfitPct, setTakeProfitPct] = useState(12);
  const [minMacroSellForcePct, setMinMacroSellForcePct] = useState(60);
  const [minOrderBookSellPct, setMinOrderBookSellPct] = useState(55);
  const [requireWhaleSellOrders, setRequireWhaleSellOrders] = useState(true);
  const [minWhaleVolumeMultiplier, setMinWhaleVolumeMultiplier] = useState(1.45);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setRunning(true);
    setError(null);
    try {
      const resp = await fetch(`/api/market/candles?symbol=${symbol}&interval=1d&limit=${days}`);
      const data = await resp.json();
      if (!resp.ok || !Array.isArray(data.candles)) {
        setError('Erro ao carregar série histórica para backtesting.');
      } else {
        const res = runBacktest(data.candles, {
          symbol,
          strategy,
          days,
          initialCapital,
          feePct,
          stopLossPct,
          takeProfitPct,
          macroWhaleSellParams:
            strategy === 'macro_whale_sell'
              ? {
                  minMacroSellForcePct,
                  minOrderBookSellPct,
                  requireWhaleSellOrders,
                  minWhaleVolumeMultiplier,
                }
              : undefined,
        });
        setResult(res);
      }
    } catch {
      setError('Falha de conexão ao executar backtesting.');
    } finally {
      setRunning(false);
    }
  };

  const chartPaths = useMemo(() => {
    if (!result || result.equityCurve.length < 2) return null;
    const curve = result.equityCurve;
    const w = 780;
    const h = 220;
    const allVals = curve.flatMap((pt) => [pt.strategyEquity, pt.holdEquity]);
    const min = Math.min(...allVals) * 0.98;
    const max = Math.max(...allVals) * 1.02;
    const span = Math.max(1, max - min);

    const toPoints = (getter: (pt: (typeof curve)[number]) => number) =>
      curve
        .map((pt, i) => {
          const x = (i / (curve.length - 1)) * w;
          const y = h - ((getter(pt) - min) / span) * (h - 24) - 12;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');

    return {
      strategyPoints: toPoints((p) => p.strategyEquity),
      holdPoints: toPoints((p) => p.holdEquity),
    };
  }, [result]);

  const handleExportCSV = () => {
    if (!result) return;
    exportToCSV(
      `kronoquant-backtest-${result.config.symbol}-${result.config.strategy}.csv`,
      ['Trade #', 'Lado', 'Entrada', 'Saída', 'Preço Entrada ($)', 'Preço Saída ($)', 'P&L ($)', 'P&L (%)', 'Motivo / Validação'],
      result.trades.map((tr) => [
        tr.id,
        tr.side ?? 'LONG',
        new Date(tr.entryTime).toISOString().slice(0, 10),
        new Date(tr.exitTime).toISOString().slice(0, 10),
        tr.entryPrice.toFixed(2),
        tr.exitPrice.toFixed(2),
        tr.pnlUsd.toFixed(2),
        tr.pnlPct.toFixed(2),
        tr.validationMetrics
          ? `${tr.exitReason} (Macro ${tr.validationMetrics.macroSellForcePct.toFixed(0)}% / Livro ${tr.validationMetrics.orderBookSellPct.toFixed(0)}%)`
          : tr.exitReason,
      ])
    );
  };

  const handleExportExcel = () => {
    if (!result) return;
    exportToExcel(`kronoquant-backtest-${result.config.symbol}-${result.config.strategy}.xlsx`, [
      {
        name: 'Métricas Backtest',
        rows: [
          {
            Ativo: result.config.symbol,
            Estratégia: result.config.strategy,
            'Período (dias)': result.config.days,
            'Capital Inicial ($)': result.config.initialCapital,
            'Capital Final ($)': Number(result.finalEquity.toFixed(2)),
            'Retorno Estratégia (%)': Number(result.totalReturnPct.toFixed(2)),
            'Buy & Hold (%)': Number(result.buyAndHoldReturnPct.toFixed(2)),
            'Drawdown Máximo (%)': Number(result.maxDrawdownPct.toFixed(2)),
            'Taxa de Acerto (%)': Number(result.winRatePct.toFixed(2)),
            'Índice Sharpe': Number(result.sharpeRatio.toFixed(2)),
          },
        ],
      },
      {
        name: 'Operações Simuladas',
        rows: result.trades.map((tr) => ({
          '#': tr.id,
          Lado: tr.side ?? 'LONG',
          Entrada: new Date(tr.entryTime).toISOString().slice(0, 10),
          Saída: new Date(tr.exitTime).toISOString().slice(0, 10),
          'Preço Entrada ($)': Number(tr.entryPrice.toFixed(2)),
          'Preço Saída ($)': Number(tr.exitPrice.toFixed(2)),
          'P&L ($)': Number(tr.pnlUsd.toFixed(2)),
          'P&L (%)': Number(tr.pnlPct.toFixed(2)),
          Motivo: tr.validationMetrics
            ? `${tr.exitReason} · M:${tr.validationMetrics.macroSellForcePct.toFixed(0)}% L:${tr.validationMetrics.orderBookSellPct.toFixed(0)}%`
            : tr.exitReason,
        })),
      },
    ]);
  };

  const handleExportPDF = () => {
    if (!result) return;
    exportToPDF(
      `kronoquant-backtest-${result.config.symbol}-${result.config.strategy}.pdf`,
      `Relatório de Backtesting Histórico · ${result.config.symbol}/USDT (${result.config.strategy})`,
      `Janela: ${result.config.days} dias · ${new Date().toLocaleDateString()}`,
      [
        { label: t.backtest.totalReturn, value: `${result.totalReturnPct.toFixed(2)}%` },
        { label: t.backtest.buyHold, value: `${result.buyAndHoldReturnPct.toFixed(2)}%` },
        { label: t.backtest.maxDrawdown, value: `${result.maxDrawdownPct.toFixed(2)}%` },
        { label: t.backtest.sharpe, value: result.sharpeRatio.toFixed(2) },
        { label: t.portfolio.winRate, value: `${result.winRatePct.toFixed(1)}%` },
      ],
      ['#', 'Lado', 'Entrada', 'Saída', 'Preço Entrada', 'Preço Saída', 'P&L ($)', 'P&L (%)', 'Motivo'],
      result.trades.slice(0, 35).map((tr) => [
        tr.id,
        tr.side ?? 'LONG',
        new Date(tr.entryTime).toISOString().slice(0, 10),
        new Date(tr.exitTime).toISOString().slice(0, 10),
        `$${tr.entryPrice.toFixed(2)}`,
        `$${tr.exitPrice.toFixed(2)}`,
        `$${tr.pnlUsd.toFixed(2)}`,
        `${tr.pnlPct.toFixed(2)}%`,
        tr.validationMetrics
          ? `${tr.exitReason} (M:${tr.validationMetrics.macroSellForcePct.toFixed(0)}% L:${tr.validationMetrics.orderBookSellPct.toFixed(0)}%)`
          : tr.exitReason,
      ])
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {t.backtest.title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.backtest.subtitle}</p>
        </div>

        <form onSubmit={handleRun} className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
          <div>
            <label htmlFor="bt-asset" className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              {t.backtest.asset}
            </label>
            <select
              id="bt-asset"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            >
              {tickers.map((tk) => (
                <option key={tk.symbol} value={tk.symbol}>
                  {tk.symbol}/USDT
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label htmlFor="bt-strategy" className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              {t.backtest.strategy}
            </label>
            <select
              id="bt-strategy"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as BacktestStrategy)}
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            >
              <option value="rsi_mean_reversion">Reversão à Média RSI (32/68)</option>
              <option value="ema_cross">Cruzamento EMA 12 / 26</option>
              <option value="bollinger_breakout">Rompimento Bandas de Bollinger</option>
              <option value="macd_momentum">Momentum MACD (12,26,9)</option>
              <option value="macro_whale_sell">
                Venda Institucional (Macro 60% + Livro 55% + Baleias)
              </option>
            </select>
          </div>

          <div>
            <label htmlFor="bt-days" className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              {t.backtest.lookback}
            </label>
            <select
              id="bt-days"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            >
              <option value={30}>30 dias</option>
              <option value={90}>90 dias</option>
              <option value={180}>180 dias</option>
              <option value={365}>365 dias</option>
            </select>
          </div>

          <div>
            <label htmlFor="bt-cap" className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              {t.backtest.capital}
            </label>
            <input
              id="bt-cap"
              type="number"
              min={500}
              value={initialCapital}
              onChange={(e) => setInitialCapital(Number(e.target.value) || 10000)}
              className="w-full px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="bt-sl" className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              {t.backtest.stopLossPct}
            </label>
            <input
              id="bt-sl"
              type="number"
              step="0.5"
              min={0}
              value={stopLossPct}
              onChange={(e) => setStopLossPct(Number(e.target.value) || 0)}
              className="w-full px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label htmlFor="bt-tp" className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              {t.backtest.takeProfitPct}
            </label>
            <input
              id="bt-tp"
              type="number"
              step="0.5"
              min={0}
              value={takeProfitPct}
              onChange={(e) => setTakeProfitPct(Number(e.target.value) || 0)}
              className="w-full px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={running}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{running ? t.backtest.running : t.backtest.runBacktest}</span>
          </button>
        </form>

        {strategy === 'macro_whale_sell' && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div>
              <label htmlFor="bt-macro-sell" className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Força de Venda Macro Mínima (%)
              </label>
              <input
                id="bt-macro-sell"
                type="number"
                min={1}
                max={100}
                value={minMacroSellForcePct}
                onChange={(e) => setMinMacroSellForcePct(Number(e.target.value) || 60)}
                className="w-full px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="bt-book-sell" className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Livro de Ordens de Venda Mínimo (%)
              </label>
              <input
                id="bt-book-sell"
                type="number"
                min={1}
                max={100}
                value={minOrderBookSellPct}
                onChange={(e) => setMinOrderBookSellPct(Number(e.target.value) || 55)}
                className="w-full px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="bt-whale-mult" className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Volume Baleia (x Média 20p)
              </label>
              <input
                id="bt-whale-mult"
                type="number"
                step="0.05"
                min={1}
                max={10}
                value={minWhaleVolumeMultiplier}
                onChange={(e) => setMinWhaleVolumeMultiplier(Number(e.target.value) || 1.45)}
                className="w-full px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <label className="inline-flex items-center gap-2 py-2 text-xs font-medium text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={requireWhaleSellOrders}
                onChange={(e) => setRequireWhaleSellOrders(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Exigir ordens de baleias vendendo</span>
            </label>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-500">
            {error}
          </div>
        )}
      </section>

      {result && (
        <>
          {result.validationSummary && (
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Força Macro &ge; {result.config.macroWhaleSellParams?.minMacroSellForcePct ?? 60}%
                </div>
                <div className="mt-1 text-base font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {result.validationSummary.macroSellPassedBars} / {result.validationSummary.evaluatedBars} barras
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Livro de Venda &ge; {result.config.macroWhaleSellParams?.minOrderBookSellPct ?? 55}%
                </div>
                <div className="mt-1 text-base font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {result.validationSummary.orderBookSellPassedBars} / {result.validationSummary.evaluatedBars} barras
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Ordens de Baleias Vendendo
                </div>
                <div className="mt-1 text-base font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                  {result.validationSummary.whaleSellBars} blocos detectados
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Confluência Validada (3/3)
                </div>
                <div className="mt-1 text-base font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                  {result.validationSummary.allCriteriaMetBars} sinais · {result.totalTrades} ordens SHORT
                </div>
              </div>
            </section>
          )}
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F]">
              <div className="text-xs text-slate-500 dark:text-slate-400">{t.backtest.totalReturn}</div>
              <div
                className={`mt-1 text-xl font-mono tabular-nums font-bold ${
                  result.totalReturnPct >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {result.totalReturnPct >= 0 ? '+' : ''}
                {result.totalReturnPct.toFixed(2)}%
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                Final: ${result.finalEquity.toFixed(0)}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F]">
              <div className="text-xs text-slate-500 dark:text-slate-400">{t.backtest.buyHold}</div>
              <div className="mt-1 text-xl font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                {result.buyAndHoldReturnPct >= 0 ? '+' : ''}
                {result.buyAndHoldReturnPct.toFixed(2)}%
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                Alpha: {result.alphaPct >= 0 ? '+' : ''}
                {result.alphaPct.toFixed(2)}%
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F]">
              <div className="text-xs text-slate-500 dark:text-slate-400">{t.backtest.maxDrawdown}</div>
              <div className="mt-1 text-xl font-mono tabular-nums font-bold text-rose-600 dark:text-rose-400">
                -{result.maxDrawdownPct.toFixed(2)}%
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F]">
              <div className="text-xs text-slate-500 dark:text-slate-400">{t.portfolio.winRate}</div>
              <div className="mt-1 text-xl font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                {result.winRatePct.toFixed(1)}%
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                {result.totalTrades} {t.backtest.tradesCount}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F]">
              <div className="text-xs text-slate-500 dark:text-slate-400">{t.backtest.profitFactor}</div>
              <div className="mt-1 text-xl font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                {result.profitFactor.toFixed(2)}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F]">
              <div className="text-xs text-slate-500 dark:text-slate-400">{t.backtest.sharpe}</div>
              <div className="mt-1 text-xl font-mono tabular-nums font-bold text-blue-600 dark:text-blue-400">
                {result.sharpeRatio.toFixed(2)}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4 text-xs">
                <span className="font-semibold text-slate-900 dark:text-white">
                  Comparativo de Curva de Capital
                </span>
                <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <span className="w-3 h-0.5 bg-blue-600 inline-block" /> {t.backtest.strategyEquity}
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-500">
                  <span className="w-3 h-0.5 bg-slate-400 inline-block" /> {t.backtest.holdBenchmark}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" /> Excel
                </button>
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:opacity-90"
                >
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
              </div>
            </div>

            {chartPaths && (
              <svg viewBox="0 0 780 220" className="w-full h-52" role="img" aria-label="Curva de Backtesting">
                <polyline
                  fill="none"
                  stroke="#94A3B8"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                  points={chartPaths.holdPoints}
                />
                <polyline
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2.5"
                  points={chartPaths.strategyPoints}
                />
              </svg>
            )}

            <div className="overflow-x-auto pt-2 border-t border-slate-100 dark:border-slate-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="text-left font-medium py-2 pr-3">#</th>
                    <th className="text-left font-medium py-2 px-3">Lado</th>
                    <th className="text-left font-medium py-2 px-3">Entrada</th>
                    <th className="text-left font-medium py-2 px-3">Saída</th>
                    <th className="text-right font-medium py-2 px-3">Preço Entrada</th>
                    <th className="text-right font-medium py-2 px-3">Preço Saída</th>
                    <th className="text-right font-medium py-2 px-3">P&L ($)</th>
                    <th className="text-right font-medium py-2 px-3">P&L (%)</th>
                    <th className="text-right font-medium py-2 pl-3">Motivo / Validação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {result.trades.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                        Nenhuma operação executada: os critérios configurados não atingiram confluência simultânea nesta janela.
                      </td>
                    </tr>
                  ) : (
                    result.trades.slice(0, 25).map((tr) => (
                      <tr key={tr.id}>
                        <td className="py-2 pr-3 font-mono tabular-nums text-slate-500">{tr.id}</td>
                        <td
                          className={`py-2 px-3 font-semibold ${
                            tr.side === 'SHORT'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {tr.side ?? 'LONG'}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums">
                          {new Date(tr.entryTime).toISOString().slice(0, 10)}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums">
                          {new Date(tr.exitTime).toISOString().slice(0, 10)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          ${tr.entryPrice.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          ${tr.exitPrice.toFixed(2)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono tabular-nums font-medium ${
                            tr.pnlUsd >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {tr.pnlUsd >= 0 ? '+' : ''}${tr.pnlUsd.toFixed(2)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono tabular-nums ${
                            tr.pnlPct >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {tr.pnlPct >= 0 ? '+' : ''}
                          {tr.pnlPct.toFixed(2)}%
                        </td>
                        <td className="py-2 pl-3 text-right text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          {tr.validationMetrics
                            ? `${tr.exitReason} · M:${tr.validationMetrics.macroSellForcePct.toFixed(0)}% L:${tr.validationMetrics.orderBookSellPct.toFixed(0)}%`
                            : tr.exitReason}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

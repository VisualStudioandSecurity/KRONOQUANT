import React, { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import type { Language, MarketTicker, PaperAccountState } from '../types/crypto';
import { computePortfolioSummary } from '../utils/portfolioMath';
import { exportToCSV, exportToExcel, exportToPDF } from '../utils/exportReports';
import { TRANSLATIONS } from '../i18n/translations';

interface PortfolioViewProps {
  paperAccount: PaperAccountState;
  tickers: MarketTicker[];
  language: Language;
  onClosePosition: (symbol: string, quantity: number, currentPrice: number) => Promise<void>;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  paperAccount,
  tickers,
  language,
  onClosePosition,
}) => {
  const t = TRANSLATIONS[language];
  const [searchQuery, setSearchQuery] = useState('');
  const [sideFilter, setSideFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [closingSymbol, setClosingSymbol] = useState<string | null>(null);

  const summary = useMemo(
    () => computePortfolioSummary(paperAccount, tickers),
    [paperAccount, tickers]
  );

  const priceMap = useMemo(() => new Map(tickers.map((x) => [x.symbol, x.price])), [tickers]);

  const enrichedPositions = useMemo(() => {
    return paperAccount.positions.map((pos) => {
      const currentPrice = priceMap.get(pos.symbol) ?? pos.avgEntryPrice;
      const marketValue = pos.quantity * currentPrice;
      const unrealizedPnl = marketValue - pos.totalCost;
      const pnlPct = pos.totalCost > 0 ? (unrealizedPnl / pos.totalCost) * 100 : 0;
      const weightPct = summary.totalEquity > 0 ? (marketValue / summary.totalEquity) * 100 : 0;
      return { ...pos, currentPrice, marketValue, unrealizedPnl, pnlPct, weightPct };
    });
  }, [paperAccount.positions, priceMap, summary.totalEquity]);

  const filteredTrades = useMemo(() => {
    return paperAccount.trades.filter((tr) => {
      if (sideFilter !== 'ALL' && tr.side !== sideFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          tr.symbol.toLowerCase().includes(q) ||
          tr.exchange.toLowerCase().includes(q) ||
          tr.id.toLowerCase().includes(q) ||
          (tr.note ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [paperAccount.trades, sideFilter, searchQuery]);

  // SVG Equity Curve points
  const curveSeries = useMemo(() => {
    const base = [...paperAccount.equityHistory];
    const today = new Date().toISOString().slice(0, 10);
    if (base.length === 0 || base[base.length - 1].time !== today) {
      base.push({ time: today, equity: summary.totalEquity });
    } else {
      base[base.length - 1] = { time: today, equity: summary.totalEquity };
    }
    return base;
  }, [paperAccount.equityHistory, summary.totalEquity]);

  const svgPoints = useMemo(() => {
    if (curveSeries.length < 2) return '';
    const w = 720;
    const h = 180;
    const vals = curveSeries.map((c) => c.equity);
    const min = Math.min(...vals) * 0.99;
    const max = Math.max(...vals) * 1.01;
    const span = Math.max(1, max - min);
    return curveSeries
      .map((pt, i) => {
        const x = (i / (curveSeries.length - 1)) * w;
        const y = h - ((pt.equity - min) / span) * (h - 24) - 12;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [curveSeries]);

  const handleExportCSV = () => {
    exportToCSV(
      `kronoquant-portfolio-${new Date().toISOString().slice(0, 10)}.csv`,
      ['ID', 'Data', 'Ativo', 'Lado', 'Tipo', 'Modo', 'Exchange', 'Qtd', 'Preço ($)', 'Total ($)', 'P&L Realizado ($)'],
      filteredTrades.map((tr) => [
        tr.id,
        tr.timestamp,
        tr.symbol,
        tr.side,
        tr.orderType,
        tr.mode,
        tr.exchange,
        tr.quantity.toFixed(6),
        tr.price.toFixed(2),
        tr.totalUsd.toFixed(2),
        tr.realizedPnlUsd.toFixed(2),
      ])
    );
  };

  const handleExportExcel = () => {
    exportToExcel(`kronoquant-portfolio-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        name: 'Resumo Portfólio',
        rows: [
          {
            'Patrimônio Total ($)': Number(summary.totalEquity.toFixed(2)),
            'Caixa Livre ($)': Number(paperAccount.cashUsd.toFixed(2)),
            'P&L Não Realizado ($)': Number(summary.unrealizedPnl.toFixed(2)),
            'P&L Realizado ($)': Number(summary.realizedPnl.toFixed(2)),
            'Retorno Total (%)': Number(summary.totalReturnPct.toFixed(2)),
          },
        ],
      },
      {
        name: 'Posições Abertas',
        rows: enrichedPositions.map((p) => ({
          Ativo: p.symbol,
          Quantidade: Number(p.quantity.toFixed(6)),
          'Preço Médio ($)': Number(p.avgEntryPrice.toFixed(2)),
          'Preço Atual ($)': Number(p.currentPrice.toFixed(2)),
          'Valor de Mercado ($)': Number(p.marketValue.toFixed(2)),
          'P&L ($)': Number(p.unrealizedPnl.toFixed(2)),
        })),
      },
      {
        name: 'Transações',
        rows: filteredTrades.map((tr) => ({
          ID: tr.id,
          Data: tr.timestamp,
          Ativo: tr.symbol,
          Lado: tr.side,
          Exchange: tr.exchange,
          Quantidade: Number(tr.quantity.toFixed(6)),
          'Preço ($)': Number(tr.price.toFixed(2)),
          'Total ($)': Number(tr.totalUsd.toFixed(2)),
          'P&L Realizado ($)': Number(tr.realizedPnlUsd.toFixed(2)),
        })),
      },
    ]);
  };

  const handleExportPDF = () => {
    exportToPDF(
      `kronoquant-portfolio-${new Date().toISOString().slice(0, 10)}.pdf`,
      'Relatório Analítico de Portfólio e P&L',
      `Gerado em ${new Date().toLocaleString()}`,
      [
        { label: t.portfolio.totalEquity, value: `$${summary.totalEquity.toFixed(2)}` },
        { label: t.portfolio.unrealizedPnl, value: `$${summary.unrealizedPnl.toFixed(2)}` },
        { label: t.portfolio.realizedPnl, value: `$${summary.realizedPnl.toFixed(2)}` },
        { label: 'Retorno (%)', value: `${summary.totalReturnPct.toFixed(2)}%` },
      ],
      ['ID', 'Ativo', 'Lado', 'Exchange', 'Qtd', 'Preço', 'Total', 'P&L'],
      filteredTrades.slice(0, 30).map((tr) => [
        tr.id,
        tr.symbol,
        tr.side,
        tr.exchange,
        tr.quantity.toFixed(4),
        `$${tr.price.toFixed(2)}`,
        `$${tr.totalUsd.toFixed(2)}`,
        `$${tr.realizedPnlUsd.toFixed(2)}`,
      ])
    );
  };

  return (
    <div className="space-y-6">
      {/* 4-Column KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F]">
          <div className="text-xs text-slate-500 dark:text-slate-400">{t.portfolio.totalEquity}</div>
          <div className="mt-1 text-2xl font-mono tabular-nums font-bold text-slate-900 dark:text-white">
            ${summary.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div
            className={`mt-1 text-xs font-mono tabular-nums ${
              summary.totalReturnPct >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {summary.totalReturnPct >= 0 ? '+' : ''}
            {summary.totalReturnPct.toFixed(2)}% vs banca inicial
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F]">
          <div className="text-xs text-slate-500 dark:text-slate-400">{t.portfolio.unrealizedPnl}</div>
          <div
            className={`mt-1 text-2xl font-mono tabular-nums font-bold ${
              summary.unrealizedPnl >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {summary.unrealizedPnl >= 0 ? '+' : ''}$
            {summary.unrealizedPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Em {enrichedPositions.length} posições abertas
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F]">
          <div className="text-xs text-slate-500 dark:text-slate-400">{t.portfolio.realizedPnl}</div>
          <div
            className={`mt-1 text-2xl font-mono tabular-nums font-bold ${
              summary.realizedPnl >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {summary.realizedPnl >= 0 ? '+' : ''}$
            {summary.realizedPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Caixa livre: ${paperAccount.cashUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F]">
          <div className="text-xs text-slate-500 dark:text-slate-400">{t.portfolio.winRate}</div>
          <div className="mt-1 text-2xl font-mono tabular-nums font-bold text-slate-900 dark:text-white">
            {summary.winRatePct.toFixed(1)}%
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {paperAccount.trades.length} ordens registradas
          </div>
        </div>
      </section>

      {/* Equity Curve + Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t.portfolio.equityCurve}
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {curveSeries[0]?.time} → {curveSeries[curveSeries.length - 1]?.time}
            </span>
          </div>
          <div className="w-full overflow-hidden">
            <svg viewBox="0 0 720 180" className="w-full h-44" role="img" aria-label="Curva de patrimônio">
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {svgPoints && (
                <>
                  <polygon points={`0,180 ${svgPoints} 720,180`} fill="url(#eqGrad)" />
                  <polyline
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="2.5"
                    points={svgPoints}
                  />
                </>
              )}
            </svg>
          </div>
        </section>

        <section className="lg:col-span-4 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Alocação do Capital
          </h2>
          <div className="space-y-3 pt-1">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 dark:text-slate-300">USDT (Caixa Livre)</span>
                <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                  {summary.totalEquity > 0
                    ? ((paperAccount.cashUsd / summary.totalEquity) * 100).toFixed(1)
                    : '100.0'}
                  %
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-slate-500"
                  style={{
                    width: `${
                      summary.totalEquity > 0
                        ? Math.min(100, (paperAccount.cashUsd / summary.totalEquity) * 100)
                        : 100
                    }%`,
                  }}
                />
              </div>
            </div>

            {enrichedPositions.map((p) => (
              <div key={p.symbol}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-300">{p.symbol}</span>
                  <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                    {p.weightPct.toFixed(1)}% · ${p.marketValue.toFixed(0)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-600"
                    style={{ width: `${Math.min(100, p.weightPct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Open Positions */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t.portfolio.openPositions}
          </h2>
        </div>
        {enrichedPositions.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
            {t.portfolio.noPositions}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="text-left font-medium px-5 py-2.5">Ativo</th>
                  <th className="text-right font-medium px-4 py-2.5">Quantidade</th>
                  <th className="text-right font-medium px-4 py-2.5">Entrada Média</th>
                  <th className="text-right font-medium px-4 py-2.5">Preço Atual</th>
                  <th className="text-right font-medium px-4 py-2.5">Valor Mercado</th>
                  <th className="text-right font-medium px-4 py-2.5">P&L Não Realizado</th>
                  <th className="text-right font-medium px-5 py-2.5">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {enrichedPositions.map((pos) => (
                  <tr
                    key={pos.symbol}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-5 py-3 font-semibold text-slate-900 dark:text-white">
                      {pos.symbol}/USDT
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {pos.quantity.toFixed(5)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      ${pos.avgEntryPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      ${pos.currentPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                      ${pos.marketValue.toFixed(2)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums font-semibold ${
                        pos.unrealizedPnl >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {pos.unrealizedPnl >= 0 ? '+' : ''}${pos.unrealizedPnl.toFixed(2)} (
                      {pos.pnlPct >= 0 ? '+' : ''}
                      {pos.pnlPct.toFixed(2)}%)
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        disabled={closingSymbol === pos.symbol}
                        onClick={async () => {
                          setClosingSymbol(pos.symbol);
                          await onClosePosition(pos.symbol, pos.quantity, pos.currentPrice);
                          setClosingSymbol(null);
                        }}
                        className="px-3 py-1 text-xs font-medium rounded-md border border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
                      >
                        {closingSymbol === pos.symbol ? '...' : t.portfolio.closePosition}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Instant Transaction Ledger + Exports */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {t.portfolio.ledgerTitle}
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                aria-label="Filtrar transações"
                placeholder="Filtrar ativo ou corretora..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <select
              aria-label="Filtrar lado da ordem"
              value={sideFilter}
              onChange={(e) => setSideFilter(e.target.value as 'ALL' | 'BUY' | 'SELL')}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <option value="ALL">Todas</option>
              <option value="BUY">Compras</option>
              <option value="SELL">Vendas</option>
            </select>

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.portfolio.exportCsv}</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.portfolio.exportExcel}</span>
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:opacity-90 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.portfolio.exportPdf}</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="text-left font-medium px-5 py-2.5">Data / Hora</th>
                <th className="text-left font-medium px-4 py-2.5">Ativo</th>
                <th className="text-left font-medium px-4 py-2.5">Operação</th>
                <th className="text-left font-medium px-4 py-2.5">Corretora</th>
                <th className="text-right font-medium px-4 py-2.5">Quantidade</th>
                <th className="text-right font-medium px-4 py-2.5">Preço</th>
                <th className="text-right font-medium px-4 py-2.5">Total</th>
                <th className="text-right font-medium px-5 py-2.5">P&L Realizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredTrades.map((tr) => (
                <tr key={tr.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-2.5 font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {new Date(tr.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">
                    {tr.symbol}
                  </td>
                  <td
                    className={`px-4 py-2.5 font-semibold ${
                      tr.side === 'BUY'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {tr.side} · {tr.orderType}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{tr.exchange}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {tr.quantity.toFixed(5)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    ${tr.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    ${tr.totalUsd.toFixed(2)}
                  </td>
                  <td
                    className={`px-5 py-2.5 text-right font-mono tabular-nums font-medium ${
                      tr.realizedPnlUsd > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : tr.realizedPnlUsd < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {tr.realizedPnlUsd === 0
                      ? '—'
                      : `${tr.realizedPnlUsd > 0 ? '+' : ''}$${tr.realizedPnlUsd.toFixed(2)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

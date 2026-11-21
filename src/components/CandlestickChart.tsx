import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import type { Candle, Language, ThemeMode, Timeframe } from '../types/crypto';
import {
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSMA,
} from '../utils/indicators';
import { TRANSLATIONS } from '../i18n/translations';

export type ChartType = 'candles' | 'line' | 'area';
export type SubPaneType = 'rsi' | 'macd' | 'none';

interface CandlestickChartProps {
  symbol: string;
  candles: Candle[];
  timeframe: Timeframe;
  onChangeTimeframe: (tf: Timeframe) => void;
  theme: ThemeMode;
  language: Language;
  dataSource: string;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  symbol,
  candles,
  timeframe,
  onChangeTimeframe,
  theme,
  language,
  dataSource,
}) => {
  const t = TRANSLATIONS[language];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [chartType, setChartType] = useState<ChartType>('candles');
  const [showSMA20, setShowSMA20] = useState(true);
  const [showEMA, setShowEMA] = useState(true);
  const [showBB, setShowBB] = useState(false);
  const [subPane, setSubPane] = useState<SubPaneType>('rsi');

  const [visibleCount, setVisibleCount] = useState(72);
  const [offsetFromEnd, setOffsetFromEnd] = useState(0);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; offset: number } | null>(null);

  const indicators = useMemo(() => {
    const closes = candles.map((c) => c.close);
    return {
      sma20: calculateSMA(closes, 20),
      ema12: calculateEMA(closes, 12),
      ema26: calculateEMA(closes, 26),
      bb: calculateBollingerBands(closes, 20, 2),
      rsi: calculateRSI(closes, 14),
      macd: calculateMACD(closes, 12, 26, 9),
    };
  }, [candles]);

  const slicedRange = useMemo(() => {
    const total = candles.length;
    if (total === 0) return { start: 0, end: 0 };
    const count = Math.min(total, Math.max(20, visibleCount));
    const maxOffset = Math.max(0, total - count);
    const clampedOffset = Math.min(maxOffset, Math.max(0, offsetFromEnd));
    const end = total - clampedOffset;
    const start = Math.max(0, end - count);
    return { start, end };
  }, [candles.length, visibleCount, offsetFromEnd]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = container.clientWidth;
    const height = 380;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const isDark = theme === 'dark';
    const bg = isDark ? '#0E131F' : '#FFFFFF';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(15, 23, 42, 0.06)';
    const axisText = isDark ? '#94A3B8' : '#64748B';
    const bullColor = '#16A34A';
    const bearColor = '#DC2626';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const { start, end } = slicedRange;
    const slice = candles.slice(start, end);
    if (slice.length === 0) return;

    const padLeft = 14;
    const padRight = 72;
    const padTop = 16;
    const hasSub = subPane !== 'none';
    const subHeight = hasSub ? 88 : 0;
    const subGap = hasSub ? 14 : 0;
    const bottomAxisHeight = 24;
    const mainHeight = height - padTop - subHeight - subGap - bottomAxisHeight;
    const plotWidth = Math.max(100, width - padLeft - padRight);

    // Price domain
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    for (let i = start; i < end; i++) {
      const c = candles[i];
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
      if (showBB) {
        const up = indicators.bb.upper[i];
        const lo = indicators.bb.lower[i];
        if (up !== null && up > maxPrice) maxPrice = up;
        if (lo !== null && lo < minPrice) minPrice = lo;
      }
    }
    if (!Number.isFinite(minPrice) || minPrice === maxPrice) {
      minPrice = (slice[0]?.close ?? 100) * 0.98;
      maxPrice = (slice[0]?.close ?? 100) * 1.02;
    }
    const pricePad = (maxPrice - minPrice) * 0.08;
    minPrice -= pricePad;
    maxPrice += pricePad;

    const priceToY = (p: number) =>
      padTop + ((maxPrice - p) / (maxPrice - minPrice)) * mainHeight;

    const maxVol = Math.max(...slice.map((c) => c.volume), 1);
    const stepX = plotWidth / slice.length;
    const candleW = Math.max(2, Math.min(12, stepX * 0.68));

    // Horizontal grid + right Y-axis labels
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const gridRows = 5;
    for (let r = 0; r <= gridRows; r++) {
      const y = padTop + (mainHeight / gridRows) * r;
      const pVal = maxPrice - ((maxPrice - minPrice) / gridRows) * r;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotWidth, y);
      ctx.stroke();

      ctx.fillStyle = axisText;
      const decimals = pVal < 10 ? 4 : pVal < 1000 ? 2 : 0;
      ctx.fillText(`$${pVal.toFixed(decimals)}`, padLeft + plotWidth + 8, y);
    }

    // Volume bars in bottom 18% of main pane
    const volZoneH = mainHeight * 0.18;
    slice.forEach((c, idx) => {
      const x = padLeft + idx * stepX + stepX / 2;
      const h = (c.volume / maxVol) * volZoneH;
      const isBull = c.close >= c.open;
      ctx.fillStyle = isBull ? 'rgba(22, 163, 74, 0.18)' : 'rgba(220, 38, 38, 0.18)';
      ctx.fillRect(x - candleW / 2, padTop + mainHeight - h, candleW, h);
    });

    // Bollinger Bands shaded corridor
    if (showBB) {
      ctx.beginPath();
      let started = false;
      for (let i = start; i < end; i++) {
        const up = indicators.bb.upper[i];
        if (up === null) continue;
        const x = padLeft + (i - start) * stepX + stepX / 2;
        const y = priceToY(up);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      for (let i = end - 1; i >= start; i--) {
        const lo = indicators.bb.lower[i];
        if (lo === null) continue;
        const x = padLeft + (i - start) * stepX + stepX / 2;
        ctx.lineTo(x, priceToY(lo));
      }
      ctx.closePath();
      ctx.fillStyle = isDark ? 'rgba(59, 130, 246, 0.08)' : 'rgba(37, 99, 235, 0.07)';
      ctx.fill();
    }

    // Helper for drawing overlay series lines
    const drawOverlayLine = (series: (number | null)[], color: string, lineWidth = 1.4) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      let active = false;
      for (let i = start; i < end; i++) {
        const val = series[i];
        if (val === null) continue;
        const x = padLeft + (i - start) * stepX + stepX / 2;
        const y = priceToY(val);
        if (!active) {
          ctx.moveTo(x, y);
          active = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    };

    if (showBB) {
      drawOverlayLine(indicators.bb.upper, 'rgba(96, 165, 250, 0.7)', 1);
      drawOverlayLine(indicators.bb.lower, 'rgba(96, 165, 250, 0.7)', 1);
    }
    if (showSMA20) {
      drawOverlayLine(indicators.sma20, '#F59E0B', 1.4);
    }
    if (showEMA) {
      drawOverlayLine(indicators.ema12, '#3B82F6', 1.4);
      drawOverlayLine(indicators.ema26, '#A855F7', 1.4);
    }

    // Price rendering: Candles, Line, or Area
    if (chartType === 'candles') {
      slice.forEach((c, idx) => {
        const x = padLeft + idx * stepX + stepX / 2;
        const isBull = c.close >= c.open;
        const color = isBull ? bullColor : bearColor;
        const yHigh = priceToY(c.high);
        const yLow = priceToY(c.low);
        const yOpen = priceToY(c.open);
        const yClose = priceToY(c.close);

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
        ctx.stroke();

        const bodyTop = Math.min(yOpen, yClose);
        const bodyH = Math.max(1.5, Math.abs(yClose - yOpen));
        ctx.fillStyle = color;
        ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
      });
    } else {
      ctx.beginPath();
      slice.forEach((c, idx) => {
        const x = padLeft + idx * stepX + stepX / 2;
        const y = priceToY(c.close);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (chartType === 'area') {
        const lastX = padLeft + (slice.length - 1) * stepX + stepX / 2;
        const firstX = padLeft + stepX / 2;
        ctx.lineTo(lastX, padTop + mainHeight);
        ctx.lineTo(firstX, padTop + mainHeight);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, padTop, 0, padTop + mainHeight);
        grad.addColorStop(0, 'rgba(37, 99, 235, 0.28)');
        grad.addColorStop(1, 'rgba(37, 99, 235, 0.0)');
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }

    // Last price horizontal marker
    const lastClose = slice[slice.length - 1].close;
    const lastY = priceToY(lastClose);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, lastY);
    ctx.lineTo(padLeft + plotWidth, lastY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#2563EB';
    ctx.fillRect(padLeft + plotWidth + 2, lastY - 9, padRight - 6, 18);
    ctx.fillStyle = '#FFFFFF';
    const dec = lastClose < 10 ? 4 : lastClose < 1000 ? 2 : 0;
    ctx.fillText(`$${lastClose.toFixed(dec)}`, padLeft + plotWidth + 6, lastY);

    // Sub-pane (RSI or MACD)
    const subTop = padTop + mainHeight + subGap;
    if (subPane === 'rsi') {
      ctx.strokeStyle = gridColor;
      ctx.strokeRect(padLeft, subTop, plotWidth, subHeight);

      const y70 = subTop + ((100 - 70) / 100) * subHeight;
      const y30 = subTop + ((100 - 30) / 100) * subHeight;
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.beginPath();
      ctx.moveTo(padLeft, y70);
      ctx.lineTo(padLeft + plotWidth, y70);
      ctx.moveTo(padLeft, y30);
      ctx.lineTo(padLeft + plotWidth, y30);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = axisText;
      ctx.fillText('70', padLeft + plotWidth + 8, y70);
      ctx.fillText('30', padLeft + plotWidth + 8, y30);
      ctx.fillText('RSI(14)', padLeft + 6, subTop + 12);

      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let active = false;
      for (let i = start; i < end; i++) {
        const val = indicators.rsi[i];
        if (val === null) continue;
        const x = padLeft + (i - start) * stepX + stepX / 2;
        const y = subTop + ((100 - val) / 100) * subHeight;
        if (!active) {
          ctx.moveTo(x, y);
          active = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    } else if (subPane === 'macd') {
      ctx.strokeStyle = gridColor;
      ctx.strokeRect(padLeft, subTop, plotWidth, subHeight);

      let maxAbs = 0.0001;
      for (let i = start; i < end; i++) {
        const m = indicators.macd.macd[i];
        const s = indicators.macd.signal[i];
        const h = indicators.macd.histogram[i];
        if (m !== null) maxAbs = Math.max(maxAbs, Math.abs(m));
        if (s !== null) maxAbs = Math.max(maxAbs, Math.abs(s));
        if (h !== null) maxAbs = Math.max(maxAbs, Math.abs(h));
      }
      const midY = subTop + subHeight / 2;
      const toMacdY = (v: number) => midY - (v / maxAbs) * (subHeight * 0.42);

      for (let i = start; i < end; i++) {
        const h = indicators.macd.histogram[i];
        if (h === null) continue;
        const x = padLeft + (i - start) * stepX + stepX / 2;
        const y = toMacdY(h);
        ctx.fillStyle = h >= 0 ? 'rgba(22, 163, 74, 0.55)' : 'rgba(220, 38, 38, 0.55)';
        ctx.fillRect(x - candleW / 2, Math.min(midY, y), candleW, Math.max(1, Math.abs(y - midY)));
      }

      const drawSubLine = (arr: (number | null)[], color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        let active = false;
        for (let i = start; i < end; i++) {
          const val = arr[i];
          if (val === null) continue;
          const x = padLeft + (i - start) * stepX + stepX / 2;
          const y = toMacdY(val);
          if (!active) {
            ctx.moveTo(x, y);
            active = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      };
      drawSubLine(indicators.macd.macd, '#3B82F6');
      drawSubLine(indicators.macd.signal, '#F59E0B');

      ctx.fillStyle = axisText;
      ctx.fillText('MACD(12,26,9)', padLeft + 6, subTop + 12);
    }

    // Bottom X-axis timestamps
    const timeY = height - 10;
    ctx.fillStyle = axisText;
    ctx.textAlign = 'center';
    const labelCount = Math.min(6, slice.length);
    for (let k = 0; k < labelCount; k++) {
      const idx = Math.floor((k / Math.max(1, labelCount - 1)) * (slice.length - 1));
      const c = slice[idx];
      const rawX = padLeft + idx * stepX + stepX / 2;
      const x = Math.max(padLeft + 30, Math.min(padLeft + plotWidth - 30, rawX));
      const d = new Date(c.time);
      const label =
        timeframe === '1d'
          ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      ctx.fillText(label, x, timeY);
    }

    // Crosshair hover line
    if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < slice.length) {
      const x = padLeft + hoverIdx * stepX + stepX / 2;
      ctx.strokeStyle = isDark ? 'rgba(226, 232, 240, 0.35)' : 'rgba(15, 23, 42, 0.35)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, height - bottomAxisHeight);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [
    candles,
    slicedRange,
    theme,
    chartType,
    showSMA20,
    showEMA,
    showBB,
    subPane,
    indicators,
    hoverIdx,
    timeframe,
  ]);

  const hoveredCandle = useMemo(() => {
    if (hoverIdx === null) return candles[candles.length - 1] ?? null;
    return candles[slicedRange.start + hoverIdx] ?? candles[candles.length - 1] ?? null;
  }, [hoverIdx, candles, slicedRange]);

  const hoveredGlobalIdx =
    hoverIdx !== null ? slicedRange.start + hoverIdx : Math.max(0, candles.length - 1);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const plotWidth = Math.max(100, rect.width - 14 - 72);
    const sliceLen = Math.max(1, slicedRange.end - slicedRange.start);
    const stepX = plotWidth / sliceLen;

    if (dragStart) {
      const dx = e.clientX - dragStart.x;
      const barsMoved = Math.round(dx / Math.max(4, stepX));
      const maxOffset = Math.max(0, candles.length - visibleCount);
      setOffsetFromEnd(Math.min(maxOffset, Math.max(0, dragStart.offset + barsMoved)));
      return;
    }

    const idx = Math.floor((x - 14) / stepX);
    if (idx >= 0 && idx < sliceLen) {
      setHoverIdx(idx);
    } else {
      setHoverIdx(null);
    }
  };

  const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E131F] overflow-hidden">
      {/* Chart Toolbar */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-slate-900 dark:text-white whitespace-nowrap">
            {symbol}/USDT
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">·</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {dataSource === 'simulated' ? t.terminal.sourceSimulated : `${t.terminal.sourceLive} (${dataSource})`}
          </span>

          {/* Timeframe Segmented Buttons */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80">
            {timeframes.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => onChangeTimeframe(tf)}
                className={`px-2 py-1 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap ${
                  timeframe === tf
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Type & Indicator Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80">
            {(['candles', 'line', 'area'] as ChartType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setChartType(type)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  chartType === type
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {type === 'candles'
                  ? t.terminal.candlesticks
                  : type === 'line'
                  ? t.terminal.line
                  : t.terminal.area}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowSMA20((v) => !v)}
            className={`px-2 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
              showSMA20
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            }`}
          >
            SMA20
          </button>
          <button
            type="button"
            onClick={() => setShowEMA((v) => !v)}
            className={`px-2 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
              showEMA
                ? 'border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            }`}
          >
            EMA12/26
          </button>
          <button
            type="button"
            onClick={() => setShowBB((v) => !v)}
            className={`px-2 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
              showBB
                ? 'border-sky-500/50 bg-sky-500/10 text-sky-600 dark:text-sky-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            }`}
          >
            Bollinger
          </button>

          <select
            aria-label="Oscilador inferior"
            value={subPane}
            onChange={(e) => setSubPane(e.target.value as SubPaneType)}
            className="px-2 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="rsi">RSI (14)</option>
            <option value="macd">MACD (12,26,9)</option>
            <option value="none">Sem Sub-painel</option>
          </select>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Aumentar zoom"
              onClick={() => setVisibleCount((c) => Math.max(24, c - 16))}
              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Diminuir zoom"
              onClick={() => setVisibleCount((c) => Math.min(candles.length || 160, c + 16))}
              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Resetar zoom do gráfico"
              onClick={() => {
                setVisibleCount(72);
                setOffsetFromEnd(0);
              }}
              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Live OHLCV & Indicator Crosshair Readout */}
      {hoveredCandle && (
        <div className="px-4 py-1.5 border-b border-slate-100 dark:border-slate-800/70 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
          <span>
            O: <strong className="text-slate-900 dark:text-slate-100">{hoveredCandle.open.toFixed(2)}</strong>
          </span>
          <span>
            H: <strong className="text-emerald-600 dark:text-emerald-400">{hoveredCandle.high.toFixed(2)}</strong>
          </span>
          <span>
            L: <strong className="text-rose-600 dark:text-rose-400">{hoveredCandle.low.toFixed(2)}</strong>
          </span>
          <span>
            C: <strong className="text-slate-900 dark:text-slate-100">{hoveredCandle.close.toFixed(2)}</strong>
          </span>
          {indicators.rsi[hoveredGlobalIdx] !== null && (
            <span>
              RSI: <strong className="text-sky-600 dark:text-sky-400">{indicators.rsi[hoveredGlobalIdx]?.toFixed(1)}</strong>
            </span>
          )}
          {indicators.sma20[hoveredGlobalIdx] !== null && (
            <span>
              SMA20: <strong className="text-amber-600 dark:text-amber-400">{indicators.sma20[hoveredGlobalIdx]?.toFixed(2)}</strong>
            </span>
          )}
        </div>
      )}

      {/* High-DPI Interactive Canvas */}
      <div ref={containerRef} className="w-full relative select-none">
        <canvas
          ref={canvasRef}
          data-testid="candlestick-canvas"
          onMouseDown={(e) => setDragStart({ x: e.clientX, offset: offsetFromEnd })}
          onMouseUp={() => setDragStart(null)}
          onMouseLeave={() => {
            setDragStart(null);
            setHoverIdx(null);
          }}
          onMouseMove={handleMouseMove}
          className="block w-full cursor-crosshair"
        />
      </div>
    </section>
  );
};

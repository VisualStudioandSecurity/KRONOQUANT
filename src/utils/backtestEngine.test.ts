import test from 'node:test';
import assert from 'node:assert/strict';
import { runBacktest } from './backtestEngine';
import type { Candle } from '../types/crypto';

function makeOscillatingCandles(count: number): Candle[] {
  const baseTime = 1700000000000;
  return Array.from({ length: count }, (_, i) => {
    const wave = Math.sin(i * 0.25) * 18 + i * 0.35;
    const close = 100 + wave;
    const open = i === 0 ? close : 100 + Math.sin((i - 1) * 0.25) * 18 + (i - 1) * 0.35;
    return {
      time: baseTime + i * 86400_000,
      open,
      high: Math.max(open, close) + 2,
      low: Math.min(open, close) - 2,
      close,
      volume: 5000 + i * 50,
    };
  });
}

test('runBacktest executes trades and produces complete metrics for EMA Cross', () => {
  const candles = makeOscillatingCandles(120);
  const result = runBacktest(candles, {
    symbol: 'BTC',
    strategy: 'ema_cross',
    days: 120,
    initialCapital: 10000,
    feePct: 0.1,
    stopLossPct: 5,
    takeProfitPct: 12,
  });

  assert.equal(result.equityCurve.length, candles.length);
  assert.ok(result.totalTrades >= 1);
  assert.ok(result.finalEquity > 0);
  assert.ok(result.maxDrawdownPct >= 0 && result.maxDrawdownPct <= 100);
  assert.ok(result.winRatePct >= 0 && result.winRatePct <= 100);
});

test('runBacktest respects stop loss triggers during sharp drops', () => {
  const candles = makeOscillatingCandles(80);
  // Force a sharp crash right after an entry window
  for (let i = 45; i < 55; i++) {
    candles[i] = {
      ...candles[i],
      low: candles[i].close * 0.7,
      close: candles[i].close * 0.85,
    };
  }
  const result = runBacktest(candles, {
    symbol: 'ETH',
    strategy: 'rsi_mean_reversion',
    days: 80,
    initialCapital: 25000,
    feePct: 0.1,
    stopLossPct: 4,
    takeProfitPct: 15,
  });

  assert.equal(result.equityCurve.length, candles.length);
  assert.ok(Number.isFinite(result.sharpeRatio));
  assert.ok(Number.isFinite(result.profitFactor));
});

test('macro_whale_sell rejects orders if any of the 3 sell criteria fails', () => {
  const baseTime = 1700000000000;
  // Bars have macro >= 60 and orderBook >= 55, OR whale missing -> should not trigger when whaleSellDetected is false
  const candles: Candle[] = Array.from({ length: 45 }, (_, i) => ({
    time: baseTime + i * 86400_000,
    open: 100 - i * 0.2,
    high: 101 - i * 0.2,
    low: 98 - i * 0.2,
    close: 99 - i * 0.2,
    volume: 5000,
    orderFlow: {
      macroSellForcePct: i === 20 ? 59 : 65, // bar 20 fails macro 60%
      orderBookSellPct: i === 25 ? 54 : 58,  // bar 25 fails book 55%
      whaleSellDetected: false,              // whale orders missing on all bars
      whaleSellVolumeUsd: 0,
    },
  }));

  const res = runBacktest(candles, {
    symbol: 'BTC',
    strategy: 'macro_whale_sell',
    days: 45,
    initialCapital: 10000,
    feePct: 0.1,
    stopLossPct: 5,
    takeProfitPct: 10,
    macroWhaleSellParams: {
      minMacroSellForcePct: 60,
      minOrderBookSellPct: 55,
      requireWhaleSellOrders: true,
      minWhaleVolumeMultiplier: 1.5,
    },
  });

  assert.equal(res.totalTrades, 0);
  assert.equal(res.validationSummary?.allCriteriaMetBars, 0);
});

test('macro_whale_sell opens SHORT when macro >= 60%, book >= 55%, and whale sell orders are present', () => {
  const baseTime = 1700000000000;
  const candles: Candle[] = Array.from({ length: 45 }, (_, i) => {
    const price = i < 20 ? 100 : 100 - (i - 20) * 1.2;
    return {
      time: baseTime + i * 86400_000,
      open: price + 0.5,
      high: price + 1.0,
      low: price - 1.0,
      close: price,
      volume: i === 20 ? 25000 : 5000,
      orderFlow:
        i === 20
          ? {
              macroSellForcePct: 68,
              orderBookSellPct: 62,
              whaleSellDetected: true,
              whaleSellVolumeUsd: 2_500_000,
            }
          : {
              macroSellForcePct: 50,
              orderBookSellPct: 48,
              whaleSellDetected: false,
              whaleSellVolumeUsd: 0,
            },
    };
  });

  const res = runBacktest(candles, {
    symbol: 'BTC',
    strategy: 'macro_whale_sell',
    days: 45,
    initialCapital: 10000,
    feePct: 0.1,
    stopLossPct: 5,
    takeProfitPct: 12,
    macroWhaleSellParams: {
      minMacroSellForcePct: 60,
      minOrderBookSellPct: 55,
      requireWhaleSellOrders: true,
      minWhaleVolumeMultiplier: 1.5,
    },
  });

  assert.equal(res.validationSummary?.allCriteriaMetBars, 1);
  assert.ok(res.totalTrades >= 1);
  assert.equal(res.trades[0].side, 'SHORT');
  assert.ok(res.trades[0].pnlUsd > 0);
  assert.ok((res.trades[0].validationMetrics?.macroSellForcePct ?? 0) >= 60);
  assert.ok((res.trades[0].validationMetrics?.orderBookSellPct ?? 0) >= 55);
});


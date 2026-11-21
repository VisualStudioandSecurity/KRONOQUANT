import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSMA,
  calculateEMA,
  calculateBollingerBands,
  calculateRSI,
  calculateMACD,
  calculateATR,
  summarizeTechnicalSnapshot,
} from './indicators';
import type { Candle } from '../types/crypto';

function makeTrendCandles(count: number, start = 100, step = 1.5): Candle[] {
  const baseTime = 1700000000000;
  return Array.from({ length: count }, (_, i) => {
    const close = start + i * step + Math.sin(i * 0.6) * 2;
    const open = close - step * 0.5;
    return {
      time: baseTime + i * 3600_000,
      open,
      high: Math.max(open, close) + 1.2,
      low: Math.min(open, close) - 1.1,
      close,
      volume: 1000 + i * 25,
    };
  });
}

test('calculateSMA computes rolling simple moving average accurately', () => {
  const sma = calculateSMA([10, 20, 30, 40, 50], 3);
  assert.deepEqual(sma, [null, null, 20, 30, 40]);
});

test('calculateEMA seeds with SMA and tracks upward drift', () => {
  const ema = calculateEMA([10, 12, 14, 16, 18, 20], 3);
  assert.equal(ema[0], null);
  assert.equal(ema[1], null);
  assert.equal(ema[2], 12);
  assert.ok((ema[5] ?? 0) > (ema[2] ?? 0));
});

test('calculateBollingerBands satisfies upper > middle > lower when volatile', () => {
  const values = [100, 102, 98, 105, 97, 106, 99, 108, 95, 110];
  const bb = calculateBollingerBands(values, 5, 2);
  assert.equal(bb.upper[3], null);
  assert.ok((bb.upper[9] ?? 0) > (bb.middle[9] ?? 0));
  assert.ok((bb.middle[9] ?? 0) > (bb.lower[9] ?? 0));
});

test('calculateRSI stays bounded between 0 and 100 and reflects strong uptrend', () => {
  const rising = Array.from({ length: 30 }, (_, i) => 100 + i * 3);
  const rsi = calculateRSI(rising, 14);
  const lastRsi = rsi[rsi.length - 1];
  assert.ok(lastRsi !== null && lastRsi >= 95 && lastRsi <= 100);
});

test('calculateMACD and calculateATR return finite values for sufficient series', () => {
  const candles = makeTrendCandles(60);
  const closes = candles.map((c) => c.close);
  const macd = calculateMACD(closes, 12, 26, 9);
  const atr = calculateATR(candles, 14);

  assert.ok(macd.macd[59] !== null);
  assert.ok(macd.signal[59] !== null);
  assert.ok(macd.histogram[59] !== null);
  assert.ok((atr[59] ?? 0) > 0);
});

test('summarizeTechnicalSnapshot detects bullish trend and valid support/resistance', () => {
  const candles = makeTrendCandles(70, 50000, 120);
  const snap = summarizeTechnicalSnapshot('BTC', candles);
  assert.equal(snap.symbol, 'BTC');
  assert.equal(snap.trend, 'bullish');
  assert.ok(snap.resistance > snap.support);
  assert.ok(snap.atrPercent > 0);
});

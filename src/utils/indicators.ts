import type { Candle, TechnicalSnapshot } from '../types/crypto';

export function calculateSMA(values: number[], period: number): (number | null)[] {
  if (period <= 0) return values.map(() => null);
  const result: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) {
      sum -= values[i - period];
    }
    if (i < period - 1) {
      result.push(null);
    } else {
      result.push(sum / period);
    }
  }
  return result;
}

export function calculateEMA(values: number[], period: number): (number | null)[] {
  if (period <= 0 || values.length === 0) return values.map(() => null);
  const k = 2 / (period + 1);
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return result;

  let initialSum = 0;
  for (let i = 0; i < period; i++) {
    initialSum += values[i];
  }
  let ema = initialSum / period;
  result[period - 1] = ema;

  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

export function calculateBollingerBands(
  values: number[],
  period = 20,
  multiplier = 2
): {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
} {
  const middle = calculateSMA(values, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < values.length; i++) {
    const mid = middle[i];
    if (mid === null || i < period - 1) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    let sqDiffSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = values[j] - mid;
      sqDiffSum += diff * diff;
    }
    const stdDev = Math.sqrt(sqDiffSum / period);
    upper.push(mid + multiplier * stdDev);
    lower.push(mid - multiplier * stdDev);
  }

  return { upper, middle, lower };
}

export function calculateRSI(values: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return result;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gainSum += change;
    else lossSum += Math.abs(change);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  const firstRs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + firstRs);

  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      result[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      result[i] = 100 - 100 / (1 + rs);
    }
  }

  return result;
}

export function calculateMACD(
  values: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const fastEma = calculateEMA(values, fastPeriod);
  const slowEma = calculateEMA(values, slowPeriod);

  const macd: (number | null)[] = values.map((_, i) => {
    const f = fastEma[i];
    const s = slowEma[i];
    return f !== null && s !== null ? f - s : null;
  });

  const validMacdStart = macd.findIndex((v) => v !== null);
  const signal: (number | null)[] = new Array(values.length).fill(null);
  const histogram: (number | null)[] = new Array(values.length).fill(null);

  if (validMacdStart !== -1) {
    const validMacdSlice = macd.slice(validMacdStart) as number[];
    const signalSlice = calculateEMA(validMacdSlice, signalPeriod);
    for (let i = 0; i < signalSlice.length; i++) {
      const idx = validMacdStart + i;
      signal[idx] = signalSlice[i];
      if (macd[idx] !== null && signal[idx] !== null) {
        histogram[idx] = (macd[idx] as number) - (signal[idx] as number);
      }
    }
  }

  return { macd, signal, histogram };
}

export function calculateATR(candles: Candle[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length <= period) return result;

  const trs: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prevClose),
      Math.abs(candles[i].low - prevClose)
    );
    trs.push(tr);
  }

  let atr = trs.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  result[period] = atr;

  for (let i = period + 1; i < candles.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    result[i] = atr;
  }

  return result;
}

export function summarizeTechnicalSnapshot(symbol: string, candles: Candle[]): TechnicalSnapshot {
  const closes = candles.map((c) => c.close);
  const lastIdx = Math.max(0, candles.length - 1);
  const price = closes[lastIdx] ?? 0;

  const sma20Arr = calculateSMA(closes, 20);
  const sma50Arr = calculateSMA(closes, 50);
  const ema12Arr = calculateEMA(closes, 12);
  const ema26Arr = calculateEMA(closes, 26);
  const bb = calculateBollingerBands(closes, 20, 2);
  const rsiArr = calculateRSI(closes, 14);
  const macdObj = calculateMACD(closes, 12, 26, 9);
  const atrArr = calculateATR(candles, 14);

  const sma20 = sma20Arr[lastIdx] ?? price;
  const sma50 = sma50Arr[lastIdx] ?? sma20;
  const ema12 = ema12Arr[lastIdx] ?? price;
  const ema26 = ema26Arr[lastIdx] ?? price;
  const bbUpper = bb.upper[lastIdx] ?? price * 1.03;
  const bbMiddle = bb.middle[lastIdx] ?? price;
  const bbLower = bb.lower[lastIdx] ?? price * 0.97;
  const bbWidth = bbUpper - bbLower;
  const bbPercentB = bbWidth > 0 ? (price - bbLower) / bbWidth : 0.5;
  const rsi14 = rsiArr[lastIdx] ?? 50;
  const macd = macdObj.macd[lastIdx] ?? 0;
  const macdSignal = macdObj.signal[lastIdx] ?? 0;
  const macdHist = macdObj.histogram[lastIdx] ?? 0;
  const atr14 = atrArr[lastIdx] ?? price * 0.02;
  const atrPercent = price > 0 ? (atr14 / price) * 100 : 2;

  const recentWindow = candles.slice(-24);
  const support = recentWindow.length
    ? Math.min(...recentWindow.map((c) => c.low))
    : price * 0.96;
  const resistance = recentWindow.length
    ? Math.max(...recentWindow.map((c) => c.high))
    : price * 1.04;

  let trend: 'bullish' | 'bearish' | 'sideways' = 'sideways';
  if (ema12 > ema26 && price > sma20) trend = 'bullish';
  else if (ema12 < ema26 && price < sma20) trend = 'bearish';

  return {
    symbol,
    price,
    rsi14,
    macd,
    macdSignal,
    macdHist,
    sma20,
    sma50,
    ema12,
    ema26,
    bbUpper,
    bbMiddle,
    bbLower,
    bbPercentB,
    atr14,
    atrPercent,
    support,
    resistance,
    trend,
  };
}

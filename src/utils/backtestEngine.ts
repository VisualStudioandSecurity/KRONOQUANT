import type {
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  BacktestValidationSummary,
  Candle,
} from '../types/crypto';
import {
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSMA,
} from './indicators';

interface BarMicrostructure {
  macroSellForcePct: number;
  orderBookSellPct: number;
  whaleSellDetected: boolean;
  whaleSellVolumeUsd: number;
}

function evaluateBearishMicrostructure(
  candles: Candle[],
  i: number,
  ema12: (number | null)[],
  ema26: (number | null)[],
  sma50: (number | null)[],
  minWhaleVolumeMultiplier: number
): BarMicrostructure {
  const c = candles[i];

  // 1. Macro Sell Force (0-100%)
  let macroSellForcePct: number;
  if (c.orderFlow?.macroSellForcePct !== undefined) {
    macroSellForcePct = Math.max(0, Math.min(100, c.orderFlow.macroSellForcePct));
  } else {
    const winStart = Math.max(0, i - 13);
    const window = candles.slice(winStart, i + 1);
    let bearishCount = 0;
    let downVolume = 0;
    let totalVolume = 0;
    for (const bar of window) {
      totalVolume += bar.volume;
      if (bar.close < bar.open) {
        bearishCount += 1;
        downVolume += bar.volume;
      }
    }
    const bearishBarRatio = window.length > 0 ? bearishCount / window.length : 0.5;
    const bearishVolRatio = totalVolume > 0 ? downVolume / totalVolume : 0.5;

    const e12 = ema12[i] ?? c.close;
    const e26 = ema26[i] ?? c.close;
    const emaBearComponent = e26 > 0 ? Math.max(0, Math.min(1, 0.5 + ((e26 - e12) / e26) * 14)) : 0.5;

    const s50 = sma50[i] ?? e26;
    const smaBearComponent = s50 > 0 ? Math.max(0, Math.min(1, 0.5 + ((s50 - c.close) / s50) * 8)) : 0.5;

    const rawForce =
      (bearishBarRatio * 0.35 +
        bearishVolRatio * 0.25 +
        emaBearComponent * 0.2 +
        smaBearComponent * 0.2) *
      100;
    macroSellForcePct = Math.max(0, Math.min(100, Number(rawForce.toFixed(1))));
  }

  // 2. Order Book Sell Pressure (0-100%)
  let orderBookSellPct: number;
  if (c.orderFlow?.orderBookSellPct !== undefined) {
    orderBookSellPct = Math.max(0, Math.min(100, c.orderFlow.orderBookSellPct));
  } else {
    const range = Math.max(1e-9, c.high - c.low);
    const upperRejection = (c.high - c.close) / range; // 1.0 when closing right on the low
    const bodyBearRatio = c.close < c.open ? (c.open - c.close) / range : 0;
    const rawBookSell = 35 + upperRejection * 40 + bodyBearRatio * 22;
    orderBookSellPct = Math.max(15, Math.min(96, Number(rawBookSell.toFixed(1))));
  }

  // 3. Whale Sell Order Detection
  const volWinStart = Math.max(0, i - 20);
  const priorBars = candles.slice(volWinStart, i);
  const avgVol =
    priorBars.length > 0
      ? priorBars.reduce((sum, b) => sum + b.volume, 0) / priorBars.length
      : c.volume;

  let whaleSellDetected: boolean;
  if (c.orderFlow?.whaleSellDetected !== undefined) {
    whaleSellDetected = c.orderFlow.whaleSellDetected;
  } else {
    const isBearishCandle = c.close < c.open || orderBookSellPct >= 55;
    const isLargeVolumeBlock = avgVol > 0 && c.volume >= avgVol * minWhaleVolumeMultiplier;
    whaleSellDetected = isBearishCandle && isLargeVolumeBlock;
  }

  const whaleSellVolumeUsd =
    c.orderFlow?.whaleSellVolumeUsd !== undefined
      ? c.orderFlow.whaleSellVolumeUsd
      : whaleSellDetected
      ? c.volume * c.close * (orderBookSellPct / 100)
      : 0;

  return {
    macroSellForcePct,
    orderBookSellPct,
    whaleSellDetected,
    whaleSellVolumeUsd,
  };
}

export function runBacktest(candles: Candle[], config: BacktestConfig): BacktestResult {
  if (candles.length < 30) {
    return {
      config,
      finalEquity: config.initialCapital,
      totalReturnPct: 0,
      buyAndHoldReturnPct: 0,
      alphaPct: 0,
      maxDrawdownPct: 0,
      winRatePct: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      totalTrades: 0,
      equityCurve: candles.map((c) => ({
        time: c.time,
        strategyEquity: config.initialCapital,
        holdEquity: config.initialCapital,
      })),
      trades: [],
    };
  }

  const closes = candles.map((c) => c.close);
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const sma50 = calculateSMA(closes, 50);
  const rsi14 = calculateRSI(closes, 14);
  const bb = calculateBollingerBands(closes, 20, 2);
  const macd = calculateMACD(closes, 12, 26, 9);

  const feeRate = Math.max(0, config.feePct) / 100;
  const stopLossFrac = Math.max(0, config.stopLossPct) / 100;
  const takeProfitFrac = Math.max(0, config.takeProfitPct) / 100;

  const whaleParams = {
    minMacroSellForcePct: config.macroWhaleSellParams?.minMacroSellForcePct ?? 60,
    minOrderBookSellPct: config.macroWhaleSellParams?.minOrderBookSellPct ?? 55,
    requireWhaleSellOrders: config.macroWhaleSellParams?.requireWhaleSellOrders ?? true,
    minWhaleVolumeMultiplier: config.macroWhaleSellParams?.minWhaleVolumeMultiplier ?? 1.45,
  };

  let cash = config.initialCapital;
  let positionSide: 'LONG' | 'SHORT' | null = null;
  let positionQty = 0;
  let collateralUsd = 0;
  let entryPrice = 0;
  let entryTime = 0;
  let entryFee = 0;
  let pendingValidationMetrics: BacktestTrade['validationMetrics'] | undefined;

  const firstPrice = candles[0].close;
  const holdQty = firstPrice > 0 ? config.initialCapital / firstPrice : 0;

  const equityCurve: { time: number; strategyEquity: number; holdEquity: number }[] = [];
  const trades: BacktestTrade[] = [];
  let tradeCounter = 1;

  const validationSummary: BacktestValidationSummary = {
    evaluatedBars: 0,
    macroSellPassedBars: 0,
    orderBookSellPassedBars: 0,
    whaleSellBars: 0,
    allCriteriaMetBars: 0,
  };

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];

    // Check intra-candle stop loss or take profit if currently in a position
    if (positionSide === 'LONG' && positionQty > 0) {
      const stopPrice = stopLossFrac > 0 ? entryPrice * (1 - stopLossFrac) : 0;
      const takePrice = takeProfitFrac > 0 ? entryPrice * (1 + takeProfitFrac) : Infinity;

      let forcedExitPrice: number | null = null;
      let forcedReason: 'stop_loss' | 'take_profit' | null = null;

      if (stopLossFrac > 0 && c.low <= stopPrice) {
        forcedExitPrice = stopPrice;
        forcedReason = 'stop_loss';
      } else if (takeProfitFrac > 0 && c.high >= takePrice) {
        forcedExitPrice = takePrice;
        forcedReason = 'take_profit';
      }

      if (forcedExitPrice !== null && forcedReason !== null) {
        const grossProceeds = positionQty * forcedExitPrice;
        const exitFee = grossProceeds * feeRate;
        const netProceeds = grossProceeds - exitFee;
        const costBasis = positionQty * entryPrice + entryFee;
        const pnlUsd = netProceeds - costBasis;
        const pnlPct = costBasis > 0 ? (pnlUsd / costBasis) * 100 : 0;

        trades.push({
          id: tradeCounter++,
          side: 'LONG',
          entryTime,
          exitTime: c.time,
          entryPrice,
          exitPrice: forcedExitPrice,
          quantity: positionQty,
          pnlUsd,
          pnlPct,
          exitReason: forcedReason,
        });

        cash += netProceeds;
        positionSide = null;
        positionQty = 0;
        entryPrice = 0;
        entryFee = 0;
      }
    } else if (positionSide === 'SHORT' && positionQty > 0) {
      const stopPrice = stopLossFrac > 0 ? entryPrice * (1 + stopLossFrac) : Infinity;
      const takePrice = takeProfitFrac > 0 ? entryPrice * (1 - takeProfitFrac) : 0;

      let forcedExitPrice: number | null = null;
      let forcedReason: 'stop_loss' | 'take_profit' | null = null;

      if (stopLossFrac > 0 && c.high >= stopPrice) {
        forcedExitPrice = stopPrice;
        forcedReason = 'stop_loss';
      } else if (takeProfitFrac > 0 && c.low <= takePrice) {
        forcedExitPrice = takePrice;
        forcedReason = 'take_profit';
      }

      if (forcedExitPrice !== null && forcedReason !== null) {
        const exitFee = positionQty * forcedExitPrice * feeRate;
        const grossReturn = collateralUsd - entryFee + positionQty * (entryPrice - forcedExitPrice);
        const netReturn = Math.max(0, grossReturn - exitFee);
        const pnlUsd = netReturn - collateralUsd;
        const pnlPct = collateralUsd > 0 ? (pnlUsd / collateralUsd) * 100 : 0;

        trades.push({
          id: tradeCounter++,
          side: 'SHORT',
          entryTime,
          exitTime: c.time,
          entryPrice,
          exitPrice: forcedExitPrice,
          quantity: positionQty,
          pnlUsd,
          pnlPct,
          exitReason: forcedReason,
          validationMetrics: pendingValidationMetrics,
        });

        cash += netReturn;
        positionSide = null;
        positionQty = 0;
        collateralUsd = 0;
        entryPrice = 0;
        entryFee = 0;
        pendingValidationMetrics = undefined;
      }
    }

    // Strategy Signal Evaluation
    if (i > 0) {
      let buySignal = false;
      let sellSignal = false;
      let shortEntrySignal = false;
      let shortCoverSignal = false;

      if (config.strategy === 'ema_cross') {
        const fPrev = ema12[i - 1];
        const sPrev = ema26[i - 1];
        const fCurr = ema12[i];
        const sCurr = ema26[i];
        if (fPrev !== null && sPrev !== null && fCurr !== null && sCurr !== null) {
          if (fPrev <= sPrev && fCurr > sCurr) buySignal = true;
          if (fPrev >= sPrev && fCurr < sCurr) sellSignal = true;
        }
      } else if (config.strategy === 'rsi_mean_reversion') {
        const rCurr = rsi14[i];
        if (rCurr !== null) {
          if (rCurr < 32) buySignal = true;
          if (rCurr > 68) sellSignal = true;
        }
      } else if (config.strategy === 'bollinger_breakout') {
        const upper = bb.upper[i];
        const mid = bb.middle[i];
        if (upper !== null && mid !== null) {
          if (c.close > upper) buySignal = true;
          if (c.close < mid) sellSignal = true;
        }
      } else if (config.strategy === 'macd_momentum') {
        const mPrev = macd.macd[i - 1];
        const sgPrev = macd.signal[i - 1];
        const mCurr = macd.macd[i];
        const sgCurr = macd.signal[i];
        if (mPrev !== null && sgPrev !== null && mCurr !== null && sgCurr !== null) {
          if (mPrev <= sgPrev && mCurr > sgCurr) buySignal = true;
          if (mPrev >= sgPrev && mCurr < sgCurr) sellSignal = true;
        }
      } else if (config.strategy === 'macro_whale_sell') {
        const micro = evaluateBearishMicrostructure(
          candles,
          i,
          ema12,
          ema26,
          sma50,
          whaleParams.minWhaleVolumeMultiplier
        );

        validationSummary.evaluatedBars += 1;
        const passMacro = micro.macroSellForcePct >= whaleParams.minMacroSellForcePct;
        const passBook = micro.orderBookSellPct >= whaleParams.minOrderBookSellPct;
        const passWhale = !whaleParams.requireWhaleSellOrders || micro.whaleSellDetected;

        if (passMacro) validationSummary.macroSellPassedBars += 1;
        if (passBook) validationSummary.orderBookSellPassedBars += 1;
        if (micro.whaleSellDetected) validationSummary.whaleSellBars += 1;

        if (passMacro && passBook && passWhale) {
          validationSummary.allCriteriaMetBars += 1;
          shortEntrySignal = true;
          if (positionSide === null) {
            pendingValidationMetrics = {
              macroSellForcePct: micro.macroSellForcePct,
              orderBookSellPct: micro.orderBookSellPct,
              whaleSellVolumeUsd: micro.whaleSellVolumeUsd,
            };
          }
        } else if (positionSide === 'SHORT') {
          const e12 = ema12[i];
          const e26 = ema26[i];
          const rCurr = rsi14[i];
          if (
            (micro.macroSellForcePct < 45 && e12 !== null && e26 !== null && e12 > e26) ||
            (rCurr !== null && rCurr < 25)
          ) {
            shortCoverSignal = true;
          }
        }
      }

      if (config.strategy === 'macro_whale_sell') {
        if (shortEntrySignal && positionSide === null && cash > 0) {
          const fee = cash * feeRate;
          collateralUsd = cash;
          positionQty = (cash - fee) / c.close;
          entryPrice = c.close;
          entryTime = c.time;
          entryFee = fee;
          positionSide = 'SHORT';
          cash = 0;
        } else if (shortCoverSignal && positionSide === 'SHORT' && positionQty > 0) {
          const exitFee = positionQty * c.close * feeRate;
          const grossReturn = collateralUsd - entryFee + positionQty * (entryPrice - c.close);
          const netReturn = Math.max(0, grossReturn - exitFee);
          const pnlUsd = netReturn - collateralUsd;
          const pnlPct = collateralUsd > 0 ? (pnlUsd / collateralUsd) * 100 : 0;

          trades.push({
            id: tradeCounter++,
            side: 'SHORT',
            entryTime,
            exitTime: c.time,
            entryPrice,
            exitPrice: c.close,
            quantity: positionQty,
            pnlUsd,
            pnlPct,
            exitReason: 'signal',
            validationMetrics: pendingValidationMetrics,
          });

          cash += netReturn;
          positionSide = null;
          positionQty = 0;
          collateralUsd = 0;
          entryPrice = 0;
          entryFee = 0;
          pendingValidationMetrics = undefined;
        }
      } else {
        if (buySignal && positionSide === null && cash > 0) {
          const fee = cash * feeRate;
          const investable = cash - fee;
          positionQty = investable / c.close;
          entryPrice = c.close;
          entryTime = c.time;
          entryFee = fee;
          positionSide = 'LONG';
          cash = 0;
        } else if (sellSignal && positionSide === 'LONG' && positionQty > 0) {
          const grossProceeds = positionQty * c.close;
          const exitFee = grossProceeds * feeRate;
          const netProceeds = grossProceeds - exitFee;
          const costBasis = positionQty * entryPrice + entryFee;
          const pnlUsd = netProceeds - costBasis;
          const pnlPct = costBasis > 0 ? (pnlUsd / costBasis) * 100 : 0;

          trades.push({
            id: tradeCounter++,
            side: 'LONG',
            entryTime,
            exitTime: c.time,
            entryPrice,
            exitPrice: c.close,
            quantity: positionQty,
            pnlUsd,
            pnlPct,
            exitReason: 'signal',
          });

          cash += netProceeds;
          positionSide = null;
          positionQty = 0;
          entryPrice = 0;
          entryFee = 0;
        }
      }
    }

    let currentEquity = cash;
    if (positionSide === 'LONG') {
      currentEquity = cash + positionQty * c.close;
    } else if (positionSide === 'SHORT') {
      currentEquity = Math.max(
        0,
        cash + collateralUsd - entryFee + positionQty * (entryPrice - c.close)
      );
    }

    const holdEquity = holdQty * c.close;
    equityCurve.push({
      time: c.time,
      strategyEquity: currentEquity,
      holdEquity,
    });
  }

  // Close open position at end of period for clean accounting
  const lastCandle = candles[candles.length - 1];
  if (positionSide === 'LONG' && positionQty > 0) {
    const grossProceeds = positionQty * lastCandle.close;
    const exitFee = grossProceeds * feeRate;
    const netProceeds = grossProceeds - exitFee;
    const costBasis = positionQty * entryPrice + entryFee;
    const pnlUsd = netProceeds - costBasis;
    const pnlPct = costBasis > 0 ? (pnlUsd / costBasis) * 100 : 0;

    trades.push({
      id: tradeCounter++,
      side: 'LONG',
      entryTime,
      exitTime: lastCandle.time,
      entryPrice,
      exitPrice: lastCandle.close,
      quantity: positionQty,
      pnlUsd,
      pnlPct,
      exitReason: 'end_of_period',
    });

    cash += netProceeds;
    positionQty = 0;
    equityCurve[equityCurve.length - 1].strategyEquity = cash;
  } else if (positionSide === 'SHORT' && positionQty > 0) {
    const exitFee = positionQty * lastCandle.close * feeRate;
    const grossReturn = collateralUsd - entryFee + positionQty * (entryPrice - lastCandle.close);
    const netReturn = Math.max(0, grossReturn - exitFee);
    const pnlUsd = netReturn - collateralUsd;
    const pnlPct = collateralUsd > 0 ? (pnlUsd / collateralUsd) * 100 : 0;

    trades.push({
      id: tradeCounter++,
      side: 'SHORT',
      entryTime,
      exitTime: lastCandle.time,
      entryPrice,
      exitPrice: lastCandle.close,
      quantity: positionQty,
      pnlUsd,
      pnlPct,
      exitReason: 'end_of_period',
      validationMetrics: pendingValidationMetrics,
    });

    cash += netReturn;
    positionQty = 0;
    equityCurve[equityCurve.length - 1].strategyEquity = cash;
  }

  const finalEquity = equityCurve[equityCurve.length - 1].strategyEquity;
  const finalHoldEquity = equityCurve[equityCurve.length - 1].holdEquity;

  const totalReturnPct = ((finalEquity - config.initialCapital) / config.initialCapital) * 100;
  const buyAndHoldReturnPct =
    ((finalHoldEquity - config.initialCapital) / config.initialCapital) * 100;
  const alphaPct = totalReturnPct - buyAndHoldReturnPct;

  // Max Drawdown
  let peak = config.initialCapital;
  let maxDrawdownPct = 0;
  for (const pt of equityCurve) {
    if (pt.strategyEquity > peak) peak = pt.strategyEquity;
    const dd = peak > 0 ? ((peak - pt.strategyEquity) / peak) * 100 : 0;
    if (dd > maxDrawdownPct) maxDrawdownPct = dd;
  }

  // Win Rate & Profit Factor
  const wins = trades.filter((t) => t.pnlUsd > 0);
  const losses = trades.filter((t) => t.pnlUsd <= 0);
  const winRatePct = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
  const grossProfit = wins.reduce((s, t) => s + t.pnlUsd, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlUsd, 0));
  const profitFactor =
    grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 9.99 : 0;

  // Annualized Sharpe Ratio from periodic equity returns
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].strategyEquity;
    const curr = equityCurve[i].strategyEquity;
    if (prev > 0) returns.push((curr - prev) / prev);
  }
  let sharpeRatio = 0;
  if (returns.length > 1) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((s, r) => s + (r - mean) * (r - mean), 0) / (returns.length - 1);
    const std = Math.sqrt(variance);
    if (std > 1e-9) {
      sharpeRatio = (mean / std) * Math.sqrt(365);
    }
  }

  return {
    config,
    finalEquity,
    totalReturnPct,
    buyAndHoldReturnPct,
    alphaPct,
    maxDrawdownPct,
    winRatePct,
    profitFactor,
    sharpeRatio,
    totalTrades: trades.length,
    equityCurve,
    trades,
    validationSummary: config.strategy === 'macro_whale_sell' ? validationSummary : undefined,
  };
}

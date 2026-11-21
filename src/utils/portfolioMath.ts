import type { ExecutionMode, MarketTicker, PaperAccountState, Position, TradeRecord } from '../types/crypto';

export interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'AUTO_TRIGGER';
  mode: ExecutionMode;
  exchange: string;
  quantity: number;
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  note?: string;
}

const FEE_RATE = 0.001; // 0.10% taker/maker standard

export function executeSimulatedOrder(
  state: PaperAccountState,
  req: OrderRequest
): { nextState: PaperAccountState; order?: TradeRecord; error?: string } {
  if (!Number.isFinite(req.quantity) || req.quantity <= 0) {
    return { nextState: state, error: 'Quantidade deve ser maior que zero.' };
  }
  if (!Number.isFinite(req.price) || req.price <= 0) {
    return { nextState: state, error: 'Preço de execução inválido.' };
  }

  const grossUsd = req.quantity * req.price;
  const feeUsd = grossUsd * FEE_RATE;
  const nowIso = new Date().toISOString();
  const existingIdx = state.positions.findIndex((p) => p.symbol === req.symbol);

  let nextCash = state.cashUsd;
  const nextPositions: Position[] = state.positions.map((p) => ({ ...p }));
  let realizedPnlUsd = 0;

  if (req.side === 'BUY') {
    const totalDebit = grossUsd + feeUsd;
    if (req.mode === 'paper' && totalDebit > state.cashUsd + 1e-6) {
      return {
        nextState: state,
        error: `Saldo insuficiente na banca simulada ($${state.cashUsd.toFixed(2)} disponível).`,
      };
    }
    if (req.mode === 'paper') {
      nextCash = Math.max(0, state.cashUsd - totalDebit);
    }

    if (existingIdx >= 0) {
      const prev = nextPositions[existingIdx];
      const newQty = prev.quantity + req.quantity;
      const newTotalCost = prev.totalCost + grossUsd + feeUsd;
      nextPositions[existingIdx] = {
        ...prev,
        quantity: newQty,
        totalCost: newTotalCost,
        avgEntryPrice: newTotalCost / newQty,
        stopLoss: req.stopLoss ?? prev.stopLoss,
        takeProfit: req.takeProfit ?? prev.takeProfit,
        updatedAt: nowIso,
      };
    } else {
      nextPositions.push({
        symbol: req.symbol,
        quantity: req.quantity,
        avgEntryPrice: (grossUsd + feeUsd) / req.quantity,
        totalCost: grossUsd + feeUsd,
        stopLoss: req.stopLoss,
        takeProfit: req.takeProfit,
        updatedAt: nowIso,
      });
    }
  } else {
    // SELL
    if (existingIdx < 0) {
      return {
        nextState: state,
        error: `Sem posição aberta em ${req.symbol} para vender.`,
      };
    }
    const prev = nextPositions[existingIdx];
    if (req.quantity > prev.quantity + 1e-8) {
      return {
        nextState: state,
        error: `Quantidade solicitada (${req.quantity.toFixed(6)}) excede a posição (${prev.quantity.toFixed(6)} ${req.symbol}).`,
      };
    }

    const soldFraction = Math.min(1, req.quantity / prev.quantity);
    const allocatedCost = prev.totalCost * soldFraction;
    const netProceeds = grossUsd - feeUsd;
    realizedPnlUsd = netProceeds - allocatedCost;

    if (req.mode === 'paper') {
      nextCash = state.cashUsd + netProceeds;
    }

    const remainingQty = prev.quantity - req.quantity;
    if (remainingQty <= 1e-8) {
      nextPositions.splice(existingIdx, 1);
    } else {
      nextPositions[existingIdx] = {
        ...prev,
        quantity: remainingQty,
        totalCost: prev.totalCost - allocatedCost,
        updatedAt: nowIso,
      };
    }
  }

  const order: TradeRecord = {
    id: `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
    symbol: req.symbol,
    pair: `${req.symbol}USDT`,
    side: req.side,
    orderType: req.orderType,
    mode: req.mode,
    exchange: req.mode === 'paper' ? 'KronoQuant Paper' : req.exchange,
    quantity: req.quantity,
    price: req.price,
    totalUsd: grossUsd,
    feeUsd,
    realizedPnlUsd,
    status: 'FILLED',
    note: req.note,
    timestamp: nowIso,
  };

  const nextState: PaperAccountState = {
    ...state,
    cashUsd: nextCash,
    positions: nextPositions,
    trades: [order, ...state.trades].slice(0, 250),
  };

  return { nextState, order };
}

export function computePortfolioSummary(
  state: PaperAccountState,
  tickers: MarketTicker[]
): {
  totalEquity: number;
  positionsValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalReturnPct: number;
  winRatePct: number;
} {
  const priceMap = new Map(tickers.map((t) => [t.symbol, t.price]));
  let positionsValue = 0;
  let totalCostBasis = 0;

  for (const pos of state.positions) {
    const currentPrice = priceMap.get(pos.symbol) ?? pos.avgEntryPrice;
    positionsValue += pos.quantity * currentPrice;
    totalCostBasis += pos.totalCost;
  }

  const unrealizedPnl = positionsValue - totalCostBasis;
  const totalEquity = state.cashUsd + positionsValue;
  const realizedPnl = state.trades.reduce((acc, t) => acc + (t.realizedPnlUsd || 0), 0);
  const totalReturnPct =
    state.initialCapitalUsd > 0
      ? ((totalEquity - state.initialCapitalUsd) / state.initialCapitalUsd) * 100
      : 0;

  const closedTrades = state.trades.filter((t) => t.side === 'SELL');
  const winningClosed = closedTrades.filter((t) => t.realizedPnlUsd > 0);
  const winRatePct =
    closedTrades.length > 0 ? (winningClosed.length / closedTrades.length) * 100 : 0;

  return {
    totalEquity,
    positionsValue,
    unrealizedPnl,
    realizedPnl,
    totalReturnPct,
    winRatePct,
  };
}

export function formatCsvContent(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const escapeCell = (val: string | number | boolean | null | undefined) => {
    const str = val === null || val === undefined ? '' : String(val);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ];
  return '\uFEFF' + lines.join('\r\n');
}

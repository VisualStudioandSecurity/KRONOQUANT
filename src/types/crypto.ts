export type Language = 'pt' | 'en' | 'es';
export type ThemeMode = 'dark' | 'light';
export type RiskProfile = 'conservative' | 'moderate' | 'aggressive' | 'institutional';
export type ExecutionMode = 'paper' | 'exchange';
export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export type NavSection =
  | 'terminal'
  | 'portfolio'
  | 'backtest'
  | 'exchanges'
  | 'alerts'
  | 'community'
  | 'academy'
  | 'security'
  | 'support';

export interface Candle {
  time: number; // unix timestamp ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  orderFlow?: {
    macroSellForcePct?: number;
    orderBookSellPct?: number;
    whaleSellDetected?: boolean;
    whaleSellVolumeUsd?: number;
  };
}

export interface MarketTicker {
  symbol: string; // e.g. 'BTC'
  pair: string; // e.g. 'BTCUSDT'
  name: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number; // in quote USD
  volatility24h: number; // annualized or 24h range %
  source: 'binance' | 'coingecko' | 'simulated';
  updatedAt: number;
}

export interface OrderBookLevel {
  price: number;
  size: number;
  total: number;
}

export interface OrderBookData {
  pair: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadPct: number;
}

export interface TechnicalSnapshot {
  symbol: string;
  price: number;
  rsi14: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  sma20: number;
  sma50: number;
  ema12: number;
  ema26: number;
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  bbPercentB: number;
  atr14: number;
  atrPercent: number;
  support: number;
  resistance: number;
  trend: 'bullish' | 'bearish' | 'sideways';
}

export interface AIPredictionResult {
  symbol: string;
  timeframe: Timeframe;
  riskProfile: RiskProfile;
  bias: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-100
  target24hLow: number;
  target24hHigh: number;
  target7d: number;
  invalidationLevel: number;
  volatilityRegime: 'low' | 'normal' | 'elevated' | 'extreme';
  summary: string;
  drivers: string[];
  personalizedRecommendation: {
    action: 'accumulate' | 'hold' | 'hedge' | 'take_profit' | 'avoid';
    positionSizePct: number;
    stopLossPct: number;
    takeProfitPct: number;
    rationale: string;
  };
  generatedAt: string;
}

export interface Position {
  symbol: string;
  quantity: number;
  avgEntryPrice: number;
  totalCost: number;
  stopLoss?: number;
  takeProfit?: number;
  updatedAt: string;
}

export interface TradeRecord {
  id: string;
  symbol: string;
  pair: string;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'AUTO_TRIGGER';
  mode: ExecutionMode;
  exchange: string;
  quantity: number;
  price: number;
  totalUsd: number;
  feeUsd: number;
  realizedPnlUsd: number;
  status: 'FILLED' | 'OPEN' | 'CANCELLED';
  note?: string;
  timestamp: string;
}

export interface PaperAccountState {
  initialCapitalUsd: number;
  cashUsd: number;
  positions: Position[];
  trades: TradeRecord[];
  equityHistory: { time: string; equity: number }[];
}

export type BacktestStrategy =
  | 'ema_cross'
  | 'rsi_mean_reversion'
  | 'bollinger_breakout'
  | 'macd_momentum'
  | 'macro_whale_sell';

export interface MacroWhaleSellParams {
  minMacroSellForcePct: number;
  minOrderBookSellPct: number;
  requireWhaleSellOrders: boolean;
  minWhaleVolumeMultiplier: number;
}

export interface BacktestConfig {
  symbol: string;
  strategy: BacktestStrategy;
  days: number;
  initialCapital: number;
  feePct: number;
  stopLossPct: number;
  takeProfitPct: number;
  macroWhaleSellParams?: MacroWhaleSellParams;
}

export interface BacktestTrade {
  id: number;
  side?: 'LONG' | 'SHORT';
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnlUsd: number;
  pnlPct: number;
  exitReason: 'signal' | 'stop_loss' | 'take_profit' | 'end_of_period';
  validationMetrics?: {
    macroSellForcePct: number;
    orderBookSellPct: number;
    whaleSellVolumeUsd: number;
  };
}

export interface BacktestValidationSummary {
  evaluatedBars: number;
  macroSellPassedBars: number;
  orderBookSellPassedBars: number;
  whaleSellBars: number;
  allCriteriaMetBars: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  finalEquity: number;
  totalReturnPct: number;
  buyAndHoldReturnPct: number;
  alphaPct: number;
  maxDrawdownPct: number;
  winRatePct: number;
  profitFactor: number;
  sharpeRatio: number;
  totalTrades: number;
  equityCurve: { time: number; strategyEquity: number; holdEquity: number }[];
  trades: BacktestTrade[];
  validationSummary?: BacktestValidationSummary;
}

export interface ExchangeConnection {
  id: string;
  exchange: 'Binance' | 'Coinbase Advanced' | 'Kraken' | 'Bybit' | 'OKX';
  label: string;
  maskedApiKey: string;
  permissions: ('READ' | 'SPOT_TRADE' | 'FUTURES')[];
  status: 'CONNECTED' | 'PAUSED';
  encryptionAlgo: 'AES-256-GCM';
  latencyMs: number;
  lastSyncedAt: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  symbol: string;
  conditionType: 'PRICE_ABOVE' | 'PRICE_BELOW' | 'RSI_BELOW' | 'RSI_ABOVE' | 'VOLATILITY_SPIKE';
  threshold: number;
  actionSide: 'BUY' | 'SELL';
  amountUsd: number;
  targetExchange: string;
  enabled: boolean;
  triggeredCount: number;
  lastTriggeredAt?: string;
  createdAt: string;
}

export interface VolatilityAlert {
  id: string;
  symbol: string;
  condition: 'CHANGE_24H_ABS' | 'PRICE_ABOVE' | 'PRICE_BELOW' | 'ATR_SPIKE';
  threshold: number;
  pushEnabled: boolean;
  enabled: boolean;
  triggered: boolean;
  lastMessage?: string;
  triggeredAt?: string;
  createdAt: string;
}

export interface EmailReportSchedule {
  id: string;
  recipientEmail: string;
  cadence: 'daily' | 'weekly' | 'monthly';
  format: 'PDF' | 'EXCEL' | 'CSV';
  scope: 'portfolio_pnl' | 'backtest_digest' | 'alerts_audit';
  enabled: boolean;
  lastSentAt?: string;
}

export interface CommunityPost {
  id: string;
  authorName: string;
  authorHandle: string;
  authorRole: string;
  avatarUrl: string;
  winRate: number;
  riskTier: RiskProfile;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  timeframe: Timeframe;
  entryPrice: number;
  targetPrice: number;
  stopLossPrice: number;
  thesis: string;
  likes: number;
  likedByMe?: boolean;
  copies: number;
  createdAt: string;
}

export interface SecurityStatus {
  twoFactorEnabled: boolean;
  encryptionStandard: string;
  require2FAForLiveOrders: boolean;
  auditLogs: {
    id: string;
    event: string;
    detail: string;
    ip: string;
    timestamp: string;
    severity: 'info' | 'warning' | 'verified';
  }[];
}

export interface SupportMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
}

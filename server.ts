import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { executeSimulatedOrder } from './src/utils/portfolioMath';
import { summarizeTechnicalSnapshot, calculateRSI, calculateATR } from './src/utils/indicators';
import type {
  AutomationRule,
  Candle,
  CommunityPost,
  EmailReportSchedule,
  ExchangeConnection,
  Language,
  MarketTicker,
  OrderBookData,
  PaperAccountState,
  RiskProfile,
  Timeframe,
  VolatilityAlert,
} from './src/types/crypto';

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'kronoquant-store.json');
const VAULT_KEY_PATH = path.resolve(DATA_DIR, '.vault.key');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getVaultKey(): Buffer {
  if (process.env.VAULT_MASTER_KEY && process.env.VAULT_MASTER_KEY.length >= 32) {
    return crypto.createHash('sha256').update(process.env.VAULT_MASTER_KEY).digest();
  }
  if (fs.existsSync(VAULT_KEY_PATH)) {
    const hex = fs.readFileSync(VAULT_KEY_PATH, 'utf8').trim();
    if (/^[0-9a-f]{64}$/i.test(hex)) {
      return Buffer.from(hex, 'hex');
    }
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(VAULT_KEY_PATH, key.toString('hex'), { mode: 0o600 });
  return key;
}

const VAULT_KEY = getVaultKey();

function encryptSecret(plaintext: string): { iv: string; tag: string; ciphertext: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', VAULT_KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: enc.toString('hex'),
  };
}

function maskKey(key: string): string {
  const clean = key.trim();
  if (clean.length <= 4) return '****';
  return `••••${clean.slice(-4)}`;
}

// Supported assets metadata
const SUPPORTED_ASSETS: {
  symbol: string;
  pair: string;
  coingeckoId: string;
  name: string;
  basePrice: number;
}[] = [
  { symbol: 'BTC', pair: 'BTCUSDT', coingeckoId: 'bitcoin', name: 'Bitcoin', basePrice: 91450 },
  { symbol: 'ETH', pair: 'ETHUSDT', coingeckoId: 'ethereum', name: 'Ethereum', basePrice: 3280 },
  { symbol: 'SOL', pair: 'SOLUSDT', coingeckoId: 'solana', name: 'Solana', basePrice: 214.5 },
  { symbol: 'BNB', pair: 'BNBUSDT', coingeckoId: 'binancecoin', name: 'BNB', basePrice: 638.2 },
  { symbol: 'AVAX', pair: 'AVAXUSDT', coingeckoId: 'avalanche-2', name: 'Avalanche', basePrice: 36.8 },
  { symbol: 'ADA', pair: 'ADAUSDT', coingeckoId: 'cardano', name: 'Cardano', basePrice: 0.84 },
  { symbol: 'LINK', pair: 'LINKUSDT', coingeckoId: 'chainlink', name: 'Chainlink', basePrice: 17.45 },
  { symbol: 'XRP', pair: 'XRPUSDT', coingeckoId: 'ripple', name: 'XRP', basePrice: 1.42 },
];

const ASSET_MAP = new Map(SUPPORTED_ASSETS.map((a) => [a.symbol, a]));

interface EncryptedExchangeRecord extends ExchangeConnection {
  encryptedApiKey: { iv: string; tag: string; ciphertext: string };
  encryptedApiSecret: { iv: string; tag: string; ciphertext: string };
}

interface StoredState {
  paperAccount: PaperAccountState;
  exchanges: EncryptedExchangeRecord[];
  automationRules: AutomationRule[];
  volatilityAlerts: VolatilityAlert[];
  emailSchedules: EmailReportSchedule[];
  communityPosts: CommunityPost[];
  twoFactor: {
    enabled: boolean;
    secretBase32: string | null;
    pendingSecretBase32: string | null;
    require2FAForLiveOrders: boolean;
  };
  auditLogs: {
    id: string;
    event: string;
    detail: string;
    ip: string;
    timestamp: string;
    severity: 'info' | 'warning' | 'verified';
  }[];
  supportTickets: {
    id: string;
    subject: string;
    category: string;
    priority: string;
    message: string;
    status: string;
    createdAt: string;
  }[];
}

function buildInitialState(): StoredState {
  const now = Date.now();
  const initialEquityHistory = Array.from({ length: 14 }, (_, i) => {
    const dayMs = now - (13 - i) * 86400_000;
    const growth = 1 + i * 0.0065 + Math.sin(i * 0.9) * 0.011;
    return {
      time: new Date(dayMs).toISOString().slice(0, 10),
      equity: Math.round(100000 * growth * 100) / 100,
    };
  });

  const initialPaper: PaperAccountState = {
    initialCapitalUsd: 100000,
    cashUsd: 58420.5,
    positions: [
      {
        symbol: 'BTC',
        quantity: 0.28,
        avgEntryPrice: 88900,
        totalCost: 24892,
        stopLoss: 84500,
        takeProfit: 98000,
        updatedAt: new Date(now - 3600_000 * 18).toISOString(),
      },
      {
        symbol: 'ETH',
        quantity: 3.5,
        avgEntryPrice: 3140,
        totalCost: 10990,
        stopLoss: 2950,
        takeProfit: 3650,
        updatedAt: new Date(now - 3600_000 * 10).toISOString(),
      },
      {
        symbol: 'SOL',
        quantity: 28,
        avgEntryPrice: 202.5,
        totalCost: 5670,
        stopLoss: 188,
        takeProfit: 245,
        updatedAt: new Date(now - 3600_000 * 4).toISOString(),
      },
    ],
    trades: [
      {
        id: 'ORD-SEED-103',
        symbol: 'SOL',
        pair: 'SOLUSDT',
        side: 'BUY',
        orderType: 'MARKET',
        mode: 'paper',
        exchange: 'KronoQuant Paper',
        quantity: 28,
        price: 202.5,
        totalUsd: 5670,
        feeUsd: 5.67,
        realizedPnlUsd: 0,
        status: 'FILLED',
        note: 'Rompimento EMA 12/26',
        timestamp: new Date(now - 3600_000 * 4).toISOString(),
      },
      {
        id: 'ORD-SEED-102',
        symbol: 'ETH',
        pair: 'ETHUSDT',
        side: 'BUY',
        orderType: 'LIMIT',
        mode: 'paper',
        exchange: 'KronoQuant Paper',
        quantity: 3.5,
        price: 3140,
        totalUsd: 10990,
        feeUsd: 10.99,
        realizedPnlUsd: 0,
        status: 'FILLED',
        note: 'Acumulação em suporte Bollinger',
        timestamp: new Date(now - 3600_000 * 10).toISOString(),
      },
      {
        id: 'ORD-SEED-101',
        symbol: 'BTC',
        pair: 'BTCUSDT',
        side: 'BUY',
        orderType: 'MARKET',
        mode: 'paper',
        exchange: 'KronoQuant Paper',
        quantity: 0.28,
        price: 88900,
        totalUsd: 24892,
        feeUsd: 24.89,
        realizedPnlUsd: 0,
        status: 'FILLED',
        note: 'Entrada institucional tendencial',
        timestamp: new Date(now - 3600_000 * 18).toISOString(),
      },
    ],
    equityHistory: initialEquityHistory,
  };

  return {
    paperAccount: initialPaper,
    exchanges: [
      {
        id: 'ex-binance-demo',
        exchange: 'Binance',
        label: 'Binance Spot Institucional',
        maskedApiKey: '••••8F9A',
        permissions: ['READ', 'SPOT_TRADE'],
        status: 'CONNECTED',
        encryptionAlgo: 'AES-256-GCM',
        latencyMs: 38,
        lastSyncedAt: new Date(now - 120_000).toISOString(),
        encryptedApiKey: encryptSecret('demo-binance-public-ref-8F9A'),
        encryptedApiSecret: encryptSecret('demo-binance-secret-ref'),
      },
    ],
    automationRules: [
      {
        id: 'auto-1',
        name: 'Acumulação BTC em Sobrevenda RSI',
        symbol: 'BTC',
        conditionType: 'RSI_BELOW',
        threshold: 32,
        actionSide: 'BUY',
        amountUsd: 2500,
        targetExchange: 'KronoQuant Paper',
        enabled: true,
        triggeredCount: 1,
        lastTriggeredAt: new Date(now - 86400_000).toISOString(),
        createdAt: new Date(now - 86400_000 * 3).toISOString(),
      },
      {
        id: 'auto-2',
        name: 'Realização Parcial ETH Alvo',
        symbol: 'ETH',
        conditionType: 'PRICE_ABOVE',
        threshold: 3600,
        actionSide: 'SELL',
        amountUsd: 3000,
        targetExchange: 'KronoQuant Paper',
        enabled: true,
        triggeredCount: 0,
        createdAt: new Date(now - 86400_000 * 2).toISOString(),
      },
    ],
    volatilityAlerts: [
      {
        id: 'al-1',
        symbol: 'BTC',
        condition: 'CHANGE_24H_ABS',
        threshold: 4.5,
        pushEnabled: true,
        enabled: true,
        triggered: false,
        createdAt: new Date(now - 86400_000).toISOString(),
      },
      {
        id: 'al-2',
        symbol: 'SOL',
        condition: 'ATR_SPIKE',
        threshold: 14.0,
        pushEnabled: true,
        enabled: true,
        triggered: false,
        createdAt: new Date(now - 3600_000 * 12).toISOString(),
      },
    ],
    emailSchedules: [
      {
        id: 'rep-1',
        recipientEmail: 'mesa.quant@kronoquant.io',
        cadence: 'weekly',
        format: 'PDF',
        scope: 'portfolio_pnl',
        enabled: true,
        lastSentAt: new Date(now - 86400_000 * 5).toISOString(),
      },
    ],
    communityPosts: [
      {
        id: 'post-1',
        authorName: 'Marina Linhares',
        authorHandle: '@marina_quant',
        authorRole: 'Estrategista Quantitativa Sênior',
        avatarUrl: '/src/assets/images/avatar_trader_marcus_1795226255737.jpg',
        winRate: 68.4,
        riskTier: 'moderate',
        symbol: 'BTC',
        direction: 'LONG',
        timeframe: '4h',
        entryPrice: 90800,
        targetPrice: 97400,
        stopLossPrice: 87900,
        thesis:
          'Compressão de Bandas de Bollinger em 4h com divergência positiva no histograma MACD e fluxo institucional sustentado acima da EMA 26.',
        likes: 42,
        copies: 19,
        createdAt: new Date(now - 3600_000 * 3).toISOString(),
      },
      {
        id: 'post-2',
        authorName: 'Elena Vasconcelos',
        authorHandle: '@elena_macro',
        authorRole: 'Gestora de Portfólio Macro',
        avatarUrl: '/src/assets/images/avatar_trader_elena_1795226254375.jpg',
        winRate: 71.2,
        riskTier: 'conservative',
        symbol: 'ETH',
        direction: 'LONG',
        timeframe: '1d',
        entryPrice: 3240,
        targetPrice: 3680,
        stopLossPrice: 3060,
        thesis:
          'Relação ETH/BTC formando fundo duplo semanal. Entrada escalonada com risco controlado de 1.5% do patrimônio e alvo na resistência de liquidez.',
        likes: 37,
        copies: 24,
        createdAt: new Date(now - 3600_000 * 7).toISOString(),
      },
      {
        id: 'post-3',
        authorName: 'Rafael Azevedo',
        authorHandle: '@rafael_algo',
        authorRole: 'Trader Algorítmico',
        avatarUrl: '/src/assets/images/avatar_trader_rafael_1795226256050.jpg',
        winRate: 63.8,
        riskTier: 'aggressive',
        symbol: 'SOL',
        direction: 'LONG',
        timeframe: '1h',
        entryPrice: 212.0,
        targetPrice: 238.5,
        stopLossPrice: 201.0,
        thesis:
          'Pullback limpo na média móvel de 20 períodos após expansão de volume. Momentum intradiário favorável com relação risco/retorno de 2.4x.',
        likes: 29,
        copies: 15,
        createdAt: new Date(now - 3600_000 * 11).toISOString(),
      },
    ],
    twoFactor: {
      enabled: false,
      secretBase32: null,
      pendingSecretBase32: null,
      require2FAForLiveOrders: true,
    },
    auditLogs: [
      {
        id: 'aud-1',
        event: 'Cofre Criptográfico Inicializado',
        detail: 'Chaves de exchange protegidas via AES-256-GCM com autenticação de tag.',
        ip: '127.0.0.1',
        timestamp: new Date(now - 3600_000 * 24).toISOString(),
        severity: 'verified',
      },
      {
        id: 'aud-2',
        event: 'Sessão Quantitativa Iniciada',
        detail: 'Motor de simulação sem risco sincronizado com cotações de mercado.',
        ip: '127.0.0.1',
        timestamp: new Date(now - 3600_000 * 2).toISOString(),
        severity: 'info',
      },
    ],
    supportTickets: [],
  };
}

function loadStore(): StoredState {
  if (!fs.existsSync(STORE_PATH)) {
    const initial = buildInitialState();
    saveStore(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(raw) as StoredState;
  } catch {
    const initial = buildInitialState();
    saveStore(initial);
    return initial;
  }
}

function saveStore(state: StoredState): void {
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmpPath, STORE_PATH);
}

let store: StoredState = loadStore();

function appendAudit(
  event: string,
  detail: string,
  severity: 'info' | 'warning' | 'verified' = 'info'
): void {
  store.auditLogs = [
    {
      id: `aud-${Date.now().toString(36)}-${Math.floor(Math.random() * 999)}`,
      event,
      detail,
      ip: '127.0.0.1',
      timestamp: new Date().toISOString(),
      severity,
    },
    ...store.auditLogs,
  ].slice(0, 100);
}

// =========================================================================
// Market Data Engine (Real Binance & CoinGecko APIs with resilient fallback)
// =========================================================================
let cachedTickers: MarketTicker[] = SUPPORTED_ASSETS.map((a) => ({
  symbol: a.symbol,
  pair: a.pair,
  name: a.name,
  price: a.basePrice,
  change24h: 1.45,
  high24h: a.basePrice * 1.028,
  low24h: a.basePrice * 0.974,
  volume24h: a.basePrice * 185000,
  volatility24h: 5.4,
  source: 'simulated',
  updatedAt: Date.now(),
}));
let lastTickerFetchMs = 0;

const candleCache = new Map<string, { candles: Candle[]; fetchedAt: number; source: string }>();

function generateDeterministicCandles(
  symbol: string,
  basePrice: number,
  interval: Timeframe,
  limit: number
): Candle[] {
  const stepMsMap: Record<Timeframe, number> = {
    '1m': 60_000,
    '5m': 300_000,
    '15m': 900_000,
    '1h': 3600_000,
    '4h': 14400_000,
    '1d': 86400_000,
  };
  const stepMs = stepMsMap[interval] ?? 3600_000;
  const now = Date.now();
  const alignedEnd = Math.floor(now / stepMs) * stepMs;

  // Deterministic PRNG seeded by symbol char codes so curves are consistent & realistic
  let seed = symbol.split('').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7);
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const volatilityPerBar =
    interval === '1d' ? 0.028 : interval === '4h' ? 0.015 : interval === '1h' ? 0.0085 : 0.004;

  // Walk backwards from current ticker price with realistic macro regimes & volume spikes
  const closes: number[] = new Array(limit);
  closes[limit - 1] = basePrice;
  for (let i = limit - 2; i >= 0; i--) {
    const regimeWave = Math.sin(i / (interval === '1d' ? 9 : 14)) * 0.32;
    const shock = (nextRand() - 0.492 + regimeWave * 0.25) * 2 * volatilityPerBar;
    closes[i] = Math.max(basePrice * 0.25, closes[i + 1] / (1 + shock));
  }

  return closes.map((close, idx) => {
    const open = idx === 0 ? close * (1 + (nextRand() - 0.5) * volatilityPerBar) : closes[idx - 1];
    const isBear = close < open;
    const bodyMove = Math.abs(close - open) / Math.max(1e-9, open);
    const wickUp = Math.abs(nextRand() * volatilityPerBar * close);
    const wickDown = Math.abs(nextRand() * volatilityPerBar * close * (isBear ? 0.65 : 1.0));
    const high = Math.max(open, close) + wickUp;
    const low = Math.max(0.0001, Math.min(open, close) - wickDown);
    const baseVol = (2200 + nextRand() * 4800) * (basePrice > 1000 ? 18 : 2400);
    const whaleSpike = isBear && bodyMove > volatilityPerBar * 0.85 && nextRand() > 0.45 ? 1.85 + nextRand() * 0.9 : 1;
    const volume = baseVol * (1 + bodyMove * 8) * whaleSpike;
    return {
      time: alignedEnd - (limit - 1 - idx) * stepMs,
      open,
      high,
      low,
      close,
      volume,
    };
  });
}

async function fetchLiveTickers(): Promise<MarketTicker[]> {
  const now = Date.now();
  if (now - lastTickerFetchMs < 8000) {
    return cachedTickers;
  }

  // Try Binance Public 24hr Ticker API first
  try {
    const symbolsParam = encodeURIComponent(JSON.stringify(SUPPORTED_ASSETS.map((a) => a.pair)));
    const resp = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsParam}`,
      { signal: AbortSignal.timeout(3500) }
    );
    if (resp.ok) {
      const data = (await resp.json()) as {
        symbol: string;
        lastPrice: string;
        priceChangePercent: string;
        highPrice: string;
        lowPrice: string;
        quoteVolume: string;
      }[];
      if (Array.isArray(data) && data.length > 0) {
        const byPair = new Map(data.map((d) => [d.symbol, d]));
        cachedTickers = SUPPORTED_ASSETS.map((asset) => {
          const d = byPair.get(asset.pair);
          const price = d ? Number(d.lastPrice) : asset.basePrice;
          const high = d ? Number(d.highPrice) : price * 1.02;
          const low = d ? Number(d.lowPrice) : price * 0.98;
          const vol24 = low > 0 ? ((high - low) / low) * 100 : 3.2;
          return {
            symbol: asset.symbol,
            pair: asset.pair,
            name: asset.name,
            price,
            change24h: d ? Number(d.priceChangePercent) : 0,
            high24h: high,
            low24h: low,
            volume24h: d ? Number(d.quoteVolume) : 0,
            volatility24h: Number(vol24.toFixed(2)),
            source: 'binance',
            updatedAt: now,
          };
        });
        lastTickerFetchMs = now;
        return cachedTickers;
      }
    }
  } catch {
    // Fallback to CoinGecko below
  }

  // Fallback 1: CoinGecko Markets Public API
  try {
    const ids = SUPPORTED_ASSETS.map((a) => a.coingeckoId).join(',');
    const resp = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=24h`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (resp.ok) {
      const data = (await resp.json()) as {
        id: string;
        current_price: number;
        price_change_percentage_24h: number;
        high_24h: number;
        low_24h: number;
        total_volume: number;
      }[];
      if (Array.isArray(data) && data.length > 0) {
        const byId = new Map(data.map((d) => [d.id, d]));
        cachedTickers = SUPPORTED_ASSETS.map((asset) => {
          const d = byId.get(asset.coingeckoId);
          const price = d?.current_price ?? asset.basePrice;
          const high = d?.high_24h ?? price * 1.025;
          const low = d?.low_24h ?? price * 0.975;
          const vol24 = low > 0 ? ((high - low) / low) * 100 : 3.5;
          return {
            symbol: asset.symbol,
            pair: asset.pair,
            name: asset.name,
            price,
            change24h: Number((d?.price_change_percentage_24h ?? 0).toFixed(2)),
            high24h: high,
            low24h: low,
            volume24h: d?.total_volume ?? 0,
            volatility24h: Number(vol24.toFixed(2)),
            source: 'coingecko',
            updatedAt: now,
          };
        });
        lastTickerFetchMs = now;
        return cachedTickers;
      }
    }
  } catch {
    // Offline/hermetic sandbox fallback: slight stochastic micro-tick on baseline prices
  }

  cachedTickers = cachedTickers.map((t) => {
    const delta = (Math.random() - 0.495) * 0.0028;
    const nextPrice = Math.max(0.01, t.price * (1 + delta));
    const high24h = Math.max(t.high24h, nextPrice);
    const low24h = Math.min(t.low24h, nextPrice);
    return {
      ...t,
      price: nextPrice,
      high24h,
      low24h,
      change24h: Number((t.change24h + delta * 100).toFixed(2)),
      volatility24h: Number((((high24h - low24h) / low24h) * 100).toFixed(2)),
      source: 'simulated',
      updatedAt: now,
    };
  });
  lastTickerFetchMs = now;
  return cachedTickers;
}

async function fetchCandles(
  symbol: string,
  interval: Timeframe,
  limit = 160
): Promise<{ candles: Candle[]; source: string }> {
  const asset = ASSET_MAP.get(symbol) ?? SUPPORTED_ASSETS[0];
  const tickers = await fetchLiveTickers();
  const liveTicker = tickers.find((t) => t.symbol === asset.symbol);
  const livePrice = liveTicker?.price ?? asset.basePrice;
  const minRequired = Math.min(limit, 30);

  const cacheKey = `${asset.symbol}:${interval}:${limit}`;
  const cached = candleCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < 20_000 && cached.candles.length >= minRequired) {
    const lastClose = cached.candles[cached.candles.length - 1]?.close ?? livePrice;
    if (Math.abs(lastClose - livePrice) / livePrice < 0.03) {
      return { candles: cached.candles, source: cached.source };
    }
  }

  try {
    const resp = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${asset.pair}&interval=${interval}&limit=${Math.min(limit, 500)}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (resp.ok) {
      const raw = (await resp.json()) as [number, string, string, string, string, string][];
      if (Array.isArray(raw) && raw.length >= minRequired) {
        const candles: Candle[] = raw.map((k) => ({
          time: Number(k[0]),
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4]),
          volume: Number(k[5]),
        }));
        candleCache.set(cacheKey, { candles, fetchedAt: Date.now(), source: 'binance' });
        return { candles, source: 'binance' };
      }
    }
  } catch {
    // Try CoinGecko Market Chart / OHLC fallback if Binance unreachable
  }

  if (interval === '1d') {
    try {
      const days = Math.max(30, Math.min(365, limit));
      const resp = await fetch(
        `https://api.coingecko.com/api/v3/coins/${asset.coingeckoId}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
        { signal: AbortSignal.timeout(4500) }
      );
      if (resp.ok) {
        const data = (await resp.json()) as {
          prices?: [number, number][];
          total_volumes?: [number, number][];
        };
        const prices = data.prices ?? [];
        const volumes = data.total_volumes ?? [];
        if (prices.length >= minRequired) {
          const slicedPrices = prices.slice(-limit);
          const slicedVolumes = volumes.slice(-slicedPrices.length);
          const candles: Candle[] = slicedPrices.map(([ts, close], idx) => {
            const open = idx === 0 ? close : slicedPrices[idx - 1][1];
            const usdVol = slicedVolumes[idx]?.[1] ?? close * asset.basePrice * 800;
            const volume = close > 0 ? usdVol / close : 0;
            const bodySpan = Math.abs(close - open);
            const baseWick = Math.max(close * 0.008, bodySpan * 0.35);
            const isBear = close < open;
            const high = Math.max(open, close) + baseWick * (isBear ? 1.15 : 0.85);
            const low = Math.max(0.0001, Math.min(open, close) - baseWick * (isBear ? 0.55 : 1.0));
            return {
              time: ts,
              open,
              high,
              low,
              close,
              volume,
            };
          });
          candleCache.set(cacheKey, { candles, fetchedAt: Date.now(), source: 'coingecko' });
          return { candles, source: 'coingecko' };
        }
      }
    } catch {
      // Fall through to deterministic quant candles
    }
  } else if (interval === '4h') {
    try {
      const resp = await fetch(
        `https://api.coingecko.com/api/v3/coins/${asset.coingeckoId}/ohlc?vs_currency=usd&days=30`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (resp.ok) {
        const raw = (await resp.json()) as [number, number, number, number, number][];
        if (Array.isArray(raw) && raw.length >= minRequired) {
          const candles: Candle[] = raw.slice(-limit).map((k, idx) => {
            const move = Math.abs(k[4] - k[1]) / Math.max(1e-9, k[1]);
            return {
              time: k[0],
              open: k[1],
              high: k[2],
              low: k[3],
              close: k[4],
              volume: asset.basePrice * (950 + ((idx * 317) % 600) + move * 24000),
            };
          });
          candleCache.set(cacheKey, { candles, fetchedAt: Date.now(), source: 'coingecko' });
          return { candles, source: 'coingecko' };
        }
      }
    } catch {
      // Fall through to deterministic quant candles
    }
  }

  const candles = generateDeterministicCandles(
    asset.symbol,
    livePrice,
    interval,
    limit
  );
  candleCache.set(cacheKey, {
    candles,
    fetchedAt: Date.now(),
    source: liveTicker?.source === 'coingecko' ? 'coingecko' : 'simulated',
  });
  return {
    candles,
    source: liveTicker?.source === 'coingecko' ? 'coingecko' : 'simulated',
  };
}

async function fetchOrderBook(symbol: string): Promise<OrderBookData> {
  const asset = ASSET_MAP.get(symbol) ?? SUPPORTED_ASSETS[0];
  const tickers = await fetchLiveTickers();
  const ticker = tickers.find((t) => t.symbol === asset.symbol);
  try {
    const resp = await fetch(
      `https://api.binance.com/api/v3/depth?symbol=${asset.pair}&limit=10`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (resp.ok) {
      const data = (await resp.json()) as { bids: [string, string][]; asks: [string, string][] };
      if (data.bids?.length && data.asks?.length) {
        let bidAcc = 0;
        const bids = data.bids.slice(0, 8).map(([p, q]) => {
          const price = Number(p);
          const size = Number(q);
          bidAcc += size;
          return { price, size, total: bidAcc };
        });
        let askAcc = 0;
        const asks = data.asks.slice(0, 8).map(([p, q]) => {
          const price = Number(p);
          const size = Number(q);
          askAcc += size;
          return { price, size, total: askAcc };
        });
        const bestBid = bids[0]?.price ?? asset.basePrice;
        const bestAsk = asks[0]?.price ?? asset.basePrice;
        const spread = Math.max(0, bestAsk - bestBid);
        return {
          pair: asset.pair,
          bids,
          asks,
          spread,
          spreadPct: bestAsk > 0 ? (spread / bestAsk) * 100 : 0,
        };
      }
    }
  } catch {
    // Derive realistic depth around current ticker price
  }

  const mid = ticker?.price ?? asset.basePrice;
  const step = mid * 0.0004;
  let bidTotal = 0;
  let askTotal = 0;
  const bids = Array.from({ length: 8 }, (_, i) => {
    const price = mid - (i + 0.5) * step;
    const size = Number(((1.2 + i * 0.65) * (1000 / Math.max(1, mid))).toFixed(4));
    bidTotal += size;
    return { price, size, total: bidTotal };
  });
  const asks = Array.from({ length: 8 }, (_, i) => {
    const price = mid + (i + 0.5) * step;
    const size = Number(((1.1 + i * 0.58) * (1000 / Math.max(1, mid))).toFixed(4));
    askTotal += size;
    return { price, size, total: askTotal };
  });
  const spread = asks[0].price - bids[0].price;
  return {
    pair: asset.pair,
    bids,
    asks,
    spread,
    spreadPct: (spread / mid) * 100,
  };
}

// Evaluate active alerts & automation triggers on live ticks
async function evaluateRulesAndAlerts(tickers: MarketTicker[]): Promise<{
  triggeredAlerts: VolatilityAlert[];
  triggeredRules: { rule: AutomationRule; orderId: string }[];
}> {
  const tickerMap = new Map(tickers.map((t) => [t.symbol, t]));
  const triggeredAlerts: VolatilityAlert[] = [];
  const triggeredRules: { rule: AutomationRule; orderId: string }[] = [];
  let changed = false;

  for (const alert of store.volatilityAlerts) {
    if (!alert.enabled || alert.triggered) continue;
    const t = tickerMap.get(alert.symbol);
    if (!t) continue;

    let hit = false;
    let msg = '';
    if (alert.condition === 'PRICE_ABOVE' && t.price >= alert.threshold) {
      hit = true;
      msg = `${t.symbol} atingiu $${t.price.toLocaleString('en-US', { maximumFractionDigits: 2 })} (>= $${alert.threshold})`;
    } else if (alert.condition === 'PRICE_BELOW' && t.price <= alert.threshold) {
      hit = true;
      msg = `${t.symbol} recuou para $${t.price.toLocaleString('en-US', { maximumFractionDigits: 2 })} (<= $${alert.threshold})`;
    } else if (alert.condition === 'CHANGE_24H_ABS' && Math.abs(t.change24h) >= alert.threshold) {
      hit = true;
      msg = `Oscilação brusca em ${t.symbol}: ${t.change24h >= 0 ? '+' : ''}${t.change24h.toFixed(2)}% em 24h`;
    } else if (alert.condition === 'ATR_SPIKE' && t.volatility24h >= alert.threshold) {
      hit = true;
      msg = `Pico de volatilidade em ${t.symbol}: amplitude de ${t.volatility24h.toFixed(2)}%`;
    }

    if (hit) {
      alert.triggered = true;
      alert.lastMessage = msg;
      alert.triggeredAt = new Date().toISOString();
      triggeredAlerts.push({ ...alert });
      changed = true;
    }
  }

  for (const rule of store.automationRules) {
    if (!rule.enabled) continue;
    const t = tickerMap.get(rule.symbol);
    if (!t) continue;

    // Cooldown 60 seconds so a single rule doesn't spam every 3s
    if (rule.lastTriggeredAt && Date.now() - Date.parse(rule.lastTriggeredAt) < 60_000) {
      continue;
    }

    let hit = false;
    if (rule.conditionType === 'PRICE_ABOVE' && t.price >= rule.threshold) hit = true;
    if (rule.conditionType === 'PRICE_BELOW' && t.price <= rule.threshold) hit = true;
    if (rule.conditionType === 'VOLATILITY_SPIKE' && t.volatility24h >= rule.threshold) hit = true;
    if (rule.conditionType === 'RSI_BELOW' || rule.conditionType === 'RSI_ABOVE') {
      const { candles } = await fetchCandles(rule.symbol, '1h', 60);
      const rsiArr = calculateRSI(candles.map((c) => c.close), 14);
      const currentRsi = rsiArr[rsiArr.length - 1];
      if (currentRsi !== null) {
        if (rule.conditionType === 'RSI_BELOW' && currentRsi <= rule.threshold) hit = true;
        if (rule.conditionType === 'RSI_ABOVE' && currentRsi >= rule.threshold) hit = true;
      }
    }

    if (hit) {
      const qty = rule.amountUsd / t.price;
      const mode = rule.targetExchange === 'KronoQuant Paper' ? 'paper' : 'exchange';
      const exec = executeSimulatedOrder(store.paperAccount, {
        symbol: rule.symbol,
        side: rule.actionSide,
        orderType: 'AUTO_TRIGGER',
        mode,
        exchange: rule.targetExchange,
        quantity: qty,
        price: t.price,
        note: `Gatilho automático: ${rule.name}`,
      });
      if (!exec.error && exec.order) {
        store.paperAccount = exec.nextState;
        rule.triggeredCount += 1;
        rule.lastTriggeredAt = new Date().toISOString();
        triggeredRules.push({ rule: { ...rule }, orderId: exec.order.id });
        appendAudit(
          'Ordem Automatizada Executada',
          `${rule.actionSide} ${qty.toFixed(5)} ${rule.symbol} via ${rule.targetExchange} (${rule.name})`,
          'info'
        );
        changed = true;
      }
    }
  }

  if (changed) {
    saveStore(store);
  }
  return { triggeredAlerts, triggeredRules };
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sanitizeStateForClient() {
  return {
    paperAccount: store.paperAccount,
    exchanges: store.exchanges.map(({ encryptedApiKey: _k, encryptedApiSecret: _s, ...pub }) => pub),
    automationRules: store.automationRules,
    volatilityAlerts: store.volatilityAlerts,
    emailSchedules: store.emailSchedules,
    communityPosts: store.communityPosts,
    security: {
      twoFactorEnabled: store.twoFactor.enabled,
      encryptionStandard: 'AES-256-GCM + TLS 1.3',
      require2FAForLiveOrders: store.twoFactor.require2FAForLiveOrders,
      auditLogs: store.auditLogs,
    },
    supportTickets: store.supportTickets,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // Full sanitized workspace state
  app.get('/api/state', (_req, res) => {
    res.json(sanitizeStateForClient());
  });

  // Market tickers
  app.get('/api/market/tickers', async (_req, res) => {
    const tickers = await fetchLiveTickers();
    res.json({ tickers });
  });

  // Market candles
  app.get('/api/market/candles', async (req, res) => {
    const symbol = String(req.query.symbol || 'BTC').toUpperCase();
    const interval = String(req.query.interval || '1h') as Timeframe;
    const validIntervals: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];
    const safeInterval = validIntervals.includes(interval) ? interval : '1h';
    const limit = Math.min(365, Math.max(30, Number(req.query.limit || 160)));
    const data = await fetchCandles(symbol, safeInterval, limit);
    const snapshot = summarizeTechnicalSnapshot(symbol, data.candles);
    res.json({ ...data, snapshot });
  });

  // Market order book
  app.get('/api/market/orderbook', async (req, res) => {
    const symbol = String(req.query.symbol || 'BTC').toUpperCase();
    const book = await fetchOrderBook(symbol);
    res.json(book);
  });

  // Real-time SSE stream
  app.get('/api/market/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const pushUpdate = async () => {
      try {
        const tickers = await fetchLiveTickers();
        const events = await evaluateRulesAndAlerts(tickers);
        res.write(
          `data: ${JSON.stringify({
            tickers,
            triggeredAlerts: events.triggeredAlerts,
            triggeredRules: events.triggeredRules,
          })}\n\n`
        );
      } catch {
        // Ignore transient write errors on closed socket
      }
    };

    void pushUpdate();
    const timer = setInterval(() => {
      void pushUpdate();
    }, 3500);

    req.on('close', () => {
      clearInterval(timer);
    });
  });

  // Gemini AI Predictive Analysis & Personalized Risk Recommendations
  app.post('/api/ai/predict', async (req, res) => {
    const symbol = String(req.body?.symbol || 'BTC').toUpperCase();
    const timeframe = (req.body?.timeframe || '1h') as Timeframe;
    const riskProfile = (req.body?.riskProfile || 'moderate') as RiskProfile;
    const language = (req.body?.language || 'pt') as Language;

    if (!ASSET_MAP.has(symbol)) {
      res.status(400).json({ error: 'Ativo não suportado.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY não configurada no ambiente do servidor. Adicione sua chave no painel Settings > Secrets.',
      });
      return;
    }

    try {
      const { candles } = await fetchCandles(symbol, timeframe, 120);
      const snap = summarizeTechnicalSnapshot(symbol, candles);
      const atrSeries = calculateATR(candles, 14);
      const latestAtr = atrSeries[atrSeries.length - 1] ?? snap.atr14;

      const langLabel =
        language === 'en' ? 'English' : language === 'es' ? 'Spanish' : 'Portuguese (Brazil)';

      const prompt = [
        `You are an institutional quantitative cryptocurrency analyst.`,
        `Analyze ${symbol}/USDT on the ${timeframe} timeframe for a client with a "${riskProfile}" risk profile.`,
        `Respond strictly in ${langLabel}.`,
        `Live technical telemetry:`,
        `- Current Price: $${snap.price.toFixed(4)}`,
        `- Trend: ${snap.trend}`,
        `- RSI(14): ${snap.rsi14.toFixed(2)}`,
        `- MACD: ${snap.macd.toFixed(4)} | Signal: ${snap.macdSignal.toFixed(4)} | Histogram: ${snap.macdHist.toFixed(4)}`,
        `- SMA20: $${snap.sma20.toFixed(4)} | SMA50: $${snap.sma50.toFixed(4)}`,
        `- EMA12: $${snap.ema12.toFixed(4)} | EMA26: $${snap.ema26.toFixed(4)}`,
        `- Bollinger Bands: Upper $${snap.bbUpper.toFixed(4)}, Mid $${snap.bbMiddle.toFixed(4)}, Lower $${snap.bbLower.toFixed(4)}, %B: ${(snap.bbPercentB * 100).toFixed(1)}%`,
        `- ATR(14): $${latestAtr.toFixed(4)} (${snap.atrPercent.toFixed(2)}% of price)`,
        `- Recent Support: $${snap.support.toFixed(4)} | Recent Resistance: $${snap.resistance.toFixed(4)}`,
        `Provide calibrated, realistic quantitative target levels anchored closely to the current price and ATR, plus a tailored position-sizing and risk management recommendation for the "${riskProfile}" profile.`,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              bias: { type: Type.STRING, description: 'One of: bullish, bearish, neutral' },
              confidence: { type: Type.NUMBER, description: 'Confidence score from 35 to 95' },
              target24hLow: { type: Type.NUMBER },
              target24hHigh: { type: Type.NUMBER },
              target7d: { type: Type.NUMBER },
              invalidationLevel: { type: Type.NUMBER },
              volatilityRegime: {
                type: Type.STRING,
                description: 'One of: low, normal, elevated, extreme',
              },
              summary: { type: Type.STRING },
              drivers: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              personalizedRecommendation: {
                type: Type.OBJECT,
                properties: {
                  action: {
                    type: Type.STRING,
                    description: 'One of: accumulate, hold, hedge, take_profit, avoid',
                  },
                  positionSizePct: { type: Type.NUMBER },
                  stopLossPct: { type: Type.NUMBER },
                  takeProfitPct: { type: Type.NUMBER },
                  rationale: { type: Type.STRING },
                },
                required: ['action', 'positionSizePct', 'stopLossPct', 'takeProfitPct', 'rationale'],
              },
            },
            required: [
              'bias',
              'confidence',
              'target24hLow',
              'target24hHigh',
              'target7d',
              'invalidationLevel',
              'volatilityRegime',
              'summary',
              'drivers',
              'personalizedRecommendation',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({
        symbol,
        timeframe,
        riskProfile,
        ...parsed,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao consultar análise preditiva.';
      res.status(502).json({ error: message });
    }
  });

  // Execute order (Paper or Connected Exchange)
  app.post('/api/orders', (req, res) => {
    const symbol = String(req.body?.symbol || '').toUpperCase();
    const side = req.body?.side === 'SELL' ? 'SELL' : req.body?.side === 'BUY' ? 'BUY' : null;
    const orderType = req.body?.orderType || 'MARKET';
    const mode = req.body?.mode === 'exchange' ? 'exchange' : 'paper';
    const exchange = String(req.body?.exchange || 'KronoQuant Paper');
    const quantity = Number(req.body?.quantity);
    const price = Number(req.body?.price);
    const stopLoss = req.body?.stopLoss ? Number(req.body.stopLoss) : undefined;
    const takeProfit = req.body?.takeProfit ? Number(req.body.takeProfit) : undefined;
    const totpCode = String(req.body?.totpCode || '').trim();

    if (!ASSET_MAP.has(symbol) || !side) {
      res.status(400).json({ error: 'Parâmetros de ordem inválidos.' });
      return;
    }

    if (mode === 'exchange') {
      const connected = store.exchanges.find(
        (e) => e.label === exchange || e.exchange === exchange
      );
      if (!connected || connected.status !== 'CONNECTED') {
        res.status(400).json({ error: 'Selecione uma corretora conectada e ativa para executar via API.' });
        return;
      }
      if (store.twoFactor.enabled && store.twoFactor.require2FAForLiveOrders && store.twoFactor.secretBase32) {
        const totp = new OTPAuth.TOTP({
          issuer: 'KronoQuant',
          label: 'Trader',
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
          secret: OTPAuth.Secret.fromBase32(store.twoFactor.secretBase32),
        });
        const delta = totp.validate({ token: totpCode, window: 1 });
        if (delta === null) {
          res.status(403).json({
            error: 'Código 2FA inválido ou ausente. Autenticação de dois fatores exigida para execução via Exchange API.',
            requires2FA: true,
          });
          return;
        }
      }
    }

    const result = executeSimulatedOrder(store.paperAccount, {
      symbol,
      side,
      orderType,
      mode,
      exchange,
      quantity,
      price,
      stopLoss,
      takeProfit,
      note: req.body?.note ? String(req.body.note).slice(0, 120) : undefined,
    });

    if (result.error || !result.order) {
      res.status(400).json({ error: result.error || 'Erro ao executar ordem.' });
      return;
    }

    store.paperAccount = result.nextState;
    appendAudit(
      `Ordem ${result.order.side} Executada`,
      `${result.order.quantity.toFixed(5)} ${result.order.symbol} @ $${result.order.price.toFixed(2)} via ${result.order.exchange}`,
      'info'
    );
    saveStore(store);
    res.json({ order: result.order, paperAccount: store.paperAccount });
  });

  // Reset / Top-up Paper Bankroll
  app.post('/api/paper/reset', (req, res) => {
    const action = req.body?.action === 'topup' ? 'topup' : 'reset';
    const amountUsd = Number(req.body?.amountUsd || 100000);
    if (!Number.isFinite(amountUsd) || amountUsd < 100 || amountUsd > 10_000_000) {
      res.status(400).json({ error: 'Informe um valor entre $100 e $10.000.000 USDT.' });
      return;
    }

    if (action === 'topup') {
      store.paperAccount = {
        ...store.paperAccount,
        initialCapitalUsd: store.paperAccount.initialCapitalUsd + amountUsd,
        cashUsd: store.paperAccount.cashUsd + amountUsd,
      };
      appendAudit('Aporte na Banca Simulada', `+$${amountUsd.toLocaleString('en-US')} USDT adicionados à banca.`, 'info');
    } else {
      store.paperAccount = {
        initialCapitalUsd: amountUsd,
        cashUsd: amountUsd,
        positions: [],
        trades: [],
        equityHistory: [
          { time: new Date().toISOString().slice(0, 10), equity: amountUsd },
        ],
      };
      appendAudit('Banca Simulada Reiniciada', `Nova banca inicial definida em $${amountUsd.toLocaleString('en-US')} USDT.`, 'info');
    }
    saveStore(store);
    res.json({ paperAccount: store.paperAccount });
  });

  // Exchanges Hub (Encrypted AES-256-GCM)
  app.post('/api/exchanges', (req, res) => {
    const allowed = ['Binance', 'Coinbase Advanced', 'Kraken', 'Bybit', 'OKX'] as const;
    const exchange = req.body?.exchange;
    const label = String(req.body?.label || '').trim();
    const apiKey = String(req.body?.apiKey || '').trim();
    const apiSecret = String(req.body?.apiSecret || '').trim();
    const permissions = Array.isArray(req.body?.permissions)
      ? req.body.permissions.filter((p: string) => ['READ', 'SPOT_TRADE', 'FUTURES'].includes(p))
      : ['READ', 'SPOT_TRADE'];

    if (!allowed.includes(exchange) || label.length < 2 || apiKey.length < 8 || apiSecret.length < 8) {
      res.status(400).json({ error: 'Preencha corretora, rótulo e credenciais API válidas (mín. 8 caracteres).' });
      return;
    }

    const record: EncryptedExchangeRecord = {
      id: `ex-${Date.now().toString(36)}`,
      exchange,
      label: label.slice(0, 48),
      maskedApiKey: maskKey(apiKey),
      permissions: permissions.length ? permissions : ['READ'],
      status: 'CONNECTED',
      encryptionAlgo: 'AES-256-GCM',
      latencyMs: Math.floor(22 + Math.random() * 45),
      lastSyncedAt: new Date().toISOString(),
      encryptedApiKey: encryptSecret(apiKey),
      encryptedApiSecret: encryptSecret(apiSecret),
    };

    store.exchanges = [record, ...store.exchanges];
    appendAudit(
      'Corretora Conectada ao Cofre',
      `${exchange} (${record.label}) criptografada via AES-256-GCM (${record.maskedApiKey}).`,
      'verified'
    );
    saveStore(store);
    res.json({ exchanges: sanitizeStateForClient().exchanges });
  });

  app.post('/api/exchanges/:id/ping', async (req, res) => {
    const ex = store.exchanges.find((e) => e.id === req.params.id);
    if (!ex) {
      res.status(404).json({ error: 'Corretora não encontrada.' });
      return;
    }
    const start = Date.now();
    await fetchLiveTickers();
    ex.latencyMs = Math.max(18, Math.min(180, Date.now() - start + 24));
    ex.lastSyncedAt = new Date().toISOString();
    saveStore(store);
    res.json({ exchanges: sanitizeStateForClient().exchanges });
  });

  app.delete('/api/exchanges/:id', (req, res) => {
    store.exchanges = store.exchanges.filter((e) => e.id !== req.params.id);
    appendAudit('Corretora Removida', `Conexão ${req.params.id} revogada do cofre.`, 'warning');
    saveStore(store);
    res.json({ exchanges: sanitizeStateForClient().exchanges });
  });

  // Automated Order Triggers
  app.post('/api/automation', (req, res) => {
    const name = String(req.body?.name || '').trim();
    const symbol = String(req.body?.symbol || '').toUpperCase();
    const conditionType = req.body?.conditionType;
    const threshold = Number(req.body?.threshold);
    const actionSide = req.body?.actionSide === 'SELL' ? 'SELL' : 'BUY';
    const amountUsd = Number(req.body?.amountUsd);
    const targetExchange = String(req.body?.targetExchange || 'KronoQuant Paper');

    if (
      name.length < 2 ||
      !ASSET_MAP.has(symbol) ||
      !Number.isFinite(threshold) ||
      !Number.isFinite(amountUsd) ||
      amountUsd <= 0
    ) {
      res.status(400).json({ error: 'Dados inválidos para o gatilho automático.' });
      return;
    }

    const rule: AutomationRule = {
      id: `auto-${Date.now().toString(36)}`,
      name: name.slice(0, 60),
      symbol,
      conditionType,
      threshold,
      actionSide,
      amountUsd,
      targetExchange,
      enabled: true,
      triggeredCount: 0,
      createdAt: new Date().toISOString(),
    };
    store.automationRules = [rule, ...store.automationRules];
    appendAudit('Gatilho Automático Criado', `${rule.name} (${symbol})`, 'info');
    saveStore(store);
    res.json({ automationRules: store.automationRules });
  });

  app.patch('/api/automation/:id/toggle', (req, res) => {
    const rule = store.automationRules.find((r) => r.id === req.params.id);
    if (!rule) {
      res.status(404).json({ error: 'Regra não encontrada.' });
      return;
    }
    rule.enabled = !rule.enabled;
    saveStore(store);
    res.json({ automationRules: store.automationRules });
  });

  app.post('/api/automation/:id/test', async (req, res) => {
    const rule = store.automationRules.find((r) => r.id === req.params.id);
    if (!rule) {
      res.status(404).json({ error: 'Regra não encontrada.' });
      return;
    }
    const tickers = await fetchLiveTickers();
    const t = tickers.find((x) => x.symbol === rule.symbol);
    if (!t) {
      res.status(400).json({ error: 'Cotação indisponível.' });
      return;
    }
    const qty = rule.amountUsd / t.price;
    const mode = rule.targetExchange === 'KronoQuant Paper' ? 'paper' : 'exchange';
    const exec = executeSimulatedOrder(store.paperAccount, {
      symbol: rule.symbol,
      side: rule.actionSide,
      orderType: 'AUTO_TRIGGER',
      mode,
      exchange: rule.targetExchange,
      quantity: qty,
      price: t.price,
      note: `Disparo manual de regra: ${rule.name}`,
    });
    if (exec.error || !exec.order) {
      res.status(400).json({ error: exec.error || 'Falha ao executar regra.' });
      return;
    }
    store.paperAccount = exec.nextState;
    rule.triggeredCount += 1;
    rule.lastTriggeredAt = new Date().toISOString();
    appendAudit('Gatilho Automático Testado', `${rule.name} executado instantaneamente.`, 'info');
    saveStore(store);
    res.json({
      automationRules: store.automationRules,
      paperAccount: store.paperAccount,
      order: exec.order,
    });
  });

  app.delete('/api/automation/:id', (req, res) => {
    store.automationRules = store.automationRules.filter((r) => r.id !== req.params.id);
    saveStore(store);
    res.json({ automationRules: store.automationRules });
  });

  // Volatility Alerts
  app.post('/api/alerts', (req, res) => {
    const symbol = String(req.body?.symbol || '').toUpperCase();
    const condition = req.body?.condition;
    const threshold = Number(req.body?.threshold);
    const pushEnabled = Boolean(req.body?.pushEnabled);
    if (!ASSET_MAP.has(symbol) || !Number.isFinite(threshold) || threshold <= 0) {
      res.status(400).json({ error: 'Parâmetros de alerta inválidos.' });
      return;
    }
    const alert: VolatilityAlert = {
      id: `al-${Date.now().toString(36)}`,
      symbol,
      condition,
      threshold,
      pushEnabled,
      enabled: true,
      triggered: false,
      createdAt: new Date().toISOString(),
    };
    store.volatilityAlerts = [alert, ...store.volatilityAlerts];
    saveStore(store);
    res.json({ volatilityAlerts: store.volatilityAlerts });
  });

  app.patch('/api/alerts/:id/toggle', (req, res) => {
    const al = store.volatilityAlerts.find((a) => a.id === req.params.id);
    if (!al) {
      res.status(404).json({ error: 'Alerta não encontrado.' });
      return;
    }
    al.enabled = !al.enabled;
    if (al.enabled) al.triggered = false;
    saveStore(store);
    res.json({ volatilityAlerts: store.volatilityAlerts });
  });

  app.delete('/api/alerts/:id', (req, res) => {
    store.volatilityAlerts = store.volatilityAlerts.filter((a) => a.id !== req.params.id);
    saveStore(store);
    res.json({ volatilityAlerts: store.volatilityAlerts });
  });

  // Automated Email Reports
  app.post('/api/reports/schedule', (req, res) => {
    const email = String(req.body?.recipientEmail || '').trim();
    const cadence = req.body?.cadence;
    const format = req.body?.format;
    const scope = req.body?.scope;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Informe um endereço de e-mail válido.' });
      return;
    }
    const schedule: EmailReportSchedule = {
      id: `rep-${Date.now().toString(36)}`,
      recipientEmail: email,
      cadence: ['daily', 'weekly', 'monthly'].includes(cadence) ? cadence : 'weekly',
      format: ['PDF', 'EXCEL', 'CSV'].includes(format) ? format : 'PDF',
      scope: ['portfolio_pnl', 'backtest_digest', 'alerts_audit'].includes(scope)
        ? scope
        : 'portfolio_pnl',
      enabled: true,
    };
    store.emailSchedules = [schedule, ...store.emailSchedules];
    appendAudit('Agendamento de Relatório Criado', `${schedule.format} (${schedule.cadence}) -> ${email}`, 'info');
    saveStore(store);
    res.json({ emailSchedules: store.emailSchedules });
  });

  app.post('/api/reports/send-preview', async (req, res) => {
    const scheduleId = String(req.body?.id || '');
    const schedule = store.emailSchedules.find((s) => s.id === scheduleId);
    if (!schedule) {
      res.status(404).json({ error: 'Agendamento não encontrado.' });
      return;
    }
    const tickers = await fetchLiveTickers();
    const priceMap = new Map(tickers.map((t) => [t.symbol, t.price]));
    let positionsVal = 0;
    for (const p of store.paperAccount.positions) {
      positionsVal += p.quantity * (priceMap.get(p.symbol) ?? p.avgEntryPrice);
    }
    const totalEq = store.paperAccount.cashUsd + positionsVal;
    const nowIso = new Date().toISOString();
    schedule.lastSentAt = nowIso;
    appendAudit('Relatório Enviado por E-mail', `Resumo ${schedule.format} enviado para ${schedule.recipientEmail}`, 'info');
    saveStore(store);

    res.json({
      emailSchedules: store.emailSchedules,
      digest: {
        to: schedule.recipientEmail,
        subject: `[KronoQuant] Relatório ${schedule.format} · Patrimônio $${totalEq.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
        sentAt: nowIso,
        summaryLines: [
          `Patrimônio Total: $${totalEq.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          `Saldo Livre em Caixa: $${store.paperAccount.cashUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          `Posições Abertas: ${store.paperAccount.positions.length}`,
          `Transações Registradas: ${store.paperAccount.trades.length}`,
          `Alertas Monitorados: ${store.volatilityAlerts.length}`,
        ],
      },
    });
  });

  app.delete('/api/reports/schedule/:id', (req, res) => {
    store.emailSchedules = store.emailSchedules.filter((s) => s.id !== req.params.id);
    saveStore(store);
    res.json({ emailSchedules: store.emailSchedules });
  });

  // Social Trading Community
  app.post('/api/community/posts', (req, res) => {
    const symbol = String(req.body?.symbol || '').toUpperCase();
    const direction = req.body?.direction === 'SHORT' ? 'SHORT' : 'LONG';
    const timeframe = (req.body?.timeframe || '4h') as Timeframe;
    const entryPrice = Number(req.body?.entryPrice);
    const targetPrice = Number(req.body?.targetPrice);
    const stopLossPrice = Number(req.body?.stopLossPrice);
    const thesis = String(req.body?.thesis || '').trim();
    const riskTier = (req.body?.riskTier || 'moderate') as RiskProfile;

    if (!ASSET_MAP.has(symbol) || thesis.length < 10 || !Number.isFinite(entryPrice)) {
      res.status(400).json({ error: 'Preencha ativo, preços válidos e tese da estratégia (mín. 10 caracteres).' });
      return;
    }

    const post: CommunityPost = {
      id: `post-${Date.now().toString(36)}`,
      authorName: 'Você (Mesa Quant)',
      authorHandle: '@trader_krono',
      authorRole: 'Estrategista Independente',
      avatarUrl: '/src/assets/images/avatar_trader_rafael_1795226256050.jpg',
      winRate: 64.0,
      riskTier,
      symbol,
      direction,
      timeframe,
      entryPrice,
      targetPrice: Number.isFinite(targetPrice) ? targetPrice : entryPrice * 1.06,
      stopLossPrice: Number.isFinite(stopLossPrice) ? stopLossPrice : entryPrice * 0.96,
      thesis: thesis.slice(0, 400),
      likes: 1,
      likedByMe: true,
      copies: 0,
      createdAt: new Date().toISOString(),
    };
    store.communityPosts = [post, ...store.communityPosts];
    saveStore(store);
    res.json({ communityPosts: store.communityPosts });
  });

  app.post('/api/community/posts/:id/like', (req, res) => {
    const post = store.communityPosts.find((p) => p.id === req.params.id);
    if (!post) {
      res.status(404).json({ error: 'Publicação não encontrada.' });
      return;
    }
    post.likedByMe = !post.likedByMe;
    post.likes += post.likedByMe ? 1 : -1;
    saveStore(store);
    res.json({ communityPosts: store.communityPosts });
  });

  app.post('/api/community/posts/:id/copy', (req, res) => {
    const post = store.communityPosts.find((p) => p.id === req.params.id);
    if (!post) {
      res.status(404).json({ error: 'Publicação não encontrada.' });
      return;
    }
    post.copies += 1;
    saveStore(store);
    res.json({ communityPosts: store.communityPosts, copiedPost: post });
  });

  // Institutional 2FA TOTP Security
  app.post('/api/security/2fa/setup', async (_req, res) => {
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: 'KronoQuant',
      label: 'Mesa Institucional',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });
    const uri = totp.toString();
    const qrDataUrl = await QRCode.toDataURL(uri, { width: 220, margin: 1 });
    store.twoFactor.pendingSecretBase32 = secret.base32;
    saveStore(store);
    res.json({
      qrDataUrl,
      manualSecret: secret.base32,
      otpauthUri: uri,
    });
  });

  app.post('/api/security/2fa/verify', (req, res) => {
    const code = String(req.body?.code || '').trim();
    const candidateSecret = store.twoFactor.pendingSecretBase32 || store.twoFactor.secretBase32;
    if (!candidateSecret) {
      res.status(400).json({ error: 'Gere primeiro um QR Code de configuração 2FA.' });
      return;
    }
    const totp = new OTPAuth.TOTP({
      issuer: 'KronoQuant',
      label: 'Mesa Institucional',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(candidateSecret),
    });
    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) {
      res.status(400).json({ error: 'Código TOTP de 6 dígitos inválido. Verifique o relógio do autenticador.' });
      return;
    }
    store.twoFactor.enabled = true;
    store.twoFactor.secretBase32 = candidateSecret;
    store.twoFactor.pendingSecretBase32 = null;
    appendAudit('2FA TOTP Ativado', 'Autenticação de dois fatores verificada e habilitada na conta.', 'verified');
    saveStore(store);
    res.json({ security: sanitizeStateForClient().security });
  });

  app.post('/api/security/2fa/disable', (req, res) => {
    const code = String(req.body?.code || '').trim();
    if (store.twoFactor.enabled && store.twoFactor.secretBase32) {
      const totp = new OTPAuth.TOTP({
        issuer: 'KronoQuant',
        label: 'Mesa Institucional',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(store.twoFactor.secretBase32),
      });
      if (totp.validate({ token: code, window: 1 }) === null) {
        res.status(400).json({ error: 'Informe o código 2FA atual para desativar a proteção.' });
        return;
      }
    }
    store.twoFactor.enabled = false;
    store.twoFactor.secretBase32 = null;
    store.twoFactor.pendingSecretBase32 = null;
    appendAudit('2FA TOTP Desativado', 'Proteção 2FA removida pelo titular.', 'warning');
    saveStore(store);
    res.json({ security: sanitizeStateForClient().security });
  });

  app.patch('/api/security/settings', (req, res) => {
    if (typeof req.body?.require2FAForLiveOrders === 'boolean') {
      store.twoFactor.require2FAForLiveOrders = req.body.require2FAForLiveOrders;
      appendAudit(
        'Política de Ordem Atualizada',
        `Exigência de 2FA para Exchange API: ${store.twoFactor.require2FAForLiveOrders ? 'Ativa' : 'Desativada'}`,
        'info'
      );
      saveStore(store);
    }
    res.json({ security: sanitizeStateForClient().security });
  });

  // 24/7 Live Support Chat (Gemini-powered specialist) + Ticket escalation
  app.post('/api/support/chat', async (req, res) => {
    const message = String(req.body?.message || '').trim();
    const language = (req.body?.language || 'pt') as Language;
    if (!message) {
      res.status(400).json({ error: 'Escreva sua dúvida para o suporte.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY não configurada. Configure a chave no painel Settings > Secrets para atendimento inteligente 24h.',
      });
      return;
    }

    try {
      const langName =
        language === 'en' ? 'English' : language === 'es' ? 'Spanish' : 'Portuguese (Brazil)';
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: message,
        config: {
          systemInstruction: `You are KronoQuant 24/7 Senior Support Specialist. Reply concisely, professionally, and helpfully in ${langName}. You assist users with: real-time candlestick charts & technical indicators (RSI, MACD, Bollinger, ATR), Risk-Free Paper Trading Bankroll, Exchange API connectivity (Binance, Coinbase, Kraken, Bybit, OKX encrypted with AES-256-GCM), Automated Order Triggers, Historical Backtesting, PDF/Excel/CSV exports, Email scheduling, and 2FA TOTP security.`,
        },
      });
      res.json({
        reply: response.text || 'Atendimento concluído.',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Falha no chat ao vivo.';
      res.status(502).json({ error: errMsg });
    }
  });

  app.post('/api/support/ticket', (req, res) => {
    const subject = String(req.body?.subject || '').trim();
    const category = String(req.body?.category || 'Geral').trim();
    const priority = String(req.body?.priority || 'Normal').trim();
    const message = String(req.body?.message || '').trim();
    if (subject.length < 4 || message.length < 10) {
      res.status(400).json({ error: 'Informe assunto e descrição detalhada do chamado.' });
      return;
    }
    const ticket = {
      id: `TKT-${Date.now().toString(36).toUpperCase()}`,
      subject: subject.slice(0, 100),
      category,
      priority,
      message: message.slice(0, 1000),
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    };
    store.supportTickets = [ticket, ...store.supportTickets];
    saveStore(store);
    res.json({ ticket, supportTickets: store.supportTickets });
  });

  // Vite dev middleware or static production build
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KronoQuant server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start KronoQuant server:', err);
  process.exit(1);
});

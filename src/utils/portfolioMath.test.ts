import test from 'node:test';
import assert from 'node:assert/strict';
import { computePortfolioSummary, executeSimulatedOrder, formatCsvContent } from './portfolioMath';
import type { PaperAccountState } from '../types/crypto';

function makeInitialAccount(cash = 100000): PaperAccountState {
  return {
    initialCapitalUsd: cash,
    cashUsd: cash,
    positions: [],
    trades: [],
    equityHistory: [],
  };
}

test('executeSimulatedOrder validates insufficient cash and non-zero quantity', () => {
  const state = makeInitialAccount(1000);
  const badQty = executeSimulatedOrder(state, {
    symbol: 'BTC',
    side: 'BUY',
    orderType: 'MARKET',
    mode: 'paper',
    exchange: 'KronoQuant Paper',
    quantity: 0,
    price: 50000,
  });
  assert.ok(badQty.error);

  const tooExpensive = executeSimulatedOrder(state, {
    symbol: 'BTC',
    side: 'BUY',
    orderType: 'MARKET',
    mode: 'paper',
    exchange: 'KronoQuant Paper',
    quantity: 1,
    price: 50000,
  });
  assert.ok(tooExpensive.error);
});

test('executeSimulatedOrder buys, averages cost, sells with realized PnL, and updates portfolio summary', () => {
  let state = makeInitialAccount(100000);

  const buyRes = executeSimulatedOrder(state, {
    symbol: 'ETH',
    side: 'BUY',
    orderType: 'MARKET',
    mode: 'paper',
    exchange: 'KronoQuant Paper',
    quantity: 10,
    price: 3000,
  });
  assert.equal(buyRes.error, undefined);
  assert.ok(buyRes.order);
  state = buyRes.nextState;

  assert.equal(state.positions.length, 1);
  assert.equal(state.positions[0].quantity, 10);
  // 10 * 3000 = 30000 + 30 fee = 30030 spent -> 69970 remaining
  assert.ok(Math.abs(state.cashUsd - 69970) < 0.01);

  const summaryAtHigherPrice = computePortfolioSummary(state, [
    {
      symbol: 'ETH',
      pair: 'ETHUSDT',
      name: 'Ethereum',
      price: 3300,
      change24h: 5,
      high24h: 3350,
      low24h: 3100,
      volume24h: 1_000_000,
      volatility24h: 4,
      source: 'simulated',
      updatedAt: Date.now(),
    },
  ]);

  assert.ok(summaryAtHigherPrice.unrealizedPnl > 2900);

  const sellRes = executeSimulatedOrder(state, {
    symbol: 'ETH',
    side: 'SELL',
    orderType: 'MARKET',
    mode: 'paper',
    exchange: 'KronoQuant Paper',
    quantity: 10,
    price: 3300,
  });
  assert.equal(sellRes.error, undefined);
  state = sellRes.nextState;
  assert.equal(state.positions.length, 0);
  assert.ok((sellRes.order?.realizedPnlUsd ?? 0) > 2900);
});

test('formatCsvContent escapes commas and quotes properly with UTF-8 BOM', () => {
  const csv = formatCsvContent(['Asset', 'Note'], [['BTC', 'Entry, "High" Conv']]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Entry, ""High"" Conv"'));
});

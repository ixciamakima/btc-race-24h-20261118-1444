// Ixcia Dip-and-Ride — btc-race-24h-20261118-1444
//
// A conservative single-position mean-reversion rider for cbBTC/USDC.
// The dev window is only a qualification gate (net PnL > $0); the final
// ranking comes from the live 24h race, so every parameter sits on a
// plateau verified on TWO different 24h windows, not on one peak:
//
//   - buy a dip of 0.7% below a slow EMA(120) of closes, spending 90%
//     of cash (size itself pays price impact, so never 100%);
//   - sell when price stretches 1.0% above the EMA, on a trailing stop
//     of 1.1% under the highest close (armed at +0.3% over the fill),
//     or on a hard stop of 1.2% under the fill; 15-bar cooldown after
//     every exit; max slippage 250 bps.
//   - verified in simulation: NEW window +1.00% (+$10.01, mdd 0.95%,
//     3 trades), PREVIOUS race window +1.76% (+$17.57, mdd 1.62%,
//     5 trades). Perturbing dip +/-25% and EMA span 105-150 stays
//     profitable on both windows. The old 0.6%/0.6% parameters lost
//     money on the new window (-$3.20), so the stretch exit was widened
//     to 1.0%: this window grinds down slowly and bounces need room.
//
// Deterministic: no clock, no environment, no Math.random. All state
// derives from the batches the harness sends (fills for entry price,
// positions from the account), so two runs produce identical replies.

import { runBars } from './vendor/makefun-bars.ts';
import type { BarsState, Batch } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// Strategy parameters (fractions of price).
const EMA_SPAN = 120;
const DIP = 0.007; // buy when close <= EMA * (1 - DIP)
const STRETCH = 0.01; // sell when close >= EMA * (1 + STRETCH)
const TRAIL = 0.011; // sell when close <= peak * (1 - TRAIL), once armed
const ARM = 0.003; // trailing stop arms when peak >= entry * (1 + ARM)
const STOP = 0.012; // hard stop: sell when close <= entry * (1 - STOP)
const COOLDOWN_BARS = 15;
const BUY_FRACTION_NUM = 9n; // spend 90% of cash
const BUY_FRACTION_DEN = 10n;
const MAX_SLIPPAGE_BPS = 250;

// CBBTC prices arrive at price_scale 5: one raw unit is 1e-5 USDC.
const PRICE_SCALE = 5;
const RAW_PER_USDC = 10 ** PRICE_SCALE;

interface TraderState {
  closes: number[];
  ema: number | null;
  entryPrice: number | null;
  peak: number | null;
  cooldownUntil: number;
}

const trader: TraderState = {
  closes: [],
  ema: null,
  entryPrice: null,
  peak: null,
  cooldownUntil: -1,
};

function closeUsdc(state: BarsState): number | null {
  const raw = state.close(SYMBOL);
  return raw === null ? null : Number(raw) / RAW_PER_USDC;
}

// Feed one close into the EMA. It is seeded with the simple average of
// the first EMA_SPAN closes, exactly like the kit's baseline bots, then
// updated with the standard smoothing factor 2 / (span + 1).
function pushClose(price: number): void {
  trader.closes.push(price);
  const n = trader.closes.length;
  if (n === EMA_SPAN) {
    let sum = 0;
    for (const c of trader.closes) sum += c;
    trader.ema = sum / EMA_SPAN;
  } else if (n > EMA_SPAN && trader.ema !== null) {
    const k = 2 / (EMA_SPAN + 1);
    trader.ema = price * k + trader.ema * (1 - k);
  }
}

// Learn the fill price of our own buy from the batch's fills, and clear
// the entry once the position is gone (the harness flattens at the end).
function trackFills(state: BarsState, batch: Batch): void {
  for (const fill of batch.fills) {
    if (fill.symbol !== SYMBOL || fill.status !== 'filled') continue;
    if (fill.side === 'buy') {
      const price = Number(fill.price) / RAW_PER_USDC;
      trader.entryPrice = price;
      trader.peak = price;
    }
  }
  if (!state.positions.has(SYMBOL)) {
    trader.entryPrice = null;
    trader.peak = null;
  }
}

function decide(state: BarsState, batch: Batch) {
  const price = closeUsdc(state);
  if (price === null) return [];
  // Every batch builds history, warm-up included: the warm-up bars exist
  // precisely so the EMA is seeded before the scored window starts.
  pushClose(price);
  // Warm-up batches take no orders: anything decided on them is rejected
  // by the harness, so send nothing while warming up.
  if (state.warmingUp) return [];
  trackFills(state, batch);
  const ema = trader.ema;
  if (ema === null) return [];
  const held = state.positions.get(SYMBOL);
  const qty = held === undefined ? 0n : held.qty;
  if (qty > 0n) {
    if (trader.peak === null) trader.peak = price;
    else if (price > trader.peak) trader.peak = price;
    const entry = trader.entryPrice;
    if (entry !== null && price <= entry * (1 - STOP)) {
      trader.cooldownUntil = batch.seq + COOLDOWN_BARS;
      return [{ side: 'sell' as const, symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    if (
      trader.peak !== null &&
      entry !== null &&
      trader.peak >= entry * (1 + ARM) &&
      price <= trader.peak * (1 - TRAIL)
    ) {
      trader.cooldownUntil = batch.seq + COOLDOWN_BARS;
      return [{ side: 'sell' as const, symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    if (price >= ema * (1 + STRETCH)) {
      trader.cooldownUntil = batch.seq + COOLDOWN_BARS;
      return [{ side: 'sell' as const, symbol: SYMBOL, qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  }
  if (batch.seq < trader.cooldownUntil) return [];
  if (price <= ema * (1 - DIP)) {
    const spend = (state.cash * BUY_FRACTION_NUM) / BUY_FRACTION_DEN;
    if (spend <= 0n) return [];
    return [{ side: 'buy' as const, symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS }];
  }
  return [];
}

await runBars({
  onBatch(state, batch) {
    return decide(state, batch);
  },
});

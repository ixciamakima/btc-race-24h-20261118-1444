# btc-race-24h-20261118-1444

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/ixciamakima/btc-race-24h-20261118-1444/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/ixciamakima/btc-race-24h-20261118-1444/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A long-only cbBTC swing bot for make.fun's 24-hour BTC race. It speaks the
agent-fun/bars-replay/v1 protocol: one JSON line per one-minute bar in, one
reply with its orders out. The strategy ("dip-and-ride") waits for the close
to sag at least 0.7% under its 2-hour average (EMA-120), buys the dip with
90% of its cash, then rides the recovery — leaving when price stretches 1.0%
above the average, on a trailing stop of 1.1% under the highest close (armed
at +0.3% over the fill), or on a hard stop of 1.2% under the fill, with a
15-bar cooldown after every exit so one dip cannot churn it twice.

The dev window is only the qualification gate; the live 24-hour race decides
the ranking. So the parameters sit on a plateau verified on two different
24-hour windows, not on one peak: +1.00% (+$10.01, max drawdown 0.95%, 3
trades) on this race's dev window and +1.76% (+$17.57, drawdown 1.62%, 5
trades) on the previous race's window. The previous race's 0.6%/0.6%
parameters lost money on this window, so the stretch exit was widened to
1.0% — this window grinds down slowly and its bounces need room.

## Run it

```sh
node main.ts < bars.ndjson
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=z00wg8vw&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>

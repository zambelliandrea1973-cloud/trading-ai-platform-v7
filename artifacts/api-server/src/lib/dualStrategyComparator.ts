export type StrategyId = 'AI' | 'BERTO';

export type StrategyTrade = {
  strategy: StrategyId;
  symbol: string;
  openedAt: string;
  closedAt?: string | null;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice?: number | null;
  quantity: number;
  fees?: number;
  slippageCost?: number;
  pnl?: number | null;
  pnlPct?: number | null;
};

export type StrategyPerformance = {
  strategy: StrategyId;
  startingCapital: number;
  equity: number;
  netPnl: number;
  returnPct: number;
  closedTrades: number;
  winRatePct: number;
  profitFactor: number | null;
  expectancy: number | null;
  maxDrawdownPct: number;
  avgWin: number | null;
  avgLoss: number | null;
};

export type StrategyComparison = {
  ai: StrategyPerformance;
  berto: StrategyPerformance;
  leaderByReturn: StrategyId | 'TIE';
  lowerDrawdown: StrategyId | 'TIE';
  note: string;
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const round = (value: number, digits = 2) => Number(value.toFixed(digits));

export function calculateStrategyPerformance(strategy: StrategyId, startingCapital: number, trades: StrategyTrade[], maxDrawdownPct = 0): StrategyPerformance {
  const closed = trades.filter((trade) => trade.strategy === strategy && finite(trade.pnl));
  const wins = closed.filter((trade) => (trade.pnl ?? 0) > 0);
  const losses = closed.filter((trade) => (trade.pnl ?? 0) < 0);
  const grossProfit = wins.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0));
  const netPnl = closed.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0);
  const equity = startingCapital + netPnl;
  const winRatePct = closed.length ? wins.length / closed.length * 100 : 0;
  const avgWin = wins.length ? grossProfit / wins.length : null;
  const avgLoss = losses.length ? grossLoss / losses.length : null;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : null;
  const expectancy = closed.length ? netPnl / closed.length : null;

  return {
    strategy,
    startingCapital: round(startingCapital),
    equity: round(equity),
    netPnl: round(netPnl),
    returnPct: startingCapital > 0 ? round(netPnl / startingCapital * 100) : 0,
    closedTrades: closed.length,
    winRatePct: round(winRatePct),
    profitFactor: profitFactor === null ? null : round(profitFactor),
    expectancy: expectancy === null ? null : round(expectancy),
    maxDrawdownPct: round(maxDrawdownPct),
    avgWin: avgWin === null ? null : round(avgWin),
    avgLoss: avgLoss === null ? null : round(avgLoss),
  };
}

export function compareStrategies(ai: StrategyPerformance, berto: StrategyPerformance): StrategyComparison {
  const leaderByReturn: StrategyId | 'TIE' = ai.returnPct === berto.returnPct ? 'TIE' : ai.returnPct > berto.returnPct ? 'AI' : 'BERTO';
  const lowerDrawdown: StrategyId | 'TIE' = ai.maxDrawdownPct === berto.maxDrawdownPct ? 'TIE' : ai.maxDrawdownPct < berto.maxDrawdownPct ? 'AI' : 'BERTO';
  return {
    ai,
    berto,
    leaderByReturn,
    lowerDrawdown,
    note: 'Il confronto deve usare lo stesso feed, lo stesso timestamp di osservazione, costi e slippage coerenti e capitali demo separati.',
  };
}

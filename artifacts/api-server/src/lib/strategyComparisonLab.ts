import { BERTO_RULES } from "./bertoGoldenSetup";

export const COMPARISON_STRATEGIES = [
  "FIVE_BRAINS_STRATEGY",
  "BERTO_GOLDEN_SETUP",
] as const;
export type ComparisonStrategy = (typeof COMPARISON_STRATEGIES)[number];

export interface ComparisonTrade {
  strategy: ComparisonStrategy;
  openedAt: string;
  closedAt: string;
  initialCapital: number;
  netPnl: number;
  riskAmount: number;
  fees: number;
  slippage: number;
}

export interface StrategyMetrics {
  initialCapital: number;
  finalCapital: number;
  netPnl: number;
  netReturnPct: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRatePct: number | null;
  profitFactor: number | null;
  expectancyR: number | null;
  maxDrawdownPct: number;
  totalCosts: number;
}

export interface StrategyComparisonSnapshot {
  mode: "SHADOW";
  executionEnabled: false;
  sharedMarketData: true;
  isolatedPortfolios: true;
  decisionCrossInfluence: false;
  initialCapital: number;
  period: { from?: string; to?: string };
  strategies: Record<ComparisonStrategy, StrategyMetrics>;
  bertoRules: typeof BERTO_RULES;
  verdict: "INSUFFICIENT_DATA";
  minimumClosedTradesForReview: number;
}

export function buildComparisonSnapshot(
  initialCapital: number,
  trades: ComparisonTrade[] = [],
  period: { from?: string; to?: string } = {},
): StrategyComparisonSnapshot {
  if (!Number.isFinite(initialCapital) || initialCapital <= 0) {
    throw new Error("Initial capital must be a positive finite number.");
  }
  const strategies = Object.fromEntries(
    COMPARISON_STRATEGIES.map((strategy) => [
      strategy,
      calculateMetrics(initialCapital, trades.filter((trade) => trade.strategy === strategy)),
    ]),
  ) as Record<ComparisonStrategy, StrategyMetrics>;

  return {
    mode: "SHADOW",
    executionEnabled: false,
    sharedMarketData: true,
    isolatedPortfolios: true,
    decisionCrossInfluence: false,
    initialCapital,
    period,
    strategies,
    bertoRules: BERTO_RULES,
    verdict: "INSUFFICIENT_DATA",
    minimumClosedTradesForReview: 100,
  };
}

export function calculateMetrics(
  initialCapital: number,
  trades: ComparisonTrade[],
): StrategyMetrics {
  let equity = initialCapital;
  let peak = initialCapital;
  let maxDrawdownPct = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalR = 0;
  let validRCount = 0;
  let wins = 0;
  let losses = 0;
  let totalCosts = 0;

  for (const trade of [...trades].sort((a, b) => Date.parse(a.closedAt) - Date.parse(b.closedAt))) {
    assertTrade(trade);
    equity += trade.netPnl;
    peak = Math.max(peak, equity);
    maxDrawdownPct = Math.max(maxDrawdownPct, peak > 0 ? ((peak - equity) / peak) * 100 : 100);
    if (trade.netPnl > 0) {
      wins += 1;
      grossProfit += trade.netPnl;
    } else if (trade.netPnl < 0) {
      losses += 1;
      grossLoss += Math.abs(trade.netPnl);
    }
    if (trade.riskAmount > 0) {
      totalR += trade.netPnl / trade.riskAmount;
      validRCount += 1;
    }
    totalCosts += trade.fees + trade.slippage;
  }

  const closedTrades = trades.length;
  const netPnl = equity - initialCapital;
  return {
    initialCapital,
    finalCapital: round(equity),
    netPnl: round(netPnl),
    netReturnPct: round((netPnl / initialCapital) * 100),
    closedTrades,
    wins,
    losses,
    winRatePct: closedTrades ? round((wins / closedTrades) * 100) : null,
    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss) : null,
    expectancyR: validRCount ? round(totalR / validRCount) : null,
    maxDrawdownPct: round(maxDrawdownPct),
    totalCosts: round(totalCosts),
  };
}

function assertTrade(trade: ComparisonTrade): void {
  for (const [key, value] of Object.entries({
    initialCapital: trade.initialCapital,
    netPnl: trade.netPnl,
    riskAmount: trade.riskAmount,
    fees: trade.fees,
    slippage: trade.slippage,
  })) {
    if (!Number.isFinite(value)) throw new Error(`Trade ${key} must be finite.`);
  }
  if (!COMPARISON_STRATEGIES.includes(trade.strategy)) {
    throw new Error("Unknown comparison strategy.");
  }
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

export const EMPTY_COMPARISON = buildComparisonSnapshot(5_000);

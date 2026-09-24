import { and, asc, eq } from "drizzle-orm";
import {
  db,
  strategyComparisonTradesTable,
  type InsertStrategyComparisonTrade,
} from "@workspace/db";
import type {
  ComparisonStrategy,
  ComparisonTrade,
} from "./strategyComparisonLab";

export class StrategyComparisonStore {
  async append(input: InsertStrategyComparisonTrade): Promise<boolean> {
    const rows = await db.insert(strategyComparisonTradesTable)
      .values(input)
      .onConflictDoNothing()
      .returning({ externalTradeId: strategyComparisonTradesTable.externalTradeId });
    return rows.length === 1;
  }

  async list(
    userId: string,
    experimentId = "five-vs-berto-v1",
  ): Promise<ComparisonTrade[]> {
    const rows = await db.select()
      .from(strategyComparisonTradesTable)
      .where(and(
        eq(strategyComparisonTradesTable.userId, userId),
        eq(strategyComparisonTradesTable.experimentId, experimentId),
      ))
      .orderBy(asc(strategyComparisonTradesTable.closedAt));

    return rows.map((row) => ({
      strategy: row.strategy as ComparisonStrategy,
      openedAt: row.openedAt.toISOString(),
      closedAt: row.closedAt.toISOString(),
      initialCapital: numeric(row.initialCapital),
      netPnl: numeric(row.netPnl),
      riskAmount: numeric(row.riskAmount),
      fees: numeric(row.fees),
      slippage: numeric(row.slippage),
    }));
  }
}

function numeric(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Invalid comparison ledger value.");
  return parsed;
}

export const strategyComparisonStore = new StrategyComparisonStore();

import type {
  AccountSnapshot,
  NormalizedPosition,
  NormalizedQuote,
} from "./contract";

export interface ShadowDifference {
  field: string;
  bridgeValue: unknown;
  mcpValue: unknown;
}

export interface ShadowComparison {
  matches: boolean;
  differences: ShadowDifference[];
  comparedAt: string;
  decisionInfluence: false;
}

export function compareQuoteSnapshots(
  bridge: NormalizedQuote[],
  mcp: NormalizedQuote[],
  tolerance = 0.00001,
  now = new Date(),
): ShadowComparison {
  const differences: ShadowDifference[] = [];
  const right = new Map(mcp.map((quote) => [quote.symbol.toUpperCase(), quote]));
  for (const quote of bridge) {
    const candidate = right.get(quote.symbol.toUpperCase());
    if (!candidate) {
      differences.push({
        field: `quotes.${quote.symbol}`,
        bridgeValue: quote,
        mcpValue: undefined,
      });
      continue;
    }
    compareNumber(differences, `quotes.${quote.symbol}.bid`, quote.bid, candidate.bid, tolerance);
    compareNumber(differences, `quotes.${quote.symbol}.ask`, quote.ask, candidate.ask, tolerance);
  }
  return result(differences, now);
}

export function compareAccountSnapshots(
  bridge: AccountSnapshot,
  mcp: AccountSnapshot,
  tolerance = 0.01,
  now = new Date(),
): ShadowComparison {
  const differences: ShadowDifference[] = [];
  for (const field of ["balance", "equity", "margin", "freeMargin"] as const) {
    const left = bridge[field];
    const right = mcp[field];
    if (left === undefined && right === undefined) continue;
    if (left === undefined || right === undefined) {
      differences.push({ field: `account.${field}`, bridgeValue: left, mcpValue: right });
      continue;
    }
    compareNumber(differences, `account.${field}`, left, right, tolerance);
  }
  if (bridge.currency !== mcp.currency) {
    differences.push({
      field: "account.currency",
      bridgeValue: bridge.currency,
      mcpValue: mcp.currency,
    });
  }
  return result(differences, now);
}

export function comparePositionSnapshots(
  bridge: NormalizedPosition[],
  mcp: NormalizedPosition[],
  now = new Date(),
): ShadowComparison {
  const leftIds = bridge.map((position) => position.externalId).sort();
  const rightIds = mcp.map((position) => position.externalId).sort();
  const differences: ShadowDifference[] =
    JSON.stringify(leftIds) === JSON.stringify(rightIds)
      ? []
      : [{ field: "positions.externalIds", bridgeValue: leftIds, mcpValue: rightIds }];
  return result(differences, now);
}

function compareNumber(
  differences: ShadowDifference[],
  field: string,
  bridgeValue: number,
  mcpValue: number,
  tolerance: number,
): void {
  if (Math.abs(bridgeValue - mcpValue) > tolerance) {
    differences.push({ field, bridgeValue, mcpValue });
  }
}

function result(
  differences: ShadowDifference[],
  now: Date,
): ShadowComparison {
  return {
    matches: differences.length === 0,
    differences,
    comparedAt: now.toISOString(),
    decisionInfluence: false,
  };
}

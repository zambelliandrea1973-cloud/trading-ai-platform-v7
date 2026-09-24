export const BERTO_RULES = {
  id: "BERTO_GOLDEN_SETUP",
  version: "1.0.0",
  signalSymbol: "QQQ",
  executionSymbol: "US500",
  timezone: "America/New_York",
  sessionOpen: "09:30",
  entryWindowStart: "10:00",
  forcedExit: "15:55",
  minimumDistancePoints: 20,
  suffixClusterDistance: 10,
  stopLossPoints: 31,
  takeProfitPoints: 89,
  direction: "LONG",
  overnightAllowed: false,
  executionEnabled: false,
  mode: "SHADOW",
  originalRiskPerTradePct: 5,
  normalizedComparisonRiskPct: 0.5,
} as const;

export type BertoSuspensionReason =
  | "QQQ_PREVIOUS_CANDLE_NOT_GREEN"
  | "INVALID_DAILY_PRICES"
  | "NO_VALID_LEVELS";

export interface QqqDailyCandle {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface BertoLevel {
  price: number;
  suffix: number;
  distanceFromOpen: number;
  state: "ARMED";
}

export interface BertoDailyPlan {
  strategyId: typeof BERTO_RULES.id;
  version: typeof BERTO_RULES.version;
  mode: "SHADOW";
  executionEnabled: false;
  decisionInfluence: false;
  active: boolean;
  suspensionReason?: BertoSuspensionReason;
  qqqCandleGreen: boolean;
  rawSuffixes: number[];
  validSuffixes: number[];
  sessionOpen: number;
  levels: BertoLevel[];
  rules: typeof BERTO_RULES;
}

export interface BertoLevelState {
  price: number;
  state: "ARMED" | "INVALIDATED_PRE_WINDOW" | "ENTERED" | "EXPIRED";
  firstTouchedAt?: string;
}

export function createBertoDailyPlan(
  qqq: QqqDailyCandle,
  sp500SessionOpen: number,
  depth = 8,
): BertoDailyPlan {
  assertFinitePositive(sp500SessionOpen, "S&P 500 session open");
  const validPrices = [qqq.open, qqq.high, qqq.low, qqq.close]
    .every((value) => Number.isFinite(value) && value > 0);
  const candleGreen = validPrices && qqq.close > qqq.open;
  const rawSuffixes = validPrices
    ? [centSuffix(qqq.low), centSuffix(qqq.high)]
    : [];

  if (!validPrices || !candleGreen) {
    return {
      ...basePlan(sp500SessionOpen),
      active: false,
      suspensionReason: validPrices
        ? "QQQ_PREVIOUS_CANDLE_NOT_GREEN"
        : "INVALID_DAILY_PRICES",
      qqqCandleGreen: candleGreen,
      rawSuffixes,
      validSuffixes: [],
      levels: [],
    };
  }

  const validSuffixes = declusterSuffixes(rawSuffixes);
  const levels = buildLevels(sp500SessionOpen, validSuffixes, depth);
  return {
    ...basePlan(sp500SessionOpen),
    active: levels.length > 0,
    suspensionReason: levels.length ? undefined : "NO_VALID_LEVELS",
    qqqCandleGreen: true,
    rawSuffixes,
    validSuffixes,
    levels,
  };
}

export function centSuffix(price: number): number {
  assertFinitePositive(price, "QQQ price");
  const cents = Math.round((price + Number.EPSILON) * 100);
  return ((cents % 100) + 100) % 100;
}

export function circularSuffixDistance(left: number, right: number): number {
  const difference = Math.abs(left - right);
  return Math.min(difference, 100 - difference);
}

export function declusterSuffixes(suffixes: number[]): number[] {
  const unique = [...new Set(suffixes.map(normalizeSuffix))].sort((a, b) => a - b);
  if (unique.length <= 1) return unique;
  if (unique.length !== 2) {
    throw new Error("Berto setup requires exactly the Low and High suffixes.");
  }
  return circularSuffixDistance(unique[0], unique[1]) < BERTO_RULES.suffixClusterDistance
    ? [unique[0]]
    : unique;
}

export function buildLevels(
  sessionOpen: number,
  suffixes: number[],
  depth = 8,
): BertoLevel[] {
  assertFinitePositive(sessionOpen, "S&P 500 session open");
  if (!Number.isInteger(depth) || depth < 1 || depth > 50) {
    throw new Error("Level depth must be an integer between 1 and 50.");
  }
  const levels = new Map<number, BertoLevel>();
  for (const rawSuffix of suffixes) {
    const suffix = normalizeSuffix(rawSuffix);
    let level = Math.floor(sessionOpen / 100) * 100 + suffix;
    if (level >= sessionOpen) level -= 100;
    for (let index = 0; index < depth; index += 1, level -= 100) {
      const distanceFromOpen = sessionOpen - level;
      if (distanceFromOpen < BERTO_RULES.minimumDistancePoints) continue;
      levels.set(level, {
        price: level,
        suffix,
        distanceFromOpen: round(distanceFromOpen),
        state: "ARMED",
      });
    }
  }
  return [...levels.values()].sort((a, b) => b.price - a.price);
}

export function evaluateLevelTouch(
  current: BertoLevelState,
  quote: { ask: number; at: string },
): BertoLevelState {
  if (current.state !== "ARMED") return current;
  assertFinitePositive(quote.ask, "Ask");
  const minute = newYorkMinuteOfDay(quote.at);
  const open = 9 * 60 + 30;
  const entryStart = 10 * 60;
  const exit = 15 * 60 + 55;
  if (minute >= exit) return { ...current, state: "EXPIRED" };
  if (quote.ask > current.price || minute < open) return current;
  if (minute < entryStart) {
    return {
      ...current,
      state: "INVALIDATED_PRE_WINDOW",
      firstTouchedAt: quote.at,
    };
  }
  return { ...current, state: "ENTERED", firstTouchedAt: quote.at };
}

function basePlan(sessionOpen: number) {
  return {
    strategyId: BERTO_RULES.id,
    version: BERTO_RULES.version,
    mode: "SHADOW" as const,
    executionEnabled: false as const,
    decisionInfluence: false as const,
    sessionOpen,
    rules: BERTO_RULES,
  };
}

function normalizeSuffix(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 99) {
    throw new Error("Suffix must be an integer between 0 and 99.");
  }
  return value;
}

function assertFinitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number.`);
  }
}

function newYorkMinuteOfDay(isoTimestamp: string): number {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) throw new Error("Timestamp must be valid ISO-8601.");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BERTO_RULES.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error("Unable to resolve New York session time.");
  }
  return hour * 60 + minute;
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

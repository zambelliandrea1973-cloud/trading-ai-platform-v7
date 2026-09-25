export const BERTO_RULES = {
  id: "BERTO_QQQ_BREAKOUT_RETEST",
  version: "3.0.0",
  signalSymbol: "QQQ",
  executionSymbol: "US500",
  timezone: "Europe/Rome",
  preparationStart: "09:30",
  entryWindowStart: "15:30",
  forcedExit: "21:55",
  timeframe: "1m",
  contracts: 1,
  breakoutPoints: 8,
  stopOffsetPoints: 5,
  takeProfitOffsetPoints: 30,
  suffixClusterDistance: 10,
  overnightAllowed: false,
  executionEnabled: false,
  mode: "SHADOW",
  decisionInfluence: false,
  assumedSpreadPointsPerContract: 0.5,
  normalizedComparisonRiskPct: 0.5,
} as const;

export type BertoDirection = "LONG" | "SHORT" | "NONE";
export type BertoSuspensionReason =
  | "QQQ_PREVIOUS_CANDLE_DOJI"
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
  direction: BertoDirection;
  rawSuffixes: number[];
  validSuffixes: number[];
  sessionOpen: number;
  levels: BertoLevel[];
  rules: typeof BERTO_RULES;
}

export type BertoLevelStatus =
  | "ARMED"
  | "DISCARDED_1530_TOUCH"
  | "DISCARDED_WRONG_APPROACH"
  | "PENDING_STOP"
  | "POSITION_OPEN"
  | "CLOSED_STOP_LOSS"
  | "CLOSED_TAKE_PROFIT"
  | "CLOSED_FORCED"
  | "CANCELLED_2155"
  | "EXPIRED";

export interface BertoLevelState {
  price: number;
  state: BertoLevelStatus;
  firstTouchedAt?: string;
  order?: BertoOrders;
  positionOpenedAt?: string;
  closedAt?: string;
  exitPrice?: number;
  pnlPoints?: number;
}

export interface BertoOrders {
  direction: Exclude<BertoDirection, "NONE">;
  kind: "STOP";
  contracts: 1;
  entryStop: number;
  stopLoss: number;
  takeProfit: number;
}

export function createBertoDailyPlan(
  qqq: QqqDailyCandle,
  sp500SessionOpen: number,
  depth = 3,
): BertoDailyPlan {
  assertFinitePositive(sp500SessionOpen, "S&P 500 session open");
  const validPrices = [qqq.open, qqq.high, qqq.low, qqq.close]
    .every((value) => Number.isFinite(value) && value > 0);
  const direction: BertoDirection = !validPrices
    ? "NONE"
    : qqq.close > qqq.open
      ? "LONG"
      : qqq.close < qqq.open
        ? "SHORT"
        : "NONE";
  const rawSuffixes = validPrices ? [centSuffix(qqq.low), centSuffix(qqq.high)] : [];

  if (!validPrices || direction === "NONE") {
    return {
      ...basePlan(sp500SessionOpen),
      active: false,
      suspensionReason: validPrices ? "QQQ_PREVIOUS_CANDLE_DOJI" : "INVALID_DAILY_PRICES",
      qqqCandleGreen: direction === "LONG",
      direction,
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
    qqqCandleGreen: direction === "LONG",
    direction,
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
  if (unique.length !== 2) throw new Error("Berto setup requires exactly the Low and High suffixes.");
  return circularSuffixDistance(unique[0], unique[1]) < BERTO_RULES.suffixClusterDistance
    ? [unique[0]]
    : unique;
}

export function buildLevels(sessionOpen: number, suffixes: number[], depth = 3): BertoLevel[] {
  assertFinitePositive(sessionOpen, "S&P 500 session open");
  if (!Number.isInteger(depth) || depth < 1 || depth > 50) {
    throw new Error("Level depth must be an integer between 1 and 50.");
  }
  const levels = new Map<number, BertoLevel>();
  const century = Math.floor(sessionOpen / 100) * 100;
  for (const rawSuffix of suffixes) {
    const suffix = normalizeSuffix(rawSuffix);
    for (let offset = -depth; offset <= depth; offset += 1) {
      const level = century + offset * 100 + suffix;
      if (level <= 0) continue;
      levels.set(level, {
        price: level,
        suffix,
        distanceFromOpen: round(Math.abs(sessionOpen - level)),
        state: "ARMED",
      });
    }
  }
  return [...levels.values()].sort((a, b) => a.price - b.price);
}

export function buildBertoOrders(level: number, direction: Exclude<BertoDirection, "NONE">): BertoOrders {
  assertFinitePositive(level, "Berto level");
  if (direction === "LONG") {
    return {
      direction,
      kind: "STOP",
      contracts: 1,
      entryStop: level + BERTO_RULES.breakoutPoints,
      stopLoss: level - BERTO_RULES.stopOffsetPoints,
      takeProfit: level + BERTO_RULES.takeProfitOffsetPoints,
    };
  }
  return {
    direction,
    kind: "STOP",
    contracts: 1,
    entryStop: level - BERTO_RULES.breakoutPoints,
    stopLoss: level + BERTO_RULES.stopOffsetPoints,
    takeProfit: level - BERTO_RULES.takeProfitOffsetPoints,
  };
}

export function evaluateFirstTouch(
  current: BertoLevelState,
  candle: { low: number; high: number; previousClose: number; at: string },
  direction: Exclude<BertoDirection, "NONE">,
): BertoLevelState {
  if (current.state !== "ARMED") return current;
  const minute = romeMinuteOfDay(candle.at);
  const entryStart = 15 * 60 + 30;
  const exit = 21 * 60 + 55;
  if (minute >= exit) return { ...current, state: "EXPIRED" };
  if (minute < entryStart || candle.low > current.price || candle.high < current.price) return current;
  if (minute === entryStart) return { ...current, state: "DISCARDED_1530_TOUCH", firstTouchedAt: candle.at };
  const correctApproach = direction === "LONG"
    ? candle.previousClose < current.price
    : candle.previousClose > current.price;
  if (!correctApproach) return { ...current, state: "DISCARDED_WRONG_APPROACH", firstTouchedAt: candle.at };
  return { ...current, state: "PENDING_STOP", firstTouchedAt: candle.at, order: buildBertoOrders(current.price, direction) };
}

/** A quote alone has no previous candle close, so it cannot authorize a pending order. */
export function evaluateLevelTouch(
  current: BertoLevelState,
  quote: { ask: number; at: string },
): BertoLevelState {
  if (current.state !== "ARMED") return current;
  assertFinitePositive(quote.ask, "Ask");
  const minute = romeMinuteOfDay(quote.at);
  const entryStart = 15 * 60 + 30;
  const exit = 21 * 60 + 55;
  if (minute >= exit) return { ...current, state: "EXPIRED" };
  if (minute < entryStart || quote.ask !== current.price) return current;
  if (minute === entryStart) return { ...current, state: "DISCARDED_1530_TOUCH", firstTouchedAt: quote.at };
  return current;
}

export function fillBertoPending(
  current: BertoLevelState,
  candle: { low: number; high: number; at: string },
): BertoLevelState {
  if (current.state !== "PENDING_STOP" || !current.order || !current.firstTouchedAt) return current;
  if (!isWithinBertoSession(candle.at, current.firstTouchedAt)) return current;
  // One-minute OHLC cannot establish whether a breakout preceded the first touch in the same candle.
  if (Date.parse(candle.at) <= Date.parse(current.firstTouchedAt)) return current;
  const crossed = current.order.direction === "LONG"
    ? candle.high >= current.order.entryStop
    : candle.low <= current.order.entryStop;
  return crossed ? { ...current, state: "POSITION_OPEN", positionOpenedAt: candle.at } : current;
}

export function evaluateBertoPositionExit(
  current: BertoLevelState,
  candle: { low: number; high: number; at: string },
): BertoLevelState {
  if (current.state !== "POSITION_OPEN" || !current.order || !current.positionOpenedAt) return current;
  if (!isWithinBertoSession(candle.at, current.positionOpenedAt)) return current;
  // Do not infer the intraminute path from the entry candle's OHLC.
  if (Date.parse(candle.at) <= Date.parse(current.positionOpenedAt)) return current;
  const { direction, stopLoss, takeProfit } = current.order;
  const stopped = direction === "LONG" ? candle.low <= stopLoss : candle.high >= stopLoss;
  const won = direction === "LONG" ? candle.high >= takeProfit : candle.low <= takeProfit;
  if (!stopped && !won) return current;
  // A candle touching both barriers is conservatively counted as a stop loss.
  return closePosition(current, candle.at, stopped ? stopLoss : takeProfit, stopped ? "CLOSED_STOP_LOSS" : "CLOSED_TAKE_PROFIT");
}

/** Shadow-only end-of-session transition; the caller supplies the observed market price for open positions. */
export function closeBertoSession(levels: BertoLevelState[], at: string, marketPrice: number): BertoLevelState[] {
  assertFinitePositive(marketPrice, "Market close price");
  if (romeMinuteOfDay(at) < 21 * 60 + 55) return levels;
  return levels.map((level) => {
    if (level.state === "ARMED") return { ...level, state: "EXPIRED" };
    if (!level.firstTouchedAt || !sameRomeDate(at, level.firstTouchedAt)) return level;
    if (level.state === "PENDING_STOP") return { ...level, state: "CANCELLED_2155", closedAt: at };
    if (level.state === "POSITION_OPEN") return closePosition(level, at, marketPrice, "CLOSED_FORCED");
    return level;
  });
}

function closePosition(
  current: BertoLevelState,
  at: string,
  exitPrice: number,
  state: "CLOSED_STOP_LOSS" | "CLOSED_TAKE_PROFIT" | "CLOSED_FORCED",
): BertoLevelState {
  if (!current.order) return current;
  const sign = current.order.direction === "LONG" ? 1 : -1;
  return { ...current, state, closedAt: at, exitPrice, pnlPoints: round((exitPrice - current.order.entryStop) * sign) };
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
  if (!Number.isInteger(value) || value < 0 || value > 99) throw new Error("Suffix must be an integer between 0 and 99.");
  return value;
}

function assertFinitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive finite number.`);
}

function isWithinBertoSession(at: string, startedAt?: string): boolean {
  const minute = romeMinuteOfDay(at);
  if (minute < 15 * 60 + 30 || minute >= 21 * 60 + 55) return false;
  // Legacy states without a touch or breakout timestamp cannot prove which session they belong to.
  // Keep their recorded state, but do not create a new fill without a session anchor.
  if (!startedAt) return false;
  return sameRomeDate(at, startedAt);
}

function sameRomeDate(at: string, startedAt: string): boolean {
  const romeDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: BERTO_RULES.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return romeDate.format(new Date(at)) === romeDate.format(new Date(startedAt));
}

function romeMinuteOfDay(isoTimestamp: string): number {
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
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) throw new Error("Unable to resolve Rome session time.");
  return hour * 60 + minute;
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

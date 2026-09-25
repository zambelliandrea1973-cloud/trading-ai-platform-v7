export const BERTO_RULES = {
  id: "BERTO_QQQ_LATEST",
  version: "4.40-rebuild",
  signalSymbol: "QQQ",
  signalSourceUrl: "https://www.investing.com/etfs/powershares-qqqq",
  executionSymbol: "US500",
  marketTimezone: "America/New_York",
  regularOpen: "09:30",
  regularForcedExit: "15:55",
  earlyCloseForcedExit: "12:55",
  timeframe: "1m",
  contracts: 1,
  breakoutPoints: 8,
  stopLossPointsFromEntry: 13,
  takeProfitPointsFromEntry: 22,
  maxLevelDistanceFromOpen: 50,
  maxSpreadPoints: 2,
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
  | "NO_VALID_LEVELS"
  | "US_MARKET_CLOSED";

export interface QqqDailyCandle { open: number; high: number; low: number; close: number; }

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
  | "DISCARDED_OPENING_CANDLE_TOUCH"
  | "DISCARDED_WRONG_APPROACH"
  | "PENDING_STOP"
  | "POSITION_OPEN"
  | "CLOSED_STOP_LOSS"
  | "CLOSED_TAKE_PROFIT"
  | "CLOSED_FORCED"
  | "CANCELLED_SESSION_END"
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

export interface BertoMarketSession {
  tradingDate: string;
  isTradingDay: boolean;
  isEarlyClose: boolean;
  openMinute: number;
  forcedExitMinute: number;
}

export function createBertoDailyPlan(qqq: QqqDailyCandle, sp500SessionOpen: number, depth = 3): BertoDailyPlan {
  assertFinitePositive(sp500SessionOpen, "S&P 500 session open");
  const validPrices = [qqq.open, qqq.high, qqq.low, qqq.close].every((value) => Number.isFinite(value) && value > 0);
  const direction: BertoDirection = !validPrices ? "NONE" : qqq.close > qqq.open ? "LONG" : qqq.close < qqq.open ? "SHORT" : "NONE";
  const rawSuffixes = validPrices ? [centSuffix(qqq.low), centSuffix(qqq.high)] : [];
  if (!validPrices || direction === "NONE") {
    return { ...basePlan(sp500SessionOpen), active: false, suspensionReason: validPrices ? "QQQ_PREVIOUS_CANDLE_DOJI" : "INVALID_DAILY_PRICES", qqqCandleGreen: direction === "LONG", direction, rawSuffixes, validSuffixes: [], levels: [] };
  }
  const validSuffixes = declusterSuffixes(rawSuffixes);
  const levels = buildLevels(sp500SessionOpen, validSuffixes, depth);
  return { ...basePlan(sp500SessionOpen), active: levels.length > 0, suspensionReason: levels.length ? undefined : "NO_VALID_LEVELS", qqqCandleGreen: direction === "LONG", direction, rawSuffixes, validSuffixes, levels };
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
  return circularSuffixDistance(unique[0], unique[1]) < BERTO_RULES.suffixClusterDistance ? [unique[0]] : unique;
}

export function buildLevels(sessionOpen: number, suffixes: number[], depth = 3): BertoLevel[] {
  assertFinitePositive(sessionOpen, "S&P 500 session open");
  if (!Number.isInteger(depth) || depth < 1 || depth > 50) throw new Error("Level depth must be an integer between 1 and 50.");
  const levels = new Map<number, BertoLevel>();
  const century = Math.floor(sessionOpen / 100) * 100;
  for (const rawSuffix of suffixes) {
    const suffix = normalizeSuffix(rawSuffix);
    for (let offset = -depth; offset <= depth; offset += 1) {
      const level = century + offset * 100 + suffix;
      if (level <= 0) continue;
      const distanceFromOpen = round(Math.abs(sessionOpen - level));
      if (distanceFromOpen > BERTO_RULES.maxLevelDistanceFromOpen) continue;
      levels.set(level, { price: level, suffix, distanceFromOpen, state: "ARMED" });
    }
  }
  return [...levels.values()].sort((a, b) => a.price - b.price);
}

export function buildBertoOrders(level: number, direction: Exclude<BertoDirection, "NONE">): BertoOrders {
  assertFinitePositive(level, "Berto level");
  const entryStop = direction === "LONG" ? level + BERTO_RULES.breakoutPoints : level - BERTO_RULES.breakoutPoints;
  return {
    direction,
    kind: "STOP",
    contracts: 1,
    entryStop: round(entryStop),
    stopLoss: round(direction === "LONG" ? entryStop - BERTO_RULES.stopLossPointsFromEntry : entryStop + BERTO_RULES.stopLossPointsFromEntry),
    takeProfit: round(direction === "LONG" ? entryStop + BERTO_RULES.takeProfitPointsFromEntry : entryStop - BERTO_RULES.takeProfitPointsFromEntry),
  };
}

export function getBertoMarketSession(isoTimestamp: string): BertoMarketSession {
  const date = parseIso(isoTimestamp);
  const parts = zonedParts(date, BERTO_RULES.marketTimezone);
  const tradingDate = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  const closed = isUsEquityMarketHoliday(parts.year, parts.month, parts.day) || parts.weekday === 0 || parts.weekday === 6;
  const early = !closed && isUsEquityEarlyClose(parts.year, parts.month, parts.day);
  return { tradingDate, isTradingDay: !closed, isEarlyClose: early, openMinute: 9 * 60 + 30, forcedExitMinute: early ? 12 * 60 + 55 : 15 * 60 + 55 };
}

export function evaluateFirstTouch(current: BertoLevelState, candle: { low: number; high: number; previousClose: number; at: string }, direction: Exclude<BertoDirection, "NONE">): BertoLevelState {
  if (current.state !== "ARMED") return current;
  const session = getBertoMarketSession(candle.at);
  if (!session.isTradingDay) return { ...current, state: "EXPIRED" };
  const minute = newYorkMinuteOfDay(candle.at);
  if (minute >= session.forcedExitMinute) return { ...current, state: "EXPIRED" };
  if (minute < session.openMinute || candle.low > current.price || candle.high < current.price) return current;
  if (minute === session.openMinute) return { ...current, state: "DISCARDED_OPENING_CANDLE_TOUCH", firstTouchedAt: candle.at };
  const correctApproach = direction === "LONG" ? candle.previousClose < current.price : candle.previousClose > current.price;
  if (!correctApproach) return { ...current, state: "DISCARDED_WRONG_APPROACH", firstTouchedAt: candle.at };
  return { ...current, state: "PENDING_STOP", firstTouchedAt: candle.at, order: buildBertoOrders(current.price, direction) };
}

/** Quotes alone cannot authorize a new setup because BERTO requires the previous closed 1m candle to establish approach direction. */
export function evaluateLevelTouch(current: BertoLevelState, quote: { ask: number; at: string }): BertoLevelState {
  if (current.state !== "ARMED") return current;
  assertFinitePositive(quote.ask, "Ask");
  const session = getBertoMarketSession(quote.at);
  if (!session.isTradingDay || newYorkMinuteOfDay(quote.at) >= session.forcedExitMinute) return { ...current, state: "EXPIRED" };
  return current;
}

export function fillBertoPending(current: BertoLevelState, candle: { low: number; high: number; at: string; spreadPoints?: number }): BertoLevelState {
  if (current.state !== "PENDING_STOP" || !current.order || !current.firstTouchedAt) return current;
  if (!isWithinBertoSession(candle.at, current.firstTouchedAt)) return current;
  if (Date.parse(candle.at) <= Date.parse(current.firstTouchedAt)) return current;
  if (candle.spreadPoints !== undefined) {
    if (!Number.isFinite(candle.spreadPoints) || candle.spreadPoints < 0 || candle.spreadPoints > BERTO_RULES.maxSpreadPoints) return current;
  }
  const crossed = current.order.direction === "LONG" ? candle.high >= current.order.entryStop : candle.low <= current.order.entryStop;
  return crossed ? { ...current, state: "POSITION_OPEN", positionOpenedAt: candle.at } : current;
}

export function evaluateBertoPositionExit(current: BertoLevelState, candle: { low: number; high: number; at: string }): BertoLevelState {
  if (current.state !== "POSITION_OPEN" || !current.order || !current.positionOpenedAt) return current;
  if (!isWithinBertoSession(candle.at, current.positionOpenedAt)) return current;
  if (Date.parse(candle.at) <= Date.parse(current.positionOpenedAt)) return current;
  const { direction, stopLoss, takeProfit } = current.order;
  const stopped = direction === "LONG" ? candle.low <= stopLoss : candle.high >= stopLoss;
  const won = direction === "LONG" ? candle.high >= takeProfit : candle.low <= takeProfit;
  if (!stopped && !won) return current;
  return closePosition(current, candle.at, stopped ? stopLoss : takeProfit, stopped ? "CLOSED_STOP_LOSS" : "CLOSED_TAKE_PROFIT");
}

export function closeBertoSession(levels: BertoLevelState[], at: string, marketPrice: number): BertoLevelState[] {
  assertFinitePositive(marketPrice, "Market close price");
  const session = getBertoMarketSession(at);
  if (session.isTradingDay && newYorkMinuteOfDay(at) < session.forcedExitMinute) return levels;
  return levels.map((level) => {
    if (level.state === "ARMED") return { ...level, state: "EXPIRED" };
    if (!level.firstTouchedAt || !sameNewYorkDate(at, level.firstTouchedAt)) return level;
    if (level.state === "PENDING_STOP") return { ...level, state: "CANCELLED_SESSION_END", closedAt: at };
    if (level.state === "POSITION_OPEN") return closePosition(level, at, marketPrice, "CLOSED_FORCED");
    return level;
  });
}

function closePosition(current: BertoLevelState, at: string, exitPrice: number, state: "CLOSED_STOP_LOSS" | "CLOSED_TAKE_PROFIT" | "CLOSED_FORCED"): BertoLevelState {
  if (!current.order) return current;
  const sign = current.order.direction === "LONG" ? 1 : -1;
  return { ...current, state, closedAt: at, exitPrice, pnlPoints: round((exitPrice - current.order.entryStop) * sign) };
}

function basePlan(sessionOpen: number) {
  return { strategyId: BERTO_RULES.id, version: BERTO_RULES.version, mode: "SHADOW" as const, executionEnabled: false as const, decisionInfluence: false as const, sessionOpen, rules: BERTO_RULES };
}

function normalizeSuffix(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 99) throw new Error("Suffix must be an integer between 0 and 99.");
  return value;
}
function assertFinitePositive(value: number, label: string): void { if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive finite number.`); }
function round(value: number): number { return Number(value.toFixed(6)); }
function pad(value: number): string { return String(value).padStart(2, "0"); }
function parseIso(value: string): Date { const date = new Date(value); if (Number.isNaN(date.getTime())) throw new Error("Timestamp must be valid ISO-8601."); return date; }

function newYorkMinuteOfDay(isoTimestamp: string): number {
  const p = zonedParts(parseIso(isoTimestamp), BERTO_RULES.marketTimezone);
  return p.hour * 60 + p.minute;
}
function sameNewYorkDate(left: string, right: string): boolean {
  return getBertoMarketSession(left).tradingDate === getBertoMarketSession(right).tradingDate;
}
function isWithinBertoSession(at: string, startedAt?: string): boolean {
  if (!startedAt) return false;
  const session = getBertoMarketSession(at);
  const minute = newYorkMinuteOfDay(at);
  return session.isTradingDay && minute >= session.openMinute && minute < session.forcedExitMinute && sameNewYorkDate(at, startedAt);
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const weekdayText = parts.find((p) => p.type === "weekday")?.value;
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), weekday: weekdays[weekdayText ?? ""] };
}

function isUsEquityMarketHoliday(year: number, month: number, day: number): boolean {
  const key = `${year}-${pad(month)}-${pad(day)}`;
  const holidays = new Set<string>();
  addObservedFixedHoliday(holidays, year, 1, 1);
  addObservedFixedHoliday(holidays, year, 6, 19);
  addObservedFixedHoliday(holidays, year, 7, 4);
  addObservedFixedHoliday(holidays, year, 12, 25);
  holidays.add(nthWeekday(year, 1, 1, 3));
  holidays.add(nthWeekday(year, 2, 1, 3));
  holidays.add(lastWeekday(year, 5, 1));
  holidays.add(nthWeekday(year, 9, 1, 1));
  holidays.add(nthWeekday(year, 11, 4, 4));
  holidays.add(goodFriday(year));
  return holidays.has(key);
}

function isUsEquityEarlyClose(year: number, month: number, day: number): boolean {
  const key = `${year}-${pad(month)}-${pad(day)}`;
  const thanksgiving = nthWeekday(year, 11, 4, 4);
  const afterThanksgiving = shiftDate(thanksgiving, 1);
  if (key === afterThanksgiving) return true;
  const christmasEve = `${year}-12-24`;
  if (key === christmasEve && weekdayUtc(year, 12, 24) >= 1 && weekdayUtc(year, 12, 24) <= 5 && !isUsEquityMarketHoliday(year, 12, 24)) return true;
  const july4 = weekdayUtc(year, 7, 4);
  if (july4 >= 2 && july4 <= 5 && key === `${year}-07-03`) return true;
  if (july4 === 1 && key === `${year}-07-01`) return true;
  return false;
}

function addObservedFixedHoliday(set: Set<string>, year: number, month: number, day: number): void {
  const weekday = weekdayUtc(year, month, day);
  let observed = `${year}-${pad(month)}-${pad(day)}`;
  if (weekday === 6) observed = dateKey(new Date(Date.UTC(year, month - 1, day - 1)));
  if (weekday === 0) observed = dateKey(new Date(Date.UTC(year, month - 1, day + 1)));
  set.add(observed);
}
function nthWeekday(year: number, month: number, weekday: number, nth: number): string {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const day = 1 + ((weekday - first.getUTCDay() + 7) % 7) + (nth - 1) * 7;
  return `${year}-${pad(month)}-${pad(day)}`;
}
function lastWeekday(year: number, month: number, weekday: number): string {
  const last = new Date(Date.UTC(year, month, 0));
  const day = last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7);
  return `${year}-${pad(month)}-${pad(day)}`;
}
function goodFriday(year: number): string { return shiftDate(easterSunday(year), -2); }
function easterSunday(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}
function shiftDate(key: string, days: number): string { const date = new Date(`${key}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return dateKey(date); }
function dateKey(date: Date): string { return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`; }
function weekdayUtc(year: number, month: number, day: number): number { return new Date(Date.UTC(year, month - 1, day)).getUTCDay(); }

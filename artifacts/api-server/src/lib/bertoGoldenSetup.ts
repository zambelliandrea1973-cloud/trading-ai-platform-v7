export const BERTO_RULES = {
  id: "BERTO_BREAKOUT_QQQ_V450",
  version: "4.50.0",
  signalSymbol: "QQQ",
  signalSourceUrl: "https://www.investing.com/etfs/powershares-qqqq",
  executionSymbol: "US500",
  timezone: "America/New_York",
  sessionOpen: "09:30",
  regularForcedExit: "15:55",
  halfDayForcedExit: "12:55",
  timeframe: "1m",
  breakoutPoints: 8,
  initialStopPoints: 13,
  trailingDistancePoints: 25,
  trailingActivationFromLevelPoints: 20,
  trailingMinimumStepPoints: 0.2,
  suffixClusterDistance: 10,
  maximumDistanceFromOpenPoints: 50,
  maximumPreviousRangePct: 1.3,
  maximumChasePoints: 2,
  maximumSpreadPoints: 2,
  riskPerTradePct: 2,
  prudentStartingRiskPct: 1,
  maximumLots: 50,
  reconnectDelaySeconds: 90,
  qqqDataSource: "INVESTING_COM",
  overnightAllowed: false,
  executionEnabled: false,
  mode: "SHADOW",
  decisionInfluence: false,
} as const;

export type BertoDirection = "LONG" | "SHORT" | "NONE";
export type BertoSessionKind = "REGULAR" | "HALF_DAY" | "CLOSED";
export type BertoSuspensionReason =
  | "MARKET_CLOSED"
  | "QQQ_PREVIOUS_CANDLE_DOJI"
  | "INVALID_DAILY_PRICES"
  | "PREVIOUS_SESSION_RANGE_UNAVAILABLE"
  | "PREVIOUS_SESSION_RANGE_TOO_HIGH"
  | "NO_VALID_LEVELS";
export interface QqqDailyCandle {
  open: number;
  high: number;
  low: number;
  close: number;
}
export interface PreviousUsSession {
  high: number;
  low: number;
  close: number;
  complete: boolean;
}
export interface BertoLevel {
  price: number;
  suffix: number;
  distanceFromOpen: number;
  state: "ARMED";
}
export interface BertoPlanOptions {
  previousSession: PreviousUsSession;
  sessionKind?: BertoSessionKind;
  depth?: number;
}
export interface BertoDailyPlan {
  strategyId: typeof BERTO_RULES.id;
  version: typeof BERTO_RULES.version;
  mode: "SHADOW";
  executionEnabled: false;
  decisionInfluence: false;
  active: boolean;
  suspensionReason?: BertoSuspensionReason;
  direction: BertoDirection;
  rawSuffixes: number[];
  validSuffixes: number[];
  sessionOpen: number;
  sessionKind: BertoSessionKind;
  sessionClose: string;
  previousSessionRangePct?: number;
  levels: BertoLevel[];
  rules: typeof BERTO_RULES;
}
export type BertoLevelStatus =
  | "ARMED"
  | "DISCARDED_OPENING_MINUTE_TOUCH"
  | "DISCARDED_WRONG_APPROACH"
  | "PENDING_BREAKOUT"
  | "DISCARDED_CHASE"
  | "DISCARDED_SPREAD"
  | "POSITION_OPEN"
  | "CLOSED_STOP_LOSS"
  | "CLOSED_FORCED"
  | "CANCELLED_SESSION_END"
  | "EXPIRED";
export interface BertoLevelState {
  price: number;
  state: BertoLevelStatus;
  firstTouchedAt?: string;
  order?: BertoOrders;
  positionOpenedAt?: string;
  currentStop?: number;
  favorableExtreme?: number;
  closedAt?: string;
  exitPrice?: number;
  pnlPoints?: number;
}
export interface BertoOrders {
  direction: Exclude<BertoDirection, "NONE">;
  kind: "STOP";
  entryStop: number;
  stopLoss: number;
  takeProfit: null;
  trailingDistancePoints: number;
  riskPercent: number;
}

export function createBertoDailyPlan(
  qqq: QqqDailyCandle,
  sp500SessionOpen: number,
  options: BertoPlanOptions,
): BertoDailyPlan {
  assertPositive(sp500SessionOpen, "S&P 500 session open");
  const sessionKind = options.sessionKind ?? "REGULAR";
  const sessionClose =
    sessionKind === "HALF_DAY"
      ? BERTO_RULES.halfDayForcedExit
      : BERTO_RULES.regularForcedExit;
  if (sessionKind === "CLOSED")
    return suspended(
      sp500SessionOpen,
      sessionKind,
      sessionClose,
      "MARKET_CLOSED",
    );
  const valid = [qqq.open, qqq.high, qqq.low, qqq.close].every(positive);
  const direction: BertoDirection = !valid
    ? "NONE"
    : qqq.close > qqq.open
      ? "LONG"
      : qqq.close < qqq.open
        ? "SHORT"
        : "NONE";
  const rawSuffixes = valid ? [centSuffix(qqq.low), centSuffix(qqq.high)] : [];
  if (!valid || direction === "NONE")
    return {
      ...base(sp500SessionOpen, sessionKind, sessionClose),
      active: false,
      suspensionReason: valid
        ? "QQQ_PREVIOUS_CANDLE_DOJI"
        : "INVALID_DAILY_PRICES",
      direction,
      rawSuffixes,
      validSuffixes: [],
      levels: [],
    };
  const range = previousRangePct(options.previousSession);
  if (range === undefined)
    return {
      ...base(sp500SessionOpen, sessionKind, sessionClose),
      active: false,
      suspensionReason: "PREVIOUS_SESSION_RANGE_UNAVAILABLE",
      direction,
      rawSuffixes,
      validSuffixes: [],
      levels: [],
    };
  if (range >= BERTO_RULES.maximumPreviousRangePct)
    return {
      ...base(sp500SessionOpen, sessionKind, sessionClose),
      active: false,
      suspensionReason: "PREVIOUS_SESSION_RANGE_TOO_HIGH",
      direction,
      rawSuffixes,
      validSuffixes: [],
      previousSessionRangePct: range,
      levels: [],
    };
  const validSuffixes = declusterSuffixes(rawSuffixes, direction);
  const levels = buildLevels(
    sp500SessionOpen,
    validSuffixes,
    options.depth ?? 10,
  );
  return {
    ...base(sp500SessionOpen, sessionKind, sessionClose),
    active: levels.length > 0,
    suspensionReason: levels.length ? undefined : "NO_VALID_LEVELS",
    direction,
    rawSuffixes,
    validSuffixes,
    previousSessionRangePct: range,
    levels,
  };
}

export function centSuffix(price: number): number {
  assertPositive(price, "QQQ price");
  return ((Math.round((price + Number.EPSILON) * 100) % 100) + 100) % 100;
}
export function circularSuffixDistance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 100 - d);
}
export function declusterSuffixes(
  values: number[],
  direction: Exclude<BertoDirection, "NONE">,
): number[] {
  const suffixes = [...new Set(values.map(normalizeSuffix))].sort(
    (a, b) => a - b,
  );
  if (suffixes.length <= 1) return suffixes;
  if (suffixes.length !== 2)
    throw new Error("Berto setup requires exactly the Low and High suffixes.");
  return circularSuffixDistance(suffixes[0]!, suffixes[1]!) <
    BERTO_RULES.suffixClusterDistance
    ? [direction === "LONG" ? suffixes[0]! : suffixes[1]!]
    : suffixes;
}
export function buildLevels(
  open: number,
  suffixes: number[],
  depth = 10,
): BertoLevel[] {
  assertPositive(open, "S&P 500 session open");
  if (!Number.isInteger(depth) || depth < 1 || depth > 50)
    throw new Error("Level depth must be an integer between 1 and 50.");
  const found = new Map<number, BertoLevel>();
  const century = Math.floor(open / 100) * 100;
  for (const raw of suffixes)
    for (let offset = -depth; offset <= depth; offset++) {
      const suffix = normalizeSuffix(raw);
      const price = century + 100 * offset + suffix;
      const distanceFromOpen = round(Math.abs(open - price));
      if (
        price > 0 &&
        distanceFromOpen <= BERTO_RULES.maximumDistanceFromOpenPoints
      )
        found.set(price, { price, suffix, distanceFromOpen, state: "ARMED" });
    }
  return [...found.values()].sort((a, b) => a.price - b.price);
}
export function buildBertoOrders(
  level: number,
  direction: Exclude<BertoDirection, "NONE">,
): BertoOrders {
  assertPositive(level, "Berto level");
  const sign = direction === "LONG" ? 1 : -1;
  const entryStop = level + sign * BERTO_RULES.breakoutPoints;
  return {
    direction,
    kind: "STOP",
    entryStop,
    stopLoss: entryStop - sign * BERTO_RULES.initialStopPoints,
    takeProfit: null,
    trailingDistancePoints: BERTO_RULES.trailingDistancePoints,
    riskPercent: BERTO_RULES.riskPerTradePct,
  };
}
export function evaluateFirstTouch(
  current: BertoLevelState,
  candle: { low: number; high: number; previousClose: number; at: string },
  direction: Exclude<BertoDirection, "NONE">,
  kind: Exclude<BertoSessionKind, "CLOSED"> = "REGULAR",
): BertoLevelState {
  if (current.state !== "ARMED") return current;
  const minute = nyMinute(candle.at);
  const open = 570;
  if (minute >= endMinute(kind)) return { ...current, state: "EXPIRED" };
  if (
    minute < open ||
    candle.low > current.price ||
    candle.high < current.price
  )
    return current;
  if (minute === open)
    return {
      ...current,
      state: "DISCARDED_OPENING_MINUTE_TOUCH",
      firstTouchedAt: candle.at,
    };
  const correct =
    direction === "LONG"
      ? candle.previousClose < current.price
      : candle.previousClose > current.price;
  if (!correct)
    return {
      ...current,
      state: "DISCARDED_WRONG_APPROACH",
      firstTouchedAt: candle.at,
    };
  return {
    ...current,
    state: "PENDING_BREAKOUT",
    firstTouchedAt: candle.at,
    order: buildBertoOrders(current.price, direction),
  };
}
export function fillBertoPending(
  current: BertoLevelState,
  candle: {
    low: number;
    high: number;
    at: string;
    executionPrice?: number;
    spreadPoints?: number;
  },
  kind: Exclude<BertoSessionKind, "CLOSED"> = "REGULAR",
): BertoLevelState {
  if (
    current.state !== "PENDING_BREAKOUT" ||
    !current.order ||
    !current.firstTouchedAt ||
    !inSession(candle.at, current.firstTouchedAt, kind)
  )
    return current;
  if (Date.parse(candle.at) <= Date.parse(current.firstTouchedAt))
    return current;
  const crossed =
    current.order.direction === "LONG"
      ? candle.high >= current.order.entryStop
      : candle.low <= current.order.entryStop;
  if (!crossed) return current;
  if ((candle.spreadPoints ?? 0) > BERTO_RULES.maximumSpreadPoints)
    return { ...current, state: "DISCARDED_SPREAD" };
  const price = candle.executionPrice ?? current.order.entryStop;
  const chase =
    current.order.direction === "LONG"
      ? price - current.order.entryStop
      : current.order.entryStop - price;
  if (chase > BERTO_RULES.maximumChasePoints)
    return { ...current, state: "DISCARDED_CHASE" };
  return {
    ...current,
    state: "POSITION_OPEN",
    positionOpenedAt: candle.at,
    currentStop: current.order.stopLoss,
    favorableExtreme: price,
  };
}
export function evaluateBertoPositionExit(
  current: BertoLevelState,
  candle: { low: number; high: number; at: string },
  kind: Exclude<BertoSessionKind, "CLOSED"> = "REGULAR",
): BertoLevelState {
  if (
    current.state !== "POSITION_OPEN" ||
    !current.order ||
    !current.positionOpenedAt ||
    current.currentStop === undefined ||
    !inSession(candle.at, current.positionOpenedAt, kind) ||
    Date.parse(candle.at) <= Date.parse(current.positionOpenedAt)
  )
    return current;
  const long = current.order.direction === "LONG";
  const stopped = long
    ? candle.low <= current.currentStop
    : candle.high >= current.currentStop;
  if (stopped)
    return closePosition(
      current,
      candle.at,
      current.currentStop,
      "CLOSED_STOP_LOSS",
    );
  const extreme = long
    ? Math.max(current.favorableExtreme ?? current.order.entryStop, candle.high)
    : Math.min(current.favorableExtreme ?? current.order.entryStop, candle.low);
  const activation =
    current.price +
    (long ? 1 : -1) * BERTO_RULES.trailingActivationFromLevelPoints;
  const activated = long ? extreme > activation : extreme < activation;
  let currentStop = current.currentStop;
  if (activated) {
    const candidate =
      extreme + (long ? -1 : 1) * BERTO_RULES.trailingDistancePoints;
    if (
      long
        ? candidate >= currentStop + BERTO_RULES.trailingMinimumStepPoints
        : candidate <= currentStop - BERTO_RULES.trailingMinimumStepPoints
    )
      currentStop = round(candidate);
  }
  return { ...current, favorableExtreme: extreme, currentStop };
}
export function closeBertoSession(
  levels: BertoLevelState[],
  at: string,
  marketPrice: number,
  kind: Exclude<BertoSessionKind, "CLOSED"> = "REGULAR",
): BertoLevelState[] {
  assertPositive(marketPrice, "Market close price");
  if (nyMinute(at) < endMinute(kind)) return levels;
  return levels.map((level) => {
    if (level.state === "ARMED") return { ...level, state: "EXPIRED" };
    if (!level.firstTouchedAt || !sameNyDate(at, level.firstTouchedAt))
      return level;
    if (level.state === "PENDING_BREAKOUT")
      return { ...level, state: "CANCELLED_SESSION_END", closedAt: at };
    return level.state === "POSITION_OPEN"
      ? closePosition(level, at, marketPrice, "CLOSED_FORCED")
      : level;
  });
}
export function calculateRiskSizedLots(input: {
  balance: number;
  riskPercent?: number;
  riskPerLot: number;
  minimumLot: number;
  lotStep: number;
  brokerMaximumLot: number;
}): number {
  const pct = input.riskPercent ?? BERTO_RULES.riskPerTradePct;
  Object.entries(input)
    .filter(([, v]) => v !== undefined)
    .forEach(([k, v]) => assertPositive(v as number, k));
  assertPositive(pct, "riskPercent");
  const budget = (input.balance * pct) / 100;
  let lots =
    Math.floor(budget / input.riskPerLot / input.lotStep + 1e-9) *
    input.lotStep;
  if (lots < input.minimumLot) {
    if (input.minimumLot * input.riskPerLot > 2 * budget) return 0;
    lots = input.minimumLot;
  }
  lots = Math.min(lots, input.brokerMaximumLot, BERTO_RULES.maximumLots);
  return round(Math.floor(lots / input.lotStep + 1e-9) * input.lotStep);
}

function previousRangePct(s: PreviousUsSession): number | undefined {
  return !s.complete ||
    ![s.high, s.low, s.close].every(positive) ||
    s.high < s.low
    ? undefined
    : round(((s.high - s.low) / s.close) * 100);
}
function base(
  sessionOpen: number,
  sessionKind: BertoSessionKind,
  sessionClose: string,
) {
  return {
    strategyId: BERTO_RULES.id,
    version: BERTO_RULES.version,
    mode: "SHADOW" as const,
    executionEnabled: false as const,
    decisionInfluence: false as const,
    sessionOpen,
    sessionKind,
    sessionClose,
    rules: BERTO_RULES,
  };
}
function suspended(
  open: number,
  kind: BertoSessionKind,
  close: string,
  reason: BertoSuspensionReason,
): BertoDailyPlan {
  return {
    ...base(open, kind, close),
    active: false,
    suspensionReason: reason,
    direction: "NONE",
    rawSuffixes: [],
    validSuffixes: [],
    levels: [],
  };
}
function closePosition(
  current: BertoLevelState,
  at: string,
  exitPrice: number,
  state: "CLOSED_STOP_LOSS" | "CLOSED_FORCED",
): BertoLevelState {
  const sign = current.order?.direction === "LONG" ? 1 : -1;
  return current.order
    ? {
        ...current,
        state,
        closedAt: at,
        exitPrice,
        pnlPoints: round((exitPrice - current.order.entryStop) * sign),
      }
    : current;
}
function normalizeSuffix(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 99)
    throw new Error("Suffix must be an integer between 0 and 99.");
  return n;
}
function positive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}
function assertPositive(n: number, label: string): void {
  if (!positive(n))
    throw new Error(`${label} must be a positive finite number.`);
}
function endMinute(kind: Exclude<BertoSessionKind, "CLOSED">): number {
  return kind === "HALF_DAY" ? 775 : 955;
}
function inSession(
  at: string,
  started: string,
  kind: Exclude<BertoSessionKind, "CLOSED">,
): boolean {
  const m = nyMinute(at);
  return m >= 570 && m < endMinute(kind) && sameNyDate(at, started);
}
function sameNyDate(a: string, b: string): boolean {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: BERTO_RULES.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return f.format(new Date(a)) === f.format(new Date(b));
}
function nyMinute(timestamp: string): number {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime()))
    throw new Error("Timestamp must be valid ISO-8601.");
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: BERTO_RULES.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return (
    Number(p.find((x) => x.type === "hour")?.value) * 60 +
    Number(p.find((x) => x.type === "minute")?.value)
  );
}
function round(n: number): number {
  return Number(n.toFixed(6));
}

export type BertoOperator = 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ' | 'NEQ' | 'CROSSES_ABOVE' | 'CROSSES_BELOW';

export type BertoCondition = {
  field: string;
  operator: BertoOperator;
  value: number | string | boolean;
  previousField?: string;
  note?: string;
};

export type BertoRuleGroup = {
  id: string;
  label: string;
  mode: 'ALL' | 'ANY';
  conditions: BertoCondition[];
};

export type BertoRiskRules = {
  riskPerTradePct?: number;
  stopLossPct?: number;
  takeProfitPct?: number;
  maxOpenPositions?: number;
  maxDailyLossPct?: number;
  maxSpreadMultiple?: number;
};

export type BertoRuleSet = {
  name: 'Berto';
  version: string;
  enabled: boolean;
  assetClasses?: string[];
  symbols?: string[];
  timeframes: string[];
  entryLong: BertoRuleGroup[];
  entryShort: BertoRuleGroup[];
  exit: BertoRuleGroup[];
  filters: BertoRuleGroup[];
  risk: BertoRiskRules;
  notes?: string[];
};

export type BertoMarketContext = {
  symbol: string;
  timeframe: string;
  values: Record<string, number | string | boolean | null | undefined>;
  previousValues?: Record<string, number | string | boolean | null | undefined>;
};

export type BertoDecision = {
  strategy: 'BERTO';
  configured: boolean;
  decision: 'BUY' | 'SELL' | 'WAIT' | 'NO_TRADE';
  matchedGroups: string[];
  failedGroups: string[];
  risk: BertoRiskRules;
  rationale: string;
};

/**
 * BERTO QQQ/ES retest model.
 *
 * The reference level is derived from the PREVIOUS trading day's QQQ data.
 * Runtime ingestion must populate:
 *   qqqReferenceLevel: S&P 500 reference level derived from prior-day QQQ data
 *   currentPrice: current S&P 500 price
 *   previousPrice: previous observed S&P 500 price (optional; context.previousValues may also contain currentPrice)
 *
 * The historical parameters supplied for BERTO are intentionally fixed here:
 * - normal overshoot/retest zone: 4..8 S&P points beyond the QQQ-derived level
 * - transition zone: >8 and <13 points (observe; no automatic retest entry)
 * - breakout regime: 13..15+ points beyond the level; do not treat as ordinary retest
 *
 * These parameters are NOT self-modifying. Future observations are to be logged and
 * evaluated separately; promotion of new parameters into live BERTO requires explicit
 * owner approval.
 */
export const BERTO_QQQ_PARAMETERS = {
  overshootMinPoints: 4,
  overshootMaxPoints: 8,
  breakoutMinPoints: 13,
  breakoutConfirmationPoints: 15,
} as const;

export const EMPTY_BERTO_RULESET: BertoRuleSet = {
  name: 'Berto',
  version: '0.2-qqq-retest',
  enabled: false,
  timeframes: [],
  entryLong: [],
  entryShort: [],
  exit: [],
  filters: [],
  risk: {},
  notes: [
    'Motore BERTO predisposto per la strategia QQQ/S&P 500: livelli QQQ del giorno precedente, overshoot 4-8 punti, breakout da 13-15 punti.',
    'I parametri storici BERTO restano bloccati: i dati futuri vengono monitorati ma non modificano automaticamente la strategia senza approvazione esplicita.',
  ],
};

function numericValue(context: BertoMarketContext, key: string): number | undefined {
  const value = context.values[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Dedicated BERTO QQQ/S&P state machine. Returns null when the required QQQ inputs are absent. */
export function evaluateBertoQqqRetest(context: BertoMarketContext, risk: BertoRiskRules = {}): BertoDecision | null {
  const level = numericValue(context, 'qqqReferenceLevel');
  const price = numericValue(context, 'currentPrice');
  if (level === undefined || price === undefined) return null;

  const delta = price - level;
  const distance = Math.abs(delta);
  const direction = delta >= 0 ? 'ABOVE' : 'BELOW';
  const p = BERTO_QQQ_PARAMETERS;

  if (distance >= p.breakoutMinPoints) {
    return {
      strategy: 'BERTO', configured: true, decision: 'WAIT', matchedGroups: ['qqq-breakout-regime'], failedGroups: [], risk,
      rationale: `BERTO: prezzo ${direction === 'ABOVE' ? 'sopra' : 'sotto'} il livello QQQ di ${distance.toFixed(2)} punti. Da ${p.breakoutMinPoints}-${p.breakoutConfirmationPoints} punti il movimento è trattato come possibile/definito breakout e non come normale overshoot-retest.`,
    };
  }

  if (distance >= p.overshootMinPoints && distance <= p.overshootMaxPoints) {
    return {
      strategy: 'BERTO', configured: true,
      decision: direction === 'ABOVE' ? 'SELL' : 'BUY',
      matchedGroups: ['qqq-overshoot-retest'], failedGroups: [], risk,
      rationale: `BERTO: overshoot di ${distance.toFixed(2)} punti rispetto al livello QQQ del giorno precedente, dentro la fascia storica ${p.overshootMinPoints}-${p.overshootMaxPoints}. Strategia di ritorno/retest del livello attiva.`,
    };
  }

  if (distance > p.overshootMaxPoints && distance < p.breakoutMinPoints) {
    return {
      strategy: 'BERTO', configured: true, decision: 'WAIT', matchedGroups: ['qqq-transition-zone'], failedGroups: [], risk,
      rationale: `BERTO: distanza ${distance.toFixed(2)} punti dal livello QQQ. Zona di transizione oltre l'overshoot tipico ma sotto la soglia breakout: nessun ingresso automatico.`,
    };
  }

  return {
    strategy: 'BERTO', configured: true, decision: 'WAIT', matchedGroups: ['qqq-level-monitoring'], failedGroups: [], risk,
    rationale: `BERTO: distanza ${distance.toFixed(2)} punti dal livello QQQ; attesa dell'overshoot operativo (${p.overshootMinPoints}-${p.overshootMaxPoints} punti).`,
  };
}

function compare(current: unknown, operator: BertoOperator, target: unknown, previous?: unknown) {
  if (operator === 'EQ') return current === target;
  if (operator === 'NEQ') return current !== target;
  if (typeof current !== 'number' || typeof target !== 'number') return false;
  if (operator === 'GT') return current > target;
  if (operator === 'GTE') return current >= target;
  if (operator === 'LT') return current < target;
  if (operator === 'LTE') return current <= target;
  if (typeof previous !== 'number') return false;
  if (operator === 'CROSSES_ABOVE') return previous <= target && current > target;
  if (operator === 'CROSSES_BELOW') return previous >= target && current < target;
  return false;
}

function groupMatches(group: BertoRuleGroup, context: BertoMarketContext) {
  if (!group.conditions.length) return false;
  const outcomes = group.conditions.map((condition) => {
    const current = context.values[condition.field];
    const previousKey = condition.previousField ?? condition.field;
    const previous = context.previousValues?.[previousKey];
    return compare(current, condition.operator, condition.value, previous);
  });
  return group.mode === 'ALL' ? outcomes.every(Boolean) : outcomes.some(Boolean);
}

function groupsMatch(groups: BertoRuleGroup[], context: BertoMarketContext) {
  if (!groups.length) return false;
  return groups.every((group) => groupMatches(group, context));
}

export function evaluateBertoStrategy(context: BertoMarketContext, rules: BertoRuleSet = EMPTY_BERTO_RULESET): BertoDecision {
  // Prefer the dedicated QQQ/S&P model whenever its real-data inputs are available.
  const qqqDecision = evaluateBertoQqqRetest(context, rules.risk);
  if (qqqDecision) return qqqDecision;

  const configured = rules.enabled && (rules.entryLong.length > 0 || rules.entryShort.length > 0);
  if (!configured) {
    return {
      strategy: 'BERTO', configured: false, decision: 'WAIT', matchedGroups: [], failedGroups: [], risk: rules.risk,
      rationale: 'Berto è predisposto ma non contiene ancora dati QQQ reali o regole operative complete.',
    };
  }

  if (rules.symbols?.length && !rules.symbols.includes(context.symbol)) {
    return { strategy: 'BERTO', configured: true, decision: 'NO_TRADE', matchedGroups: [], failedGroups: ['symbol-filter'], risk: rules.risk, rationale: 'Strumento fuori dall’universo operativo di Berto.' };
  }
  if (rules.timeframes.length && !rules.timeframes.includes(context.timeframe)) {
    return { strategy: 'BERTO', configured: true, decision: 'NO_TRADE', matchedGroups: [], failedGroups: ['timeframe-filter'], risk: rules.risk, rationale: 'Timeframe non previsto dalle regole Berto.' };
  }

  const filterOk = rules.filters.length === 0 || groupsMatch(rules.filters, context);
  if (!filterOk) {
    return { strategy: 'BERTO', configured: true, decision: 'WAIT', matchedGroups: [], failedGroups: rules.filters.map((g) => g.id), risk: rules.risk, rationale: 'Filtri Berto non confermati.' };
  }

  const longOk = groupsMatch(rules.entryLong, context);
  const shortOk = groupsMatch(rules.entryShort, context);
  if (longOk === shortOk) {
    return { strategy: 'BERTO', configured: true, decision: 'WAIT', matchedGroups: [], failedGroups: [], risk: rules.risk, rationale: longOk ? 'Conflitto tra regole long e short: nessuna operazione.' : 'Nessun setup Berto completo.' };
  }

  const matched = (longOk ? rules.entryLong : rules.entryShort).map((g) => g.id);
  return {
    strategy: 'BERTO', configured: true, decision: longOk ? 'BUY' : 'SELL', matchedGroups: matched, failedGroups: [], risk: rules.risk,
    rationale: `Setup Berto ${longOk ? 'long' : 'short'} confermato dalle regole configurate.`,
  };
}

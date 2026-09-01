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

export const EMPTY_BERTO_RULESET: BertoRuleSet = {
  name: 'Berto',
  version: '0.1-shell',
  enabled: false,
  timeframes: [],
  entryLong: [],
  entryShort: [],
  exit: [],
  filters: [],
  risk: {},
  notes: ['Scatola pronta: inserire qui le regole di ingaggio fornite dal broker senza alterare il motore AI principale.'],
};

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
  const configured = rules.enabled && (rules.entryLong.length > 0 || rules.entryShort.length > 0);
  if (!configured) {
    return {
      strategy: 'BERTO', configured: false, decision: 'WAIT', matchedGroups: [], failedGroups: [], risk: rules.risk,
      rationale: 'Berto è predisposto ma non contiene ancora le regole operative del broker.',
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

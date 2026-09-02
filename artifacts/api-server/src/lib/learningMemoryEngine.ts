export type DecisionSide = 'BUY' | 'SELL' | 'WAIT' | 'NO_TRADE';
export type LearningSource = 'AI' | 'BERTO' | 'CONSENSUS' | 'DIVERGENCE';
export type ValidationStage = 'RESEARCH' | 'BACKTEST' | 'WALK_FORWARD' | 'PAPER' | 'APPROVED';
export type ApprovalDecision = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONTINUE_TESTING';
export type OutcomeCheckpoint = 'M15' | 'H1' | 'H4' | 'D1' | 'TRADE_CLOSE' | 'CUSTOM';

export type BrainSnapshot = {
  technical?: { score?: number | null; confidence?: number | null };
  macroNews?: { score?: number | null; confidence?: number | null };
  fundamental?: { score?: number | null; confidence?: number | null };
  statistical?: { score?: number | null; confidence?: number | null };
  risk?: { score?: number | null; veto?: boolean | null; sizeMultiplier?: number | null };
  masterDecision: DecisionSide;
  masterScore?: number | null;
  masterConfidence?: number | null;
};

export type BertoSnapshot = {
  configured: boolean;
  version?: string | null;
  decision: DecisionSide;
  confidence?: number | null;
  matchedGroups?: string[];
  parametersVersion?: string | null;
};

export type MarketContextSnapshot = {
  symbol: string;
  assetClass?: string | null;
  timeframe: string;
  observedAt: string;
  horizon?: 'intraday' | 'swing' | 'position' | null;
  marketRegime?: string | null;
  volatilityRegime?: string | null;
  spread?: number | null;
  atr?: number | null;
  eventRisk?: number | null;
  dataSource?: string | null;
  dataHealth?: 'OK' | 'DEGRADED' | 'STALE' | 'INVALID' | null;
  features?: Record<string, number | string | boolean | null>;
};

export type TradeOutcome = {
  checkpoint: OutcomeCheckpoint;
  evaluatedAt: string;
  horizonMinutes?: number | null;
  signalPrice?: number | null;
  marketPrice?: number | null;
  entryPrice?: number | null;
  exitPrice?: number | null;
  pnl?: number | null;
  pnlPct?: number | null;
  mfePct?: number | null;
  maePct?: number | null;
  realized?: boolean;
  tradeClosed?: boolean;
  result?: 'WIN' | 'LOSS' | 'FLAT' | 'NOT_TRADED' | null;
};

export type SharedLearningRecord = {
  id: string;
  context: MarketContextSnapshot;
  ai: BrainSnapshot;
  berto: BertoSnapshot;
  relationship: {
    source: LearningSource;
    agreement: boolean;
    aiDecision: DecisionSide;
    bertoDecision: DecisionSide;
  };
  execution?: {
    executed: boolean;
    executionMode?: 'LIVE' | 'PAPER' | 'SHADOW' | null;
    strategy?: 'AI' | 'BERTO' | 'HYBRID' | null;
    side?: 'BUY' | 'SELL' | null;
    sizeFraction?: number | null;
    blockedByRisk?: boolean;
    reason?: string | null;
  };
  outcomes: TradeOutcome[];
  createdAt: string;
};

export type LearningSegment = {
  symbol?: string;
  assetClass?: string;
  timeframe?: string;
  horizon?: 'intraday' | 'swing' | 'position';
  marketRegime?: string;
  volatilityRegime?: string;
};

export type HumanApproval = {
  decision: ApprovalDecision;
  approvedBy?: 'OWNER' | null;
  decidedAt?: string | null;
  ownerNote?: string | null;
  explanationAcknowledged: boolean;
  evidenceReviewed: boolean;
};

export type WeightProposal = {
  id: string;
  createdAt: string;
  segment: LearningSegment;
  reason: string;
  plainLanguageExplanation: string;
  sampleSize: number;
  observationStart?: string | null;
  observationEnd?: string | null;
  proposedChanges: {
    bertoTrustDelta?: number;
    technicalWeightDelta?: number;
    macroNewsWeightDelta?: number;
    fundamentalWeightDelta?: number;
    statisticalWeightDelta?: number;
  };
  evidence: {
    baselineReturnPct?: number | null;
    candidateReturnPct?: number | null;
    baselineMaxDrawdownPct?: number | null;
    candidateMaxDrawdownPct?: number | null;
    baselineProfitFactor?: number | null;
    candidateProfitFactor?: number | null;
    baselineWinRatePct?: number | null;
    candidateWinRatePct?: number | null;
    baselineExpectancy?: number | null;
    candidateExpectancy?: number | null;
    outOfSampleTrades?: number | null;
    paperTrades?: number | null;
    sourceRefs?: string[];
  };
  stage: ValidationStage;
  humanApproval: HumanApproval;
  approvedForProduction: boolean;
};

export type LearningPolicy = {
  minSampleSize: number;
  minOutOfSampleTrades: number;
  requireWalkForward: boolean;
  requirePaperValidation: boolean;
  requireOwnerApproval: true;
  requireExplainableEvidence: true;
  allowLiveSelfModification: false;
};

export const DEFAULT_LEARNING_POLICY: LearningPolicy = {
  minSampleSize: 300,
  minOutOfSampleTrades: 75,
  requireWalkForward: true,
  requirePaperValidation: true,
  requireOwnerApproval: true,
  requireExplainableEvidence: true,
  allowLiveSelfModification: false,
};

export const STANDARD_OUTCOME_CHECKPOINTS: ReadonlyArray<{ checkpoint: OutcomeCheckpoint; horizonMinutes: number | null }> = [
  { checkpoint: 'M15', horizonMinutes: 15 },
  { checkpoint: 'H1', horizonMinutes: 60 },
  { checkpoint: 'H4', horizonMinutes: 240 },
  { checkpoint: 'D1', horizonMinutes: 1440 },
  { checkpoint: 'TRADE_CLOSE', horizonMinutes: null },
];

function directional(decision: DecisionSide) {
  return decision === 'BUY' || decision === 'SELL';
}

export function classifyRelationship(aiDecision: DecisionSide, bertoDecision: DecisionSide): SharedLearningRecord['relationship'] {
  const agreement = aiDecision === bertoDecision;
  let source: LearningSource = 'DIVERGENCE';

  if (agreement && directional(aiDecision)) source = 'CONSENSUS';
  else if (directional(aiDecision) && !directional(bertoDecision)) source = 'AI';
  else if (directional(bertoDecision) && !directional(aiDecision)) source = 'BERTO';

  return { source, agreement, aiDecision, bertoDecision };
}

export function hasOwnerApproval(proposal: WeightProposal) {
  return proposal.humanApproval.decision === 'APPROVED'
    && proposal.humanApproval.approvedBy === 'OWNER'
    && proposal.humanApproval.explanationAcknowledged
    && proposal.humanApproval.evidenceReviewed;
}

export function canPromoteProposal(proposal: WeightProposal, policy: LearningPolicy = DEFAULT_LEARNING_POLICY) {
  if (proposal.sampleSize < policy.minSampleSize) return false;
  if ((proposal.evidence.outOfSampleTrades ?? 0) < policy.minOutOfSampleTrades) return false;
  if (policy.requireWalkForward && !['WALK_FORWARD', 'PAPER', 'APPROVED'].includes(proposal.stage)) return false;
  if (policy.requirePaperValidation && !['PAPER', 'APPROVED'].includes(proposal.stage)) return false;
  if (policy.requireExplainableEvidence && !proposal.plainLanguageExplanation.trim()) return false;
  if (policy.requireOwnerApproval && !hasOwnerApproval(proposal)) return false;
  return proposal.stage === 'APPROVED' && proposal.approvedForProduction === true;
}

export function approveProposalForProduction(proposal: WeightProposal, ownerNote?: string): WeightProposal {
  return {
    ...proposal,
    stage: 'APPROVED',
    approvedForProduction: true,
    humanApproval: {
      decision: 'APPROVED',
      approvedBy: 'OWNER',
      decidedAt: new Date().toISOString(),
      ownerNote: ownerNote ?? null,
      explanationAcknowledged: true,
      evidenceReviewed: true,
    },
  };
}

export function rejectProposal(proposal: WeightProposal, ownerNote?: string): WeightProposal {
  return {
    ...proposal,
    approvedForProduction: false,
    humanApproval: {
      decision: 'REJECTED',
      approvedBy: 'OWNER',
      decidedAt: new Date().toISOString(),
      ownerNote: ownerNote ?? null,
      explanationAcknowledged: true,
      evidenceReviewed: true,
    },
  };
}

export function continueTestingProposal(proposal: WeightProposal, ownerNote?: string): WeightProposal {
  return {
    ...proposal,
    approvedForProduction: false,
    humanApproval: {
      decision: 'CONTINUE_TESTING',
      approvedBy: 'OWNER',
      decidedAt: new Date().toISOString(),
      ownerNote: ownerNote ?? null,
      explanationAcknowledged: true,
      evidenceReviewed: true,
    },
  };
}

export function createLearningRecord(input: Omit<SharedLearningRecord, 'relationship' | 'createdAt'>): SharedLearningRecord {
  return {
    ...input,
    relationship: classifyRelationship(input.ai.masterDecision, input.berto.decision),
    createdAt: new Date().toISOString(),
  };
}

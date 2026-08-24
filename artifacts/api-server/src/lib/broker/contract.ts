export type BrokerProvider = "axi";
export type BrokerVenue = "mt5";
export type TradingMode = "paper" | "live";

export type BrokerCapability =
  | "quotes"
  | "account"
  | "positions"
  | "orders"
  | "history";

export type BrokerDataEndpoint = "quotes" | "account" | "positions" | "history";

export type BrokerDataReadStatus =
  | "available"
  | "unavailable"
  | "malformed"
  | "error"
  | "unknown";

export type BrokerConnectionStatus =
  | "paper"
  | "disconnected"
  | "connected"
  | "blocked";

export interface NormalizedQuote {
  symbol: string;
  bid: number;
  ask: number;
  timestamp: string;
  spreadPoints?: number;
}

export interface NormalizedPosition {
  externalId: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  openPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  openedAt: string;
}

export interface AccountSnapshot {
  externalAccountId?: string;
  balance: number;
  equity: number;
  margin?: number;
  freeMargin?: number;
  currency: string;
}

export interface NormalizedHistoryEntry {
  externalId: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  openPrice: number;
  closePrice?: number;
  profit?: number;
  currency?: string;
  openedAt: string;
  closedAt?: string;
  status: "open" | "closed" | "cancelled";
}

export interface BrokerOrderRequest {
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
  clientProposalId: string;
}

export interface BrokerAdapter {
  readonly provider: BrokerProvider;
  readonly venue: BrokerVenue;
  readonly mode: TradingMode;
  getStatus(): Promise<BrokerStatus>;
  getQuotes(symbols: string[]): Promise<NormalizedQuote[]>;
  getAccountSnapshot(): Promise<AccountSnapshot>;
  getPositions(): Promise<NormalizedPosition[]>;
  getHistory(from?: string, to?: string): Promise<NormalizedHistoryEntry[]>;
  submitOrder(request: BrokerOrderRequest): Promise<never>;
}

export interface BrokerAuditEvent {
  event: string;
  at: string;
  actor: "system" | "bridge";
  detail?: string;
}

export interface BrokerDatabaseStatus {
  status: "healthy" | "degraded" | "unknown";
  message: string;
}

export interface BrokerDataStatus {
  status: BrokerDataReadStatus;
  lastCheckedAt?: string;
}

export interface BrokerStatus {
  provider: BrokerProvider;
  venue: BrokerVenue;
  mode: TradingMode;
  status: BrokerConnectionStatus;
  connected: boolean;
  executionEnabled: boolean;
  bridgeRequired: boolean;
  capabilities: BrokerCapability[];
  message: string;
  health: "healthy" | "degraded" | "unknown";
  lastHeartbeatAt?: string;
  lastHealthCheckAt?: string;
  bridgeVersion?: string;
  lastError?: string;
  auditTrail: BrokerAuditEvent[];
  database: BrokerDatabaseStatus;
  dataStatus: Record<BrokerDataEndpoint, BrokerDataStatus>;
}

export class BrokerUnavailableError extends Error {
  readonly code = "BRIDGE_NOT_CONFIGURED";

  constructor(message: string) {
    super(message);
    this.name = "BrokerUnavailableError";
  }
}

export class BrokerProtocolError extends Error {
  readonly code = "BRIDGE_PROTOCOL_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "BrokerProtocolError";
  }
}
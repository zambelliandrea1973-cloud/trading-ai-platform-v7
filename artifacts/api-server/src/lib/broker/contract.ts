export type BrokerProvider = "axi";
export type BrokerVenue = "mt5";
export type TradingMode = "paper" | "live";

export type BrokerCapability =
  | "quotes"
  | "account"
  | "positions"
  | "orders"
  | "history";

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
  submitOrder(request: BrokerOrderRequest): Promise<never>;
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
}

export class BrokerUnavailableError extends Error {
  readonly code = "BRIDGE_NOT_CONFIGURED";

  constructor(message: string) {
    super(message);
    this.name = "BrokerUnavailableError";
  }
}
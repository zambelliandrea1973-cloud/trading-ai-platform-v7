import {
  BrokerUnavailableError,
  type AccountSnapshot,
  type BrokerAdapter,
  type BrokerStatus,
  type BrokerOrderRequest,
  type NormalizedPosition,
  type NormalizedQuote,
} from "./contract";

/**
 * Boundary for the future Windows/VPS MT5 bridge.
 *
 * This adapter deliberately has no network or execution fallback. The bridge
 * protocol can be implemented later without coupling the analysis engine to
 * Axi or to a broker SDK.
 */
export class Mt5BridgeAdapter implements BrokerAdapter {
  readonly provider = "axi" as const;
  readonly venue = "mt5" as const;
  readonly mode = "paper" as const;

  async getStatus(): Promise<BrokerStatus> {
    return {
      provider: this.provider,
      venue: this.venue,
      mode: this.mode,
      status: "disconnected",
      connected: false,
      executionEnabled: false,
      bridgeRequired: true,
      capabilities: ["quotes", "account", "positions", "orders", "history"],
      message: "Axi/MT5 bridge is not configured. Paper mode remains active.",
    };
  }

  async getQuotes(_symbols: string[]): Promise<NormalizedQuote[]> {
    throw new BrokerUnavailableError("MT5 quote bridge is not configured.");
  }

  async getAccountSnapshot(): Promise<AccountSnapshot> {
    throw new BrokerUnavailableError("MT5 account bridge is not configured.");
  }

  async getPositions(): Promise<NormalizedPosition[]> {
    throw new BrokerUnavailableError("MT5 position bridge is not configured.");
  }

  async submitOrder(_request: BrokerOrderRequest): Promise<never> {
    throw new BrokerUnavailableError(
      "Order execution is disabled. Configure and validate the MT5 bridge before enabling live trading.",
    );
  }
}

export const mt5BridgeAdapter = new Mt5BridgeAdapter();
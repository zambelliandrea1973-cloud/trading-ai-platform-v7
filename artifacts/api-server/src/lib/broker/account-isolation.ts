export type TradingStrategy = "BERTO" | "FIVE_BRAINS";

export interface TradingAccountIdentity {
  userId: string;
  tradingAccountId: string;
  externalBrokerAccountId?: string;
}

export interface TradingAccountConfiguration extends TradingAccountIdentity {
  strategy: TradingStrategy;
  riskProfileId: string;
  brokerConnectionId: string;
  databaseNamespace: string;
}

export class AccountIsolationError extends Error {
  readonly code = "ACCOUNT_ISOLATION_VIOLATION";
  constructor(message: string) {
    super(message);
    this.name = "AccountIsolationError";
  }
}

export function assertAccountOwnership(authenticatedUserId: string | undefined, account: TradingAccountIdentity): void {
  if (!authenticatedUserId) throw new AccountIsolationError("Authenticated user is required.");
  if (!account.userId || !account.tradingAccountId) throw new AccountIsolationError("Trading account ownership is incomplete.");
  if (authenticatedUserId !== account.userId) throw new AccountIsolationError("Trading account does not belong to authenticated user.");
}

export function personalDataScope(account: TradingAccountIdentity) {
  if (!account.userId || !account.tradingAccountId) throw new AccountIsolationError("Personal database scope is incomplete.");
  return Object.freeze({ userId: account.userId, tradingAccountId: account.tradingAccountId });
}

export function brokerSecretScope(account: TradingAccountConfiguration) {
  assertNonEmpty(account.brokerConnectionId, "brokerConnectionId");
  return Object.freeze({ userId: account.userId, tradingAccountId: account.tradingAccountId, brokerConnectionId: account.brokerConnectionId });
}

export function assertSameExecutionAccount(authenticatedUserId: string | undefined, configuration: TradingAccountConfiguration, requestedTradingAccountId: string): void {
  assertAccountOwnership(authenticatedUserId, configuration);
  if (configuration.tradingAccountId !== requestedTradingAccountId) throw new AccountIsolationError("Execution account mismatch. Order rejected.");
}

function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) throw new AccountIsolationError(`${field} is required.`);
}

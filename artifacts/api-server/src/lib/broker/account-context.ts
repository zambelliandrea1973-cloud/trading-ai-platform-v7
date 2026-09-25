import { getAuth } from "@clerk/express";
import type { Request } from "express";
import { AccountIsolationError } from "./account-isolation";

export interface TradingAccountRequestContext {
  userId: string;
  tradingAccountId: string;
}

/** Identity always comes from Clerk. userId is never accepted from query/body/headers. */
export function getTradingAccountContext(req: Request): TradingAccountRequestContext {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (typeof userId !== "string" || !userId.trim()) {
    throw new AccountIsolationError("Authentication required.");
  }

  const tradingAccountId = req.header("x-trading-account-id")?.trim();
  if (!tradingAccountId) throw new AccountIsolationError("Trading account context required.");
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(tradingAccountId)) throw new AccountIsolationError("Invalid trading account identifier.");

  return Object.freeze({ userId, tradingAccountId });
}

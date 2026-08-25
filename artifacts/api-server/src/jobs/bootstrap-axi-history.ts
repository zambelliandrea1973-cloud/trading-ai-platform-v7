import { db, historicalBarsTable, instrumentUniverseTable, providerInstrumentMappingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CANONICAL_INSTRUMENT_UNIVERSE, AXI_SELECT_ELIGIBILITY_HINTS } from "../lib/instrument-family-catalog";

/**
 * Contract expected from our MT5 bridge once historical market-data support is enabled.
 * This is our internal bridge contract, not a claim about a public Axi REST API.
 */
type BridgeSymbol = {
  symbol: string;
  description?: string;
  assetClass?: string;
  tradeEnabled?: boolean;
};

type BridgeBar = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume?: number;
  realVolume?: number;
  bid?: number;
  ask?: number;
};

const bridgeUrl = process.env.MT5_BRIDGE_URL;
const bridgeApiKey = process.env.MT5_BRIDGE_API_KEY;
const allowedHosts = (process.env.MT5_BRIDGE_ALLOWED_HOSTS ?? "").split(",").map((value) => value.trim()).filter(Boolean);

function config() {
  if (!bridgeUrl || !bridgeApiKey || !allowedHosts.length) {
    throw new Error("MT5_BRIDGE_URL, MT5_BRIDGE_API_KEY and MT5_BRIDGE_ALLOWED_HOSTS are required");
  }
  const url = new URL(bridgeUrl);
  if (url.protocol !== "https:") throw new Error("MT5 bridge must use HTTPS");
  if (!allowedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
    throw new Error("MT5 bridge host is not allowlisted");
  }
  return { url, apiKey: bridgeApiKey };
}

async function bridgeGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const cfg = config();
  const url = new URL(path, cfg.url.toString().endsWith("/") ? cfg.url : new URL(`${cfg.url.toString()}/`));
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { accept: "application/json", authorization: `Bearer ${cfg.apiKey}` },
  });
  if (!response.ok) throw new Error(`MT5 historical bridge request failed: ${response.status} ${url.pathname}`);
  return await response.json() as T;
}

function normalized(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function aliases(canonical: string, preferredProxy?: string) {
  const values = new Set([normalized(canonical)]);
  if (preferredProxy) values.add(normalized(preferredProxy));
  const known: Record<string, string[]> = {
    XAUUSD: ["GOLD", "XAUUSD"],
    XAGUSD: ["SILVER", "XAGUSD"],
    WTI: ["USOIL", "WTI", "WTICOUSD"],
    BRENT: ["UKOIL", "BRENT"],
    NATGAS: ["NATGAS", "NGAS", "NATURALGAS"],
    EURUSD: ["EURUSD"],
    USDJPY: ["USDJPY"],
    GBPUSD: ["GBPUSD"],
    BTCUSD: ["BTCUSD"],
    ETHUSD: ["ETHUSD"],
  };
  for (const alias of known[canonical] ?? []) values.add(normalized(alias));
  return [...values];
}

function allocationEligibility(canonical: string) {
  if (["XAUUSD", "XAGUSD", "BTCUSD", "ETHUSD", "WTI", "BRENT"].includes(canonical)) return true;
  if (["EURUSD", "USDJPY", "GBPUSD"].includes(canonical)) return true;
  return false;
}

async function seedUniverse() {
  for (const item of CANONICAL_INSTRUMENT_UNIVERSE) {
    await db.insert(instrumentUniverseTable).values({
      canonicalSymbol: item.canonicalSymbol,
      family: item.family,
      subfamily: item.subfamily,
      displayName: item.displayName,
      tradable: item.role !== "context",
      comparisonInput: item.role !== "tradable",
      historicalPriority: item.historicalPriority,
      metadata: { preferredProxy: item.preferredProxy ?? null, notes: item.notes ?? null },
    }).onConflictDoNothing();

    await db.insert(providerInstrumentMappingsTable).values({
      canonicalSymbol: item.canonicalSymbol,
      provider: "axi",
      venue: "mt5",
      discoveryStatus: "pending",
      allocationEligible: allocationEligibility(item.canonicalSymbol),
      metadata: { eligibilityPolicy: AXI_SELECT_ELIGIBILITY_HINTS.note },
    }).onConflictDoNothing();
  }
}

async function discoverSymbols() {
  const payload = await bridgeGet<{ symbols: BridgeSymbol[] }>("symbols");
  const providerSymbols = payload.symbols ?? [];
  for (const item of CANONICAL_INSTRUMENT_UNIVERSE) {
    const candidates = aliases(item.canonicalSymbol, item.preferredProxy);
    const match = providerSymbols.find((provider) => candidates.includes(normalized(provider.symbol)));
    await db.update(providerInstrumentMappingsTable)
      .set({
        providerSymbol: match?.symbol ?? null,
        discoveryStatus: match ? "resolved" : "unavailable",
        brokerTradable: Boolean(match?.tradeEnabled),
        lastDiscoveredAt: new Date(),
        metadata: { description: match?.description ?? null, providerAssetClass: match?.assetClass ?? null },
      })
      .where(and(
        eq(providerInstrumentMappingsTable.canonicalSymbol, item.canonicalSymbol),
        eq(providerInstrumentMappingsTable.provider, "axi"),
        eq(providerInstrumentMappingsTable.venue, "mt5"),
      ));
  }
}

async function ingestResolvedHistory(timeframe: string) {
  const mappings = await db.select().from(providerInstrumentMappingsTable)
    .where(and(eq(providerInstrumentMappingsTable.provider, "axi"), eq(providerInstrumentMappingsTable.venue, "mt5")));
  const universe = new Map(CANONICAL_INSTRUMENT_UNIVERSE.map((item) => [item.canonicalSymbol, item]));
  for (const mapping of mappings) {
    if (mapping.discoveryStatus !== "resolved" || !mapping.providerSymbol) continue;
    const item = universe.get(mapping.canonicalSymbol);
    if (!item) continue;
    const payload = await bridgeGet<{ bars: BridgeBar[] }>("market/bars", {
      symbol: mapping.providerSymbol,
      timeframe,
      limit: process.env.AXI_HISTORY_BAR_LIMIT ?? "100000",
    });
    const rows = (payload.bars ?? []).filter((bar) => Number.isFinite(new Date(bar.time).getTime())).map((bar) => ({
      symbol: mapping.canonicalSymbol,
      assetClass: item.family,
      timeframe,
      openedAt: new Date(bar.time),
      open: String(bar.open),
      high: String(bar.high),
      low: String(bar.low),
      close: String(bar.close),
      volume: String(bar.realVolume ?? bar.tickVolume ?? 0),
      bid: bar.bid === undefined ? null : String(bar.bid),
      ask: bar.ask === undefined ? null : String(bar.ask),
      source: "AXI_MT5_BRIDGE",
      adjusted: false,
      metadata: { providerSymbol: mapping.providerSymbol },
    }));
    for (let index = 0; index < rows.length; index += 500) {
      await db.insert(historicalBarsTable).values(rows.slice(index, index + 500)).onConflictDoNothing();
    }
    if (rows.length) {
      await db.update(providerInstrumentMappingsTable).set({
        historyAvailable: true,
        firstHistoryAt: rows.reduce((min, row) => row.openedAt < min ? row.openedAt : min, rows[0].openedAt),
        lastHistoryAt: rows.reduce((max, row) => row.openedAt > max ? row.openedAt : max, rows[0].openedAt),
      }).where(eq(providerInstrumentMappingsTable.id, mapping.id));
    }
    console.log(`[axi-history] ${mapping.canonicalSymbol}/${mapping.providerSymbol}: ${rows.length} ${timeframe} bars`);
  }
}

async function main() {
  await seedUniverse();
  const mode = process.env.AXI_HISTORY_MODE ?? "seed";
  if (mode === "seed") {
    console.log("[axi-history] universe seeded; connect MT5 bridge before discovery/population");
    return;
  }
  await discoverSymbols();
  if (mode === "discover") return;
  const timeframes = (process.env.AXI_HISTORY_TIMEFRAMES ?? "1d,4h,1h,15m").split(",").map((item) => item.trim()).filter(Boolean);
  for (const timeframe of timeframes) await ingestResolvedHistory(timeframe);
}

main().catch((error) => {
  console.error("[axi-history] failed", error);
  process.exitCode = 1;
});

import { db, historicalBarsTable, macroObservationsTable } from "@workspace/db";
import { CORE_FRED_SERIES, CORE_HISTORICAL_PRICES } from "../lib/historical-source-catalog";

const fredApiKey = process.env.FRED_API_KEY;
const alphaVantageApiKey = process.env.ALPHA_VANTAGE_API_KEY;

function required(name: string, value: string | undefined) {
  if (!value) throw new Error(`${name} is required for historical bootstrap`);
  return value;
}

async function fetchJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Historical provider request failed ${response.status}: ${url.hostname}${url.pathname}`);
  return await response.json() as T;
}

async function ingestFredCurrentSeries(seriesId: string) {
  const key = required("FRED_API_KEY", fredApiKey);
  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", key);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("observation_start", "1990-01-01");

  const payload = await fetchJson<{
    observations: Array<{ date: string; value: string; realtime_start: string }>;
  }>(url);

  const rows = payload.observations
    .filter((item) => item.value !== "." && Number.isFinite(Number(item.value)))
    .map((item) => ({
      seriesId,
      observationDate: new Date(`${item.date}T00:00:00Z`),
      value: item.value,
      vintageDate: new Date(`${item.realtime_start}T00:00:00Z`),
      source: "FRED/ALFRED",
      metadata: { ingestionMode: "current_snapshot" },
    }));

  if (!rows.length) return 0;
  await db.insert(macroObservationsTable).values(rows).onConflictDoNothing();
  return rows.length;
}

async function fetchFredVintageDates(seriesId: string) {
  const key = required("FRED_API_KEY", fredApiKey);
  const url = new URL("https://api.stlouisfed.org/fred/series/vintagedates");
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", key);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("limit", "10000");
  const payload = await fetchJson<{ vintage_dates: string[] }>(url);
  return payload.vintage_dates ?? [];
}

async function ingestFredVintage(seriesId: string, vintageDate: string) {
  const key = required("FRED_API_KEY", fredApiKey);
  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", key);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("realtime_start", vintageDate);
  url.searchParams.set("realtime_end", vintageDate);
  url.searchParams.set("observation_start", "1990-01-01");

  const payload = await fetchJson<{ observations: Array<{ date: string; value: string }> }>(url);
  const rows = payload.observations
    .filter((item) => item.value !== "." && Number.isFinite(Number(item.value)))
    .map((item) => ({
      seriesId,
      observationDate: new Date(`${item.date}T00:00:00Z`),
      value: item.value,
      vintageDate: new Date(`${vintageDate}T00:00:00Z`),
      source: "FRED/ALFRED",
      metadata: { ingestionMode: "point_in_time" },
    }));

  if (!rows.length) return 0;
  await db.insert(macroObservationsTable).values(rows).onConflictDoNothing();
  return rows.length;
}

async function ingestFred() {
  for (const definition of CORE_FRED_SERIES) {
    if (!definition.vintageRequired) {
      const count = await ingestFredCurrentSeries(definition.seriesId);
      console.log(`[historical] FRED ${definition.seriesId}: ${count} observations processed`);
      continue;
    }

    const vintages = await fetchFredVintageDates(definition.seriesId);
    // Default bootstrapping caps calls for safety. Set HISTORICAL_ALL_VINTAGES=1
    // in a controlled batch environment to ingest every historical revision.
    const selected = process.env.HISTORICAL_ALL_VINTAGES === "1"
      ? vintages
      : vintages.slice(Math.max(0, vintages.length - 120));
    let processed = 0;
    for (const vintage of selected) processed += await ingestFredVintage(definition.seriesId, vintage);
    console.log(`[historical] ALFRED ${definition.seriesId}: ${selected.length} vintages / ${processed} observations processed`);
  }
}

type AlphaDailyPayload = {
  "Time Series (Daily)"?: Record<string, {
    "1. open": string;
    "2. high": string;
    "3. low": string;
    "4. close": string;
    "5. adjusted close"?: string;
    "6. volume"?: string;
    "5. volume"?: string;
  }>;
  Information?: string;
  Note?: string;
  "Error Message"?: string;
};

async function ingestAlphaVantageDaily(symbol: string, assetClass: string) {
  const key = required("ALPHA_VANTAGE_API_KEY", alphaVantageApiKey);
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "TIME_SERIES_DAILY_ADJUSTED");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("outputsize", "full");
  url.searchParams.set("apikey", key);
  const payload = await fetchJson<AlphaDailyPayload>(url);
  const series = payload["Time Series (Daily)"];
  if (!series) throw new Error(`Alpha Vantage returned no daily series for ${symbol}: ${payload.Information ?? payload.Note ?? payload["Error Message"] ?? "unknown response"}`);

  const rows = Object.entries(series).map(([date, item]) => ({
    symbol,
    assetClass,
    timeframe: "1d",
    openedAt: new Date(`${date}T00:00:00Z`),
    open: item["1. open"],
    high: item["2. high"],
    low: item["3. low"],
    close: item["5. adjusted close"] ?? item["4. close"],
    volume: item["6. volume"] ?? item["5. volume"] ?? null,
    source: "ALPHA_VANTAGE",
    adjusted: Boolean(item["5. adjusted close"]),
    metadata: { rawClose: item["4. close"] },
  }));

  if (!rows.length) return 0;
  // Chunk inserts so a long daily history remains safe for PostgreSQL parameter limits.
  for (let index = 0; index < rows.length; index += 500) {
    await db.insert(historicalBarsTable).values(rows.slice(index, index + 500)).onConflictDoNothing();
  }
  return rows.length;
}

async function ingestPrices() {
  for (const definition of CORE_HISTORICAL_PRICES) {
    const count = await ingestAlphaVantageDaily(definition.symbol, definition.assetClass);
    console.log(`[historical] Alpha Vantage ${definition.symbol}: ${count} daily bars processed`);
  }
}

async function main() {
  const mode = process.env.HISTORICAL_BOOTSTRAP_MODE ?? "all";
  if (mode === "all" || mode === "fred") await ingestFred();
  if (mode === "all" || mode === "prices") await ingestPrices();
  console.log("[historical] bootstrap complete");
}

main().catch((error) => {
  console.error("[historical] bootstrap failed", error);
  process.exitCode = 1;
});

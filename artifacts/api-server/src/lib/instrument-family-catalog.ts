export type InstrumentFamily =
  | "equity"
  | "rates"
  | "fx"
  | "crypto"
  | "metals"
  | "energy"
  | "agriculture"
  | "industrial-commodities"
  | "water";

export type InstrumentDefinition = {
  canonicalSymbol: string;
  displayName: string;
  family: InstrumentFamily;
  subfamily: string;
  role: "tradable" | "context" | "both";
  historicalPriority: "core" | "extended";
  preferredProxy?: string;
  notes?: string;
};

/**
 * Canonical universe used by Historical Intelligence and PAPER selection.
 * Broker-native symbols are resolved at runtime and never hard-coded here.
 */
export const CANONICAL_INSTRUMENT_UNIVERSE: InstrumentDefinition[] = [
  { canonicalSymbol: "SPY", displayName: "S&P 500", family: "equity", subfamily: "us-large-cap", role: "both", historicalPriority: "core" },
  { canonicalSymbol: "QQQ", displayName: "Nasdaq 100", family: "equity", subfamily: "us-growth", role: "both", historicalPriority: "core" },
  { canonicalSymbol: "SOXX", displayName: "Semiconductors", family: "equity", subfamily: "semiconductors", role: "context", historicalPriority: "core" },
  { canonicalSymbol: "TLT", displayName: "US long-duration Treasuries", family: "rates", subfamily: "us-duration", role: "context", historicalPriority: "core" },
  { canonicalSymbol: "EURUSD", displayName: "EUR/USD", family: "fx", subfamily: "major", role: "both", historicalPriority: "core" },
  { canonicalSymbol: "USDJPY", displayName: "USD/JPY", family: "fx", subfamily: "major", role: "both", historicalPriority: "extended" },
  { canonicalSymbol: "GBPUSD", displayName: "GBP/USD", family: "fx", subfamily: "major", role: "both", historicalPriority: "extended" },
  { canonicalSymbol: "BTCUSD", displayName: "Bitcoin / USD", family: "crypto", subfamily: "large-cap", role: "both", historicalPriority: "core" },
  { canonicalSymbol: "ETHUSD", displayName: "Ethereum / USD", family: "crypto", subfamily: "large-cap", role: "both", historicalPriority: "extended" },

  { canonicalSymbol: "XAUUSD", displayName: "Gold", family: "metals", subfamily: "precious", role: "both", historicalPriority: "core", preferredProxy: "GLD" },
  { canonicalSymbol: "XAGUSD", displayName: "Silver", family: "metals", subfamily: "precious", role: "both", historicalPriority: "core", preferredProxy: "SLV" },
  { canonicalSymbol: "COPPER", displayName: "Copper", family: "industrial-commodities", subfamily: "base-metals", role: "both", historicalPriority: "core", preferredProxy: "CPER" },
  { canonicalSymbol: "ALUMINUM", displayName: "Aluminium", family: "industrial-commodities", subfamily: "base-metals", role: "context", historicalPriority: "extended" },

  { canonicalSymbol: "WTI", displayName: "WTI Crude Oil", family: "energy", subfamily: "oil", role: "both", historicalPriority: "core", preferredProxy: "USO" },
  { canonicalSymbol: "BRENT", displayName: "Brent Crude Oil", family: "energy", subfamily: "oil", role: "both", historicalPriority: "core", preferredProxy: "BNO" },
  { canonicalSymbol: "NATGAS", displayName: "Natural Gas", family: "energy", subfamily: "gas", role: "both", historicalPriority: "core", preferredProxy: "UNG" },
  { canonicalSymbol: "GASOLINE", displayName: "Gasoline", family: "energy", subfamily: "refined-products", role: "context", historicalPriority: "extended" },
  { canonicalSymbol: "HEATINGOIL", displayName: "Heating Oil", family: "energy", subfamily: "refined-products", role: "context", historicalPriority: "extended" },

  { canonicalSymbol: "WHEAT", displayName: "Wheat", family: "agriculture", subfamily: "grains", role: "both", historicalPriority: "core", preferredProxy: "WEAT" },
  { canonicalSymbol: "CORN", displayName: "Corn", family: "agriculture", subfamily: "grains", role: "both", historicalPriority: "core", preferredProxy: "CORN" },
  { canonicalSymbol: "SOYBEAN", displayName: "Soybeans", family: "agriculture", subfamily: "oilseeds", role: "both", historicalPriority: "core", preferredProxy: "SOYB" },
  { canonicalSymbol: "COFFEE", displayName: "Coffee", family: "agriculture", subfamily: "softs", role: "both", historicalPriority: "extended", preferredProxy: "JO" },
  { canonicalSymbol: "COCOA", displayName: "Cocoa", family: "agriculture", subfamily: "softs", role: "both", historicalPriority: "extended" },

  { canonicalSymbol: "WATER_INFRA", displayName: "Water Infrastructure", family: "water", subfamily: "infrastructure", role: "both", historicalPriority: "core", preferredProxy: "PHO", notes: "Water exposure is represented via listed funds/companies rather than spot physical water." },
  { canonicalSymbol: "WATER_GLOBAL", displayName: "Global Water Equities", family: "water", subfamily: "global-equities", role: "both", historicalPriority: "extended", preferredProxy: "CGW" },
];

/** Cross-asset features that the three brains should calculate even when the instrument itself is not being traded. */
export const CROSS_ASSET_CONTEXT = {
  inflationPressure: ["WTI", "BRENT", "NATGAS", "WHEAT", "CORN", "SOYBEAN"],
  industrialCycle: ["COPPER", "SOXX", "SPY"],
  defensiveDemand: ["XAUUSD", "TLT"],
  energyStress: ["WTI", "BRENT", "NATGAS", "GASOLINE", "HEATINGOIL"],
  foodStress: ["WHEAT", "CORN", "SOYBEAN", "COFFEE", "COCOA"],
  waterStress: ["WATER_INFRA", "WATER_GLOBAL", "WHEAT", "CORN", "SOYBEAN"],
} as const;

/**
 * Axi Select constraints known from current Axi documentation. This is kept as
 * eligibility metadata only; actual symbol availability must be discovered
 * from the connected MT5 account because symbol names/availability can vary.
 */
export const AXI_SELECT_ELIGIBILITY_HINTS = {
  forex: "all",
  indices: "all",
  commoditiesCopied: ["UK_OIL", "US_OIL"],
  preciousMetalsCopied: ["XAUUSD", "XAGUSD"],
  cryptoCopied: ["BTCUSD", "ETHUSD"],
  note: "Other commodities/futures may be tradable in the Axi Select account but not eligible for copying to the Allocation Account.",
} as const;

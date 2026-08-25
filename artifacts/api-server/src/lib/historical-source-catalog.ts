export type HistoricalPriceSeries = {
  symbol: string;
  assetClass: "equity-index" | "rates" | "commodity" | "sector";
  role: string;
  provider: "alpha-vantage";
};

export type FredSeriesDefinition = {
  seriesId: string;
  role: string;
  frequencyHint: "daily" | "monthly";
  vintageRequired: boolean;
};

/**
 * Initial cross-asset price memory. ETFs are deliberately used as stable,
 * long-history proxies while broker-native symbols are added later.
 */
export const CORE_HISTORICAL_PRICES: HistoricalPriceSeries[] = [
  { symbol: "SPY", assetClass: "equity-index", role: "US large-cap risk / breadth proxy", provider: "alpha-vantage" },
  { symbol: "QQQ", assetClass: "equity-index", role: "Nasdaq / growth proxy", provider: "alpha-vantage" },
  { symbol: "GLD", assetClass: "commodity", role: "gold proxy", provider: "alpha-vantage" },
  { symbol: "TLT", assetClass: "rates", role: "long-duration Treasury proxy", provider: "alpha-vantage" },
  { symbol: "SOXX", assetClass: "sector", role: "semiconductor risk / breadth proxy", provider: "alpha-vantage" },
];

/**
 * FRED/ALFRED macro core. Revised economic series must be stored by vintage so
 * a historical decision never sees a revision that was unavailable at the time.
 */
export const CORE_FRED_SERIES: FredSeriesDefinition[] = [
  { seriesId: "VIXCLS", role: "equity volatility / stress", frequencyHint: "daily", vintageRequired: false },
  { seriesId: "DGS10", role: "US 10Y nominal yield", frequencyHint: "daily", vintageRequired: false },
  { seriesId: "DFII10", role: "US 10Y real yield", frequencyHint: "daily", vintageRequired: false },
  { seriesId: "FEDFUNDS", role: "effective federal funds rate", frequencyHint: "monthly", vintageRequired: true },
  { seriesId: "CPIAUCSL", role: "US CPI index", frequencyHint: "monthly", vintageRequired: true },
  { seriesId: "UNRATE", role: "US unemployment rate", frequencyHint: "monthly", vintageRequired: true },
];

export const HISTORICAL_DATA_POLICY = {
  dailyYearsTarget: 15,
  dailyYearsMinimum: 10,
  intradayYearsTarget: 5,
  intradayYearsMinimum: 2,
  statisticalPatternMinimum: 30,
  statisticalPatternUsable: 100,
  statisticalPatternStrong: 300,
  sameRegimeMinimum: 75,
  episodicMatchesMinimum: 3,
  preferredIndependentMarketRegimes: 4,
} as const;

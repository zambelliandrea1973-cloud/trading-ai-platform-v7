import { Router, type IRouter } from "express";

const router: IRouter = Router();

const opportunities = [
  { symbol: "EUR/USD", signal: "BUY", confidence: 78, risk: "MEDIUM", state: "Valutabile", rationale: "Trend positivo e conferma multi-timeframe; volatilità sopra la media richiede size ridotta." },
  { symbol: "XAU/USD", signal: "WAIT", confidence: 62, risk: "HIGH", state: "Attendere", rationale: "Flussi difensivi presenti, ma il prezzo è esteso e il Risk Brain non conferma l'ingresso." },
  { symbol: "NASDAQ 100", signal: "NO TRADE", confidence: 41, risk: "HIGH", state: "Bloccato", rationale: "Correlazioni instabili e spread di rischio elevato: la protezione ha priorità sul segnale." },
];

const markets = [
  { symbol: "EUR/USD", name: "Euro / Dollaro", assetClass: "Forex", price: 1.0884, change: 0.0031, changePercent: 0.29, sparkline: [1.082, 1.084, 1.083, 1.087, 1.086, 1.088, 1.0884], status: "Open" },
  { symbol: "XAU/USD", name: "Gold", assetClass: "Commodity", price: 2364.2, change: -8.4, changePercent: -0.35, sparkline: [2378, 2373, 2370, 2367, 2369, 2362, 2364], status: "Open" },
  { symbol: "NAS100", name: "Nasdaq 100", assetClass: "Index", price: 19428.6, change: -112.4, changePercent: -0.58, sparkline: [19620, 19580, 19510, 19560, 19480, 19390, 19428], status: "Open" },
  { symbol: "BTC/USD", name: "Bitcoin", assetClass: "Crypto", price: 64120, change: 840, changePercent: 1.33, sparkline: [62500, 63100, 62800, 63700, 63500, 64400, 64120], status: "Open" },
];

router.get("/dashboard", (_req, res) => {
  res.json({
    marketState: "INCERTO",
    marketStateDetail: "I segnali sono misti: il sistema privilegia selettività e protezione del capitale.",
    riskScore: 58,
    riskLabel: "High Risk",
    riskUpdatedAt: new Date().toISOString(),
    paperCapital: 25000,
    equity: 25184.6,
    dailyPnl: 184.6,
    openPositions: 2,
    exposure: 18.4,
    drawdown: 2.1,
    opportunities,
    regime: "UNSTABLE",
    warningLevel: "ELEVATED",
  });
});

router.get("/markets", (_req, res) => res.json(markets));
router.get("/opportunities", (_req, res) => res.json(opportunities));

router.get("/assets/:symbol", (req, res) => {
  const symbol = decodeURIComponent(req.params.symbol).toUpperCase();
  const market = markets.find((item) => item.symbol === symbol);
  if (!market) {
    res.status(404).json({ error: "Asset non trovato" });
    return;
  }
  const opportunity = opportunities.find((item) => item.symbol === symbol);
  res.json({
    symbol: market.symbol,
    name: market.name,
    price: market.price,
    decision: opportunity?.signal ?? "WAIT",
    confidence: opportunity?.confidence ?? 50,
    riskLevel: opportunity?.risk ?? "MEDIUM",
    regime: "TRENDING",
    explanation: opportunity?.rationale ?? "Dati sufficienti per osservare l'asset, ma non per una proposta operativa.",
    technical: { direction: "BUY", score: 76, confidence: 82, rationale: "Struttura rialzista e momentum costruttivo sul timeframe H1." },
    fundamental: { direction: "NEUTRAL", score: 51, confidence: 61, rationale: "Il calendario macro non offre una direzione dominante." },
    risk: { direction: "CAUTION", score: 64, confidence: 67, rationale: "Volatilità e correlazioni richiedono esposizione controllata." },
    indicators: { RSI: 58, MACD: 0.014, ATR: 0.0062, MA20: market.price * 0.997, MA50: market.price * 0.991 },
    invalidation: "La tesi perde validità sotto il minimo della struttura H1.",
  });
});

export default router;
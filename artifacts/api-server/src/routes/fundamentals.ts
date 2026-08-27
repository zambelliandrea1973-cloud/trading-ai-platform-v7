import { Router, type IRouter } from "express";
import { evaluateFundamentals, type FundamentalInput } from "../lib/fundamentalBrain";

const router: IRouter = Router();

const numericFields: Array<keyof FundamentalInput> = [
  "price",
  "epsTtm",
  "epsForward",
  "expectedEpsGrowthPct",
  "revenueGrowthPct",
  "operatingMarginPct",
  "roePct",
  "debtToEquity",
  "sectorPeMedian",
];

function parseInput(body: unknown): { input?: FundamentalInput; error?: string } {
  if (!body || typeof body !== "object") return { error: "Body JSON richiesto." };
  const source = body as Record<string, unknown>;
  if (typeof source.price !== "number" || !Number.isFinite(source.price) || source.price <= 0) {
    return { error: "price deve essere un numero positivo." };
  }

  for (const field of numericFields) {
    const value = source[field];
    if (value !== undefined && value !== null && (typeof value !== "number" || !Number.isFinite(value))) {
      return { error: `${field} deve essere numerico, null oppure omesso.` };
    }
  }

  return { input: source as FundamentalInput };
}

router.get("/fundamentals/schema", (_req, res) => {
  res.json({
    brain: "Fundamental Brain",
    version: 1,
    purpose: "Valutare prezzo, utili, crescita, redditivita e leva prima che il Master Decision Engine combini il segnale con Technical, Macro/News e Risk.",
    inputs: {
      price: { required: true, unit: "currency", description: "Prezzo corrente dell'azione." },
      epsTtm: { required: false, unit: "currency/share", description: "Utile per azione degli ultimi 12 mesi; genera P/E." },
      epsForward: { required: false, unit: "currency/share", description: "EPS atteso; genera Forward P/E." },
      expectedEpsGrowthPct: { required: false, unit: "%", description: "Crescita EPS attesa; con P/E genera PEG." },
      revenueGrowthPct: { required: false, unit: "%", description: "Crescita ricavi." },
      operatingMarginPct: { required: false, unit: "%", description: "Margine operativo." },
      roePct: { required: false, unit: "%", description: "Return on Equity." },
      debtToEquity: { required: false, unit: "ratio", description: "Debito / patrimonio netto." },
      sectorPeMedian: { required: false, unit: "ratio", description: "P/E mediano del settore per confronto relativo." },
    },
    outputs: ["P/E", "Forward P/E", "PEG", "EPS growth", "Revenue growth", "Operating margin", "ROE", "Debt/Equity", "score", "confidence", "direction", "warnings"],
    note: "P/E e PEG non sono verdetti autonomi: il motore riduce la confidenza quando mancano dati o confronto settoriale.",
  });
});

router.post("/fundamentals/evaluate", (req, res) => {
  const parsed = parseInput(req.body);
  if (!parsed.input) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  res.json({
    brain: "FUNDAMENTAL",
    generatedAt: new Date().toISOString(),
    input: parsed.input,
    result: evaluateFundamentals(parsed.input),
  });
});

export default router;

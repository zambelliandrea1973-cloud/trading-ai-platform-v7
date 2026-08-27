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

type Horizon = "short" | "medium" | "long";
type Sentiment = "supportive" | "mixed" | "adverse";
type Locale = "it" | "en";
export type NewsVerificationStatus = "confirmed" | "contradicted" | "duplicate" | "standalone";

export type NewsItem = {
  id: string;
  publishedAt: string;
  source: string;
  sourceId: string;
  canonicalUrl: string;
  title: string;
  summary: string;
  symbols: string[];
  theme: string;
  horizon: Horizon;
  sentiment: Sentiment;
  relevance: number;
  analysis: string;
  verification: {
    status: NewsVerificationStatus;
    relatedItemIds: string[];
    sourceCount: number;
  };
};

export type NewsSource = {
  id: string;
  label: string;
  homepageUrl: string;
  status: "live" | "degraded";
  kind: "live" | "curated";
  itemCount: number;
  lastCheckedAt: string;
};

export type NewsConflict = {
  id: string;
  theme: string;
  itemIds: string[];
  sources: string[];
  description: string;
};

export type NewsDuplicate = {
  id: string;
  canonicalUrl: string;
  itemIds: string[];
  sources: string[];
};

type HistoricalPrecedent = {
  event: string;
  date: string;
  matchScore: number;
  trigger: string;
  takeaway: string;
  caveat: string;
  outcomes: Array<{
    horizon: Horizon;
    medianReturn: number;
    positiveRate: number;
    sampleSize: number;
  }>;
};

const newsSeeds: Array<Omit<NewsItem, "id" | "publishedAt" | "sourceId" | "canonicalUrl" | "verification"> & { minutesAgo: number }> = [
  {
    minutesAgo: 11,
    source: "Vector market desk",
    title: "I verbali Fed mantengono il percorso dipendente dai dati",
    summary: "I commenti recenti lasciano aperta la sensibilità dei tassi ai prossimi dati macro.",
    symbols: ["SPY", "QQQ", "TLT", "EUR/USD"],
    theme: "Macro / Tassi",
    horizon: "medium",
    sentiment: "mixed",
    relevance: 89,
    analysis: "Può sostenere la duration solo se l'inflazione rallenta; nel frattempo aumenta il rischio di reazioni a sorpresa.",
  },
  {
    minutesAgo: 47,
    source: "Vector market desk",
    title: "L'ampiezza dei semiconduttori migliora in apertura",
    summary: "La leadership azionaria si amplia, ma resta concentrata in un gruppo ristretto di titoli.",
    symbols: ["QQQ", "SPY"],
    theme: "Azionario",
    horizon: "short",
    sentiment: "supportive",
    relevance: 82,
    analysis: "La partecipazione più ampia è una conferma di breve, non ancora una prova di trend durevole.",
  },
  {
    minutesAgo: 92,
    source: "Vector market desk",
    title: "Il dollaro prende fiato dopo tre sessioni al rialzo",
    summary: "Il paniere del dollaro si stabilizza mentre il mercato riduce le scommesse su un rialzo dei tassi.",
    symbols: ["EUR/USD", "SPY", "GLD"],
    theme: "FX / Macro",
    horizon: "short",
    sentiment: "supportive",
    relevance: 76,
    analysis: "Un dollaro più calmo rimuove un vento contrario per oro e rischio, ma il segnale resta sensibile ai rendimenti.",
  },
  {
    minutesAgo: 161,
    source: "Vector market desk",
    title: "La liquidità crypto si assottiglia e la volatilità aumenta",
    summary: "Gli scambi più sottili amplificano i movimenti intraday e rendono meno affidabili i breakout.",
    symbols: ["BTC/USD"],
    theme: "Crypto",
    horizon: "short",
    sentiment: "adverse",
    relevance: 91,
    analysis: "Il contesto favorisce size più piccole e invalidazioni ravvicinate; non conferma da solo una direzione.",
  },
  {
    minutesAgo: 238,
    source: "Vector market desk",
    title: "La domanda difensiva sostiene l'oro mentre i rendimenti reali arretrano",
    summary: "Gli acquisti difensivi e il calo dei rendimenti reali offrono un supporto fondamentale al metallo.",
    symbols: ["GLD", "XAU/USD"],
    theme: "Materie prime",
    horizon: "long",
    sentiment: "supportive",
    relevance: 84,
    analysis: "Il precedente è coerente con un supporto di medio-lungo termine, ma non esclude prese di profitto nel breve.",
  },
];

const englishSeedText: Record<string, Pick<NewsItem, "title" | "summary" | "analysis">> = {
  "I verbali Fed mantengono il percorso dipendente dai dati": {
    title: "Fed minutes keep the path data-dependent",
    summary: "Recent comments leave rates sensitive to the next macro releases.",
    analysis: "This can support duration only if inflation cools; until then, surprise reactions remain a risk.",
  },
  "L'ampiezza dei semiconduttori migliora in apertura": {
    title: "Semiconductor breadth improves at the open",
    summary: "Equity leadership is broadening, but remains concentrated in a narrow group of names.",
    analysis: "Broader participation confirms the short term, not yet a durable trend.",
  },
  "Il dollaro prende fiato dopo tre sessioni al rialzo": {
    title: "Dollar pauses after three rising sessions",
    summary: "The dollar basket steadies as the market reduces rate-hike expectations.",
    analysis: "A calmer dollar removes a headwind for gold and risk, but the signal remains yield-sensitive.",
  },
  "La liquidità crypto si assottiglia e la volatilità aumenta": {
    title: "Crypto liquidity thins as volatility rises",
    summary: "Thinner trading amplifies intraday moves and makes breakouts less reliable.",
    analysis: "This favors smaller sizing and tight invalidations; it does not confirm a direction by itself.",
  },
  "La domanda difensiva sostiene l'oro mentre i rendimenti reali arretrano": {
    title: "Defensive demand supports gold as real yields ease",
    summary: "Defensive buying and lower real yields offer fundamental support to the metal.",
    analysis: "The precedent supports a medium-to-long-term tailwind, but does not rule out short-term profit taking.",
  },
};

export type NewsSourceConfig = {
  id: string;
  label: string;
  homepageUrl: string;
  url: string;
  citationHosts: string[];
};

const newsSourceConfigs: NewsSourceConfig[] = [
  {
    id: "bbc-business",
    label: "BBC Business",
    homepageUrl: "https://www.bbc.com/news/business",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    citationHosts: ["bbc.com", "bbc.co.uk"],
  },
  {
    id: "cnbc-markets",
    label: "CNBC Markets",
    homepageUrl: "https://www.cnbc.com/markets/",
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    citationHosts: ["cnbc.com"],
  },
];

type NewsSnapshot = {
  items: NewsItem[];
  updatedAt: string;
  sourceStatus: "live" | "partial" | "degraded";
  sourceLabel: string;
  sources: NewsSource[];
  sourceCoverage: {
    expected: number;
    available: number;
  };
  conflicts: NewsConflict[];
  duplicates: NewsDuplicate[];
};

const cachedNewsSnapshots: Partial<Record<Locale, { expiresAt: number; value: NewsSnapshot }>> = {};

function textFromXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function xmlValue(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? textFromXml(match[1]) : "";
}

function classifyLiveHeadline(title: string, summary: string, locale: Locale) {
  const text = `${title} ${summary}`.toLowerCase();
  const symbols = new Set<string>();
  if (/bitcoin|crypto|token|digital asset/.test(text)) symbols.add("BTC/USD");
  if (/\bgold\b|precious metal|bullion/.test(text)) symbols.add("XAU/USD");
  if (/(euro.{0,40}dollar|dollar.{0,40}euro|eur\/usd|forex)/.test(text)) symbols.add("EUR/USD");
  if (/nasdaq|semiconductor|technology stocks|tech shares/.test(text)) symbols.add("NAS100");
  if (symbols.size === 0) return undefined;

  const adverse = /fall|drop|weak|risk|sell|loss|decline|volatil/.test(text);
  const supportive = /rise|gain|strong|support|improv|growth|rally/.test(text);
  return {
    symbols: [...symbols],
    theme: symbols.has("BTC/USD") ? "Crypto" : symbols.has("XAU/USD") ? "Materie prime" : symbols.has("EUR/USD") ? "FX / Macro" : "Azionario",
    horizon: (/rate|yield|inflation|fed|ecb|central bank/.test(text) ? "medium" : "short") as Horizon,
    sentiment: (adverse && !supportive ? "adverse" : supportive && !adverse ? "supportive" : "mixed") as Sentiment,
    relevance: Math.min(94, 68 + symbols.size * 9 + (adverse || supportive ? 7 : 0)),
    analysis: locale === "en"
      ? adverse && !supportive
        ? "This headline raises false-breakout risk: volatility and invalidation should take priority."
        : supportive && !adverse
          ? "Its tone supports the short term, subject to confirmation from price and breadth."
          : "This headline adds context, but cannot confirm direction without the price response."
      : adverse && !supportive
        ? "Il titolo aumenta il rischio di falsi breakout: volatilità e invalidazione devono avere priorità."
        : supportive && !adverse
          ? "Il tono è coerente con un supporto di breve, da confermare con prezzo e breadth."
          : "Il titolo aggiunge contesto, ma non basta a confermare una direzione senza la risposta del prezzo.",
  };
}

export function canonicalUrl(value: string, citationHosts: string[]) {
  try {
    if (!value) return undefined;
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || !citationHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
      return undefined;
    }
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|ref$|source$)/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function headlineTokens(title: string) {
  const stopWords = new Set(["the", "and", "for", "with", "from", "that", "this", "into", "after", "over", "news", "market", "markets", "dei", "del", "della", "con", "per", "che", "una", "sono", "sul", "nelle"]);
  return new Set(title.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((word) => word.length > 2 && !stopWords.has(word)));
}

function similarity(first: Set<string>, second: Set<string>) {
  const shared = [...first].filter((token) => second.has(token)).length;
  const total = new Set([...first, ...second]).size;
  return total ? shared / total : 0;
}

function shareSymbol(first: NewsItem, second: NewsItem) {
  return first.symbols.some((symbol) => second.symbols.includes(symbol));
}

function closeInTime(first: NewsItem, second: NewsItem) {
  return Math.abs(new Date(first.publishedAt).getTime() - new Date(second.publishedAt).getTime()) <= 36 * 60 * 60_000;
}

function sameEvent(first: NewsItem, second: NewsItem) {
  return first.sourceId !== second.sourceId
    && shareSymbol(first, second)
    && closeInTime(first, second)
    && similarity(headlineTokens(first.title), headlineTokens(second.title)) >= 0.5;
}

export function annotateNews(items: NewsItem[]) {
  const verification = new Map<string, NewsItem["verification"]>();
  const conflicts: NewsConflict[] = [];
  const duplicates: NewsDuplicate[] = [];
  const priority: Record<NewsVerificationStatus, number> = {
    standalone: 0,
    confirmed: 1,
    contradicted: 2,
    duplicate: 3,
  };

  for (const item of items) {
    verification.set(item.id, { status: "standalone", relatedItemIds: [], sourceCount: 1 });
  }

  const relate = (item: NewsItem, other: NewsItem, status: NewsVerificationStatus) => {
    const previous = verification.get(item.id)!;
    const relatedItemIds = [...new Set([...previous.relatedItemIds, other.id])];
    const sourceCount = new Set([
      item.sourceId,
      ...relatedItemIds.map((id) => items.find((candidate) => candidate.id === id)?.sourceId),
    ]).size;
    if (priority[status] < priority[previous.status]) {
      verification.set(item.id, { ...previous, relatedItemIds, sourceCount });
      return;
    }
    verification.set(item.id, {
      status,
      relatedItemIds,
      sourceCount,
    });
  };

  for (let index = 0; index < items.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < items.length; otherIndex += 1) {
      const first = items[index];
      const second = items[otherIndex];
      if (!sameEvent(first, second)) continue;

      const titlesMatch = similarity(headlineTokens(first.title), headlineTokens(second.title)) >= 0.75;
      if (first.canonicalUrl === second.canonicalUrl || titlesMatch) {
        duplicates.push({
          id: `duplicate-${duplicates.length + 1}`,
          canonicalUrl: first.canonicalUrl,
          itemIds: [first.id, second.id],
          sources: [first.source, second.source],
        });
        relate(first, second, "duplicate");
        relate(second, first, "duplicate");
      } else if (
        (first.sentiment === "supportive" && second.sentiment === "adverse")
        || (first.sentiment === "adverse" && second.sentiment === "supportive")
      ) {
        conflicts.push({
          id: `conflict-${conflicts.length + 1}`,
          theme: first.theme,
          itemIds: [first.id, second.id],
          sources: [first.source, second.source],
          description: "Le fonti riportano segnali di sentiment opposti sullo stesso evento.",
        });
        relate(first, second, "contradicted");
        relate(second, first, "contradicted");
      } else if (first.sentiment === second.sentiment) {
        relate(first, second, "confirmed");
        relate(second, first, "confirmed");
      }
    }
  }

  return {
    items: items.map((item) => ({ ...item, verification: verification.get(item.id)! })),
    conflicts,
    duplicates,
  };
}

export function snapshotFrom(
  items: NewsItem[],
  sources: NewsSource[],
  locale: Locale,
): NewsSnapshot {
  const annotated = annotateNews(items);
  const available = sources.filter((source) => source.kind === "live" && source.status === "live" && source.itemCount > 0).length;
  const expected = sources.filter((source) => source.kind === "live").length;
  const sourceStatus = available === 0 ? "degraded" : available === expected ? "live" : "partial";
  const liveLabels = sources.filter((source) => source.kind === "live" && source.status === "live" && source.itemCount > 0).map((source) => source.label);
  const sourceLabel = sourceStatus === "degraded"
    ? locale === "en"
      ? "No verified live market items available"
      : "Nessun elemento di mercato live verificabile disponibile"
    : locale === "en"
      ? `${available}/${expected} sources with verifiable market items · ${liveLabels.join(" + ")}`
      : `${available}/${expected} fonti con elementi di mercato verificabili · ${liveLabels.join(" + ")}`;
  return {
    items: annotated.items,
    updatedAt: new Date().toISOString(),
    sourceStatus,
    sourceLabel,
    sources,
    sourceCoverage: { expected, available },
    conflicts: annotated.conflicts,
    duplicates: annotated.duplicates,
  };
}

export async function fetchNewsSource(config: NewsSourceConfig, locale: Locale, fetchImpl: typeof fetch = fetch) {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetchImpl(config.url, { signal: AbortSignal.timeout(2_000) });
    if (!response.ok) throw new Error(`RSS response ${response.status}`);
    const xml = await response.text();
    const now = Date.now();
    const items = (xml.match(/<item[\s\S]*?<\/item>/gi) ?? []).slice(0, 10).flatMap((raw, index) => {
      const title = xmlValue(raw, "title");
      if (!title) return [];
      const summary = xmlValue(raw, "description") || (locale === "en" ? "Summary unavailable from provider." : "Sintesi non disponibile dal provider.");
      const publishedAt = Date.parse(xmlValue(raw, "pubDate"));
      const classified = classifyLiveHeadline(title, summary, locale);
      const itemUrl = canonicalUrl(xmlValue(raw, "link") || xmlValue(raw, "guid"), config.citationHosts);
      if (!classified || !itemUrl || Number.isNaN(publishedAt)) return [];
      return [{
        id: `${config.id}-${index + 1}`,
        publishedAt: new Date(publishedAt).toISOString(),
        source: config.label,
        sourceId: config.id,
        canonicalUrl: itemUrl,
        title,
        summary,
        ...classified,
        verification: { status: "standalone" as const, relatedItemIds: [], sourceCount: 1 },
      }];
    });
    const sourceStatus: NewsSource["status"] = items.length > 0 ? "live" : "degraded";
    return {
      items,
      source: {
        id: config.id,
        label: config.label,
        homepageUrl: config.homepageUrl,
        status: sourceStatus,
        kind: "live" as const,
        itemCount: items.length,
        lastCheckedAt: checkedAt,
      },
    };
  } catch {
    return {
      items: [] as NewsItem[],
      source: {
        id: config.id,
        label: config.label,
        homepageUrl: config.homepageUrl,
        status: "degraded" as const,
        kind: "live" as const,
        itemCount: 0,
        lastCheckedAt: checkedAt,
      },
    };
  }
}

async function getNewsSnapshot(locale: Locale): Promise<NewsSnapshot> {
  const cached = cachedNewsSnapshots[locale];
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const results = await Promise.all(newsSourceConfigs.map((config) => fetchNewsSource(config, locale)));
  const liveItems = results.flatMap((result) => result.items);
  const sources = results.map((result) => result.source);
  const value = snapshotFrom(liveItems, sources, locale);
  cachedNewsSnapshots[locale] = { expiresAt: Date.now() + (liveItems.length ? 120_000 : 30_000), value };
  return value;
}

const historicalBySymbol: Record<string, HistoricalPrecedent[]> = {
  "EUR/USD": [{
    event: "Attese Fed più caute e dollaro in consolidamento",
    date: "2023-11-01",
    matchScore: 79,
    trigger: "Rendimenti USA in calo e pressione sul dollaro in attenuazione",
    takeaway: "L'euro ha trovato supporto quando rendimenti e sorpresa macro hanno smesso di favorire il dollaro.",
    caveat: "Le sorprese su inflazione o banca centrale possono invertire il cambio rapidamente.",
    outcomes: [
      { horizon: "short", medianReturn: 0.6, positiveRate: 62, sampleSize: 13 },
      { horizon: "medium", medianReturn: 1.4, positiveRate: 69, sampleSize: 13 },
      { horizon: "long", medianReturn: 2.1, positiveRate: 62, sampleSize: 13 },
    ],
  }],
  SPY: [{
    event: "Rallentamento dell'inflazione con ampiezza azionaria in miglioramento",
    date: "2023-11-14",
    matchScore: 81,
    trigger: "Dati sui prezzi più morbidi e partecipazione in allargamento",
    takeaway: "Il rischio ha reagito positivamente quando tassi e breadth hanno confermato la stessa direzione.",
    caveat: "Il campione comprende regimi diversi: la correlazione può rompersi se i rendimenti ripartono.",
    outcomes: [
      { horizon: "short", medianReturn: 1.8, positiveRate: 67, sampleSize: 9 },
      { horizon: "medium", medianReturn: 4.6, positiveRate: 71, sampleSize: 9 },
      { horizon: "long", medianReturn: 8.9, positiveRate: 63, sampleSize: 9 },
    ],
  }],
  QQQ: [{
    event: "Leadership tech dopo una sorpresa positiva sui tassi",
    date: "2023-12-13",
    matchScore: 77,
    trigger: "Rendimenti in calo e breadth dei semiconduttori più ampia",
    takeaway: "Il tech ha beneficiato quando momentum e macro hanno smesso di contraddirsi.",
    caveat: "La concentrazione dei mega-cap può rendere il movimento più fragile di quanto sembri.",
    outcomes: [
      { horizon: "short", medianReturn: 2.4, positiveRate: 70, sampleSize: 10 },
      { horizon: "medium", medianReturn: 5.1, positiveRate: 70, sampleSize: 10 },
      { horizon: "long", medianReturn: 10.3, positiveRate: 60, sampleSize: 10 },
    ],
  }],
  GLD: [{
    event: "Domanda difensiva con rendimenti reali in discesa",
    date: "2022-11-10",
    matchScore: 84,
    trigger: "Calo dei rendimenti reali e aumento dell'avversione al rischio",
    takeaway: "L'oro ha spesso trovato supporto quando protezione e costo opportunità si sono mossi insieme.",
    caveat: "Un dollaro forte o un repricing dei tassi può annullare rapidamente il vantaggio.",
    outcomes: [
      { horizon: "short", medianReturn: 1.1, positiveRate: 60, sampleSize: 8 },
      { horizon: "medium", medianReturn: 3.7, positiveRate: 63, sampleSize: 8 },
      { horizon: "long", medianReturn: 7.2, positiveRate: 75, sampleSize: 8 },
    ],
  }],
  TLT: [{
    event: "Decelerazione macro e aspettative di taglio",
    date: "2023-10-27",
    matchScore: 72,
    trigger: "Crescita più lenta e rendimento decennale in arretramento",
    takeaway: "La duration ha reagito bene quando il rallentamento è diventato visibile senza shock inflazionistico.",
    caveat: "La duration resta vulnerabile a sorprese fiscali e inflazione persistente.",
    outcomes: [
      { horizon: "short", medianReturn: 1.5, positiveRate: 56, sampleSize: 7 },
      { horizon: "medium", medianReturn: 3.2, positiveRate: 57, sampleSize: 7 },
      { horizon: "long", medianReturn: 5.4, positiveRate: 57, sampleSize: 7 },
    ],
  }],
  "BTC/USD": [{
    event: "Ripresa crypto dopo una fase di liquidità sottile",
    date: "2023-03-13",
    matchScore: 68,
    trigger: "Volatilità iniziale seguita da ritorno dei flussi",
    takeaway: "I rimbalzi sono stati ampi, ma la direzione è diventata leggibile solo dopo la normalizzazione della liquidità.",
    caveat: "I rendimenti crypto hanno dispersione elevata e non sono direttamente trasferibili al presente.",
    outcomes: [
      { horizon: "short", medianReturn: 3.9, positiveRate: 55, sampleSize: 11 },
      { horizon: "medium", medianReturn: 8.4, positiveRate: 64, sampleSize: 11 },
      { horizon: "long", medianReturn: 19.2, positiveRate: 64, sampleSize: 11 },
    ],
  }],
};

historicalBySymbol["XAU/USD"] = historicalBySymbol.GLD;
historicalBySymbol.NAS100 = historicalBySymbol.QQQ;

const englishHistoricalText: Partial<Record<string, Pick<HistoricalPrecedent, "event" | "trigger" | "takeaway" | "caveat">>> = {
  "EUR/USD": {
    event: "More cautious Fed expectations and a consolidating dollar",
    trigger: "US yields easing and pressure on the dollar moderating",
    takeaway: "The euro found support when yields and macro surprises stopped favoring the dollar.",
    caveat: "Inflation or central-bank surprises can reverse the pair quickly.",
  },
  "XAU/USD": {
    event: "Defensive demand as real yields decline",
    trigger: "Lower real yields and rising risk aversion",
    takeaway: "Gold has often found support when protection demand and opportunity cost moved together.",
    caveat: "A stronger dollar or rate repricing can quickly remove the advantage.",
  },
  NAS100: {
    event: "Technology leadership after a positive rates surprise",
    trigger: "Yields falling and broader semiconductor participation",
    takeaway: "Technology benefited when momentum and macro conditions stopped conflicting.",
    caveat: "Mega-cap concentration can make the move more fragile than it looks.",
  },
  "BTC/USD": {
    event: "Crypto recovery after a thin-liquidity phase",
    trigger: "Initial volatility followed by returning flows",
    takeaway: "Rebounds were broad, but direction became readable only after liquidity normalized.",
    caveat: "Crypto returns are widely dispersed and cannot be transferred directly to the present.",
  },
};

function historicalFor(symbol: string, locale: Locale): HistoricalPrecedent[] {
  const precedents = historicalBySymbol[symbol] ?? historicalBySymbol.SPY;
  const translated = locale === "en" ? englishHistoricalText[symbol] : undefined;
  return translated ? precedents.map((precedent) => ({ ...precedent, ...translated })) : precedents;
}

function localeFrom(value: unknown): Locale {
  return value === "en" ? "en" : "it";
}

function assetContent(locale: Locale, symbol: string) {
  if (locale === "en") {
    return {
      name: symbol === "EUR/USD" ? "Euro / US Dollar" : symbol === "XAU/USD" ? "Gold" : symbol === "BTC/USD" ? "Bitcoin" : "Nasdaq 100",
      explanation: "Positive trend and multi-timeframe confirmation; above-average volatility calls for smaller sizing.",
      technical: "Bullish structure and constructive momentum on the H1 timeframe.",
      fundamental: "The macro calendar does not offer a dominant direction.",
      risk: "Volatility and correlations require controlled exposure.",
      invalidation: "The thesis loses validity below the H1 structure low.",
      thesisSummary: "News and precedents support an observable thesis, not a guaranteed outcome.",
      thesisShort: "In the short term, the signal remains valid only if price and news keep moving in the same direction.",
      thesisMedium: "In the medium term, the macro catalyst must be confirmed by upcoming data and breadth.",
      thesisLong: "In the long term, the case depends on the regime: this history describes context, not a forecast.",
      thesisInvalidation: "Reduce the thesis if the catalyst reverses or price closes below the indicated structure.",
      sizing: "Use smaller sizing until volatility and news converge.",
      limitations: [
        "Historical samples are small and not independent.",
        "Subsequent reactions change with liquidity and regime.",
        "Every proposal remains PAPER and requires manual review.",
      ],
    };
  }
  return {
    name: markets.find((item) => item.symbol === symbol)?.name ?? symbol,
    explanation: "Trend positivo e conferma multi-timeframe; volatilità sopra la media richiede size ridotta.",
    technical: "Struttura rialzista e momentum costruttivo sul timeframe H1.",
    fundamental: "Il calendario macro non offre una direzione dominante.",
    risk: "Volatilità e correlazioni richiedono esposizione controllata.",
    invalidation: "La tesi perde validità sotto il minimo della struttura H1.",
    thesisSummary: "Le notizie e i precedenti sostengono una tesi osservabile, non un esito garantito.",
    thesisShort: "Nel breve, il segnale resta valido solo se prezzo e notizie mantengono la stessa direzione.",
    thesisMedium: "Nel medio, il catalizzatore macro deve confermarsi nei prossimi dati e nella breadth.",
    thesisLong: "Nel lungo, il caso dipende dal regime: questo storico descrive contesto, non una previsione.",
    thesisInvalidation: "Ridurre la tesi se il catalizzatore si inverte o il prezzo chiude sotto la struttura indicata.",
    sizing: "Size ridotta finché volatilità e news non convergono.",
    limitations: [
      "Campioni storici piccoli e non indipendenti.",
      "Le reazioni successive cambiano con liquidità e regime.",
      "Ogni eventuale proposta resta PAPER e richiede una revisione manuale.",
    ],
  };
}

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

router.get("/news", async (req, res) => {
  const symbol = typeof req.query.symbol === "string" ? req.query.symbol.toUpperCase() : undefined;
  const theme = typeof req.query.theme === "string" ? req.query.theme : undefined;
  const horizon = typeof req.query.horizon === "string" ? req.query.horizon : undefined;
  const locale = localeFrom(req.query.locale);
  const feed = await getNewsSnapshot(locale);
  const items = feed.items.filter((item) =>
    (!symbol || item.symbols.some((itemSymbol) => itemSymbol.toUpperCase() === symbol)) &&
    (!theme || item.theme === theme) &&
    (!horizon || item.horizon === horizon),
  );
  res.json({
    ...feed,
    items,
  });
});

router.get("/assets/:symbol", async (req, res) => {
  const symbol = decodeURIComponent(req.params.symbol).toUpperCase();
  const locale = localeFrom(req.query.locale);
  const market = markets.find((item) => item.symbol === symbol);
  if (!market) {
    res.status(404).json({ error: "Asset non trovato" });
    return;
  }
  const opportunity = opportunities.find((item) => item.symbol === symbol);
  const newsSnapshot = await getNewsSnapshot(locale);
  const liveAssetNews = newsSnapshot.items.filter((item) => item.symbols.some((itemSymbol) => itemSymbol.toUpperCase() === symbol));
  const usingContextualNews = liveAssetNews.length === 0;
  const news = liveAssetNews.slice(0, 4);
  const historicalPrecedents = historicalFor(symbol, locale);
  const content = assetContent(locale, symbol);
  const newsSourceStatus = usingContextualNews
    ? (newsSnapshot.sourceStatus === "degraded" ? "degraded" : "contextual")
    : newsSnapshot.sourceStatus;
  const newsSourceLabel = usingContextualNews
    ? locale === "en"
      ? "No verified live item matches this asset"
      : "Nessun elemento live verificabile corrisponde a questo asset"
    : newsSnapshot.sourceLabel;
  const assetNewsSources = usingContextualNews ? [] : newsSnapshot.sources;
  const assetNewsSourceCoverage = usingContextualNews
    ? { expected: newsSnapshot.sourceCoverage.expected, available: 0 }
    : newsSnapshot.sourceCoverage;
  const matchingItemIds = new Set(news.map((item) => item.id));
  res.json({
    symbol: market.symbol,
    name: content.name,
    price: market.price,
    decision: opportunity?.signal ?? "WAIT",
    confidence: opportunity?.confidence ?? 50,
    riskLevel: opportunity?.risk ?? "MEDIUM",
    regime: "TRENDING",
    explanation: content.explanation,
    technical: { direction: "BUY", score: 76, confidence: 82, rationale: content.technical },
    fundamental: { direction: "NEUTRAL", score: 51, confidence: 61, rationale: content.fundamental },
    risk: { direction: "CAUTION", score: 64, confidence: 67, rationale: content.risk },
    indicators: { RSI: 58, MACD: 0.014, ATR: 0.0062, MA20: market.price * 0.997, MA50: market.price * 0.991 },
    invalidation: content.invalidation,
    news,
    historicalPrecedents,
    thesis: {
      summary: content.thesisSummary,
      short: content.thesisShort,
      medium: content.thesisMedium,
      long: content.thesisLong,
      confidence: opportunity?.confidence ?? 50,
      invalidation: content.thesisInvalidation,
    },
    riskLimits: {
      maxLossPercent: 2,
      maxExposurePercent: 10,
      positionSizing: content.sizing,
      limitations: content.limitations,
    },
    dataStatus: newsSourceStatus,
    newsSourceStatus,
    newsSourceLabel,
    newsSources: assetNewsSources,
    newsSourceCoverage: assetNewsSourceCoverage,
    newsConflicts: newsSnapshot.conflicts.filter((conflict) => conflict.itemIds.some((id) => matchingItemIds.has(id))),
    newsDuplicates: newsSnapshot.duplicates.filter((duplicate) => duplicate.itemIds.some((id) => matchingItemIds.has(id))),
  });
});

export default router;
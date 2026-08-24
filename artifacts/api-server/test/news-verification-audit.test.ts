import assert from "node:assert/strict";
import test from "node:test";
import {
  annotateNews,
  canonicalUrl,
  fetchNewsSource,
  snapshotFrom,
  type NewsItem,
  type NewsSource,
  type NewsSourceConfig,
} from "../src/routes/trading";

const NOW = "2026-08-24T12:00:00.000Z";

function item(
  id: string,
  sourceId: string,
  title: string,
  sentiment: NewsItem["sentiment"],
  overrides: Partial<NewsItem> = {},
): NewsItem {
  return {
    id,
    publishedAt: NOW,
    source: sourceId === "one" ? "Source One" : "Source Two",
    sourceId,
    canonicalUrl: `https://${sourceId}.example.test/story/${id}`,
    title,
    summary: "Market context",
    symbols: ["EUR/USD"],
    theme: "FX / Macro",
    horizon: "short",
    sentiment,
    relevance: 80,
    analysis: "Context only.",
    verification: { status: "standalone", relatedItemIds: [], sourceCount: 1 },
    ...overrides,
  };
}

function source(
  id: string,
  status: NewsSource["status"],
  itemCount: number,
): NewsSource {
  return {
    id,
    label: id === "one" ? "Source One" : id === "two" ? "Source Two" : "Source Three",
    homepageUrl: `https://${id}.example.test`,
    status,
    kind: "live",
    itemCount,
    lastCheckedAt: NOW,
  };
}

const rssConfig: NewsSourceConfig = {
  id: "simulated-feed",
  label: "Simulated feed",
  homepageUrl: "https://publisher.example.test/business",
  url: "https://rss.example.test/feed.xml",
  citationHosts: ["publisher.example.test"],
};

function rssResponse(xml: string): typeof fetch {
  return async () => new Response(xml, { status: 200 });
}

test("RSS citations require HTTPS, an authorized publisher, and a valid publication date", async () => {
  const result = await fetchNewsSource(
    rssConfig,
    "en",
    rssResponse(`
      <rss><channel>
        <item>
          <title>Bitcoin rises as crypto liquidity improves</title>
          <description>Valid publisher item.</description>
          <pubDate>Mon, 24 Aug 2026 11:00:00 GMT</pubDate>
          <link>https://publisher.example.test/story/valid?utm_source=rss</link>
        </item>
        <item>
          <title>Bitcoin rises on an insecure link</title>
          <description>Must be rejected.</description>
          <pubDate>Mon, 24 Aug 2026 10:00:00 GMT</pubDate>
          <link>http://publisher.example.test/story/http</link>
        </item>
        <item>
          <title>Bitcoin rises on an untrusted domain</title>
          <description>Must be rejected.</description>
          <pubDate>Mon, 24 Aug 2026 09:00:00 GMT</pubDate>
          <link>https://untrusted.example.test/story/domain</link>
        </item>
        <item>
          <title>Bitcoin rises without a date</title>
          <description>Must be rejected.</description>
          <link>https://publisher.example.test/story/missing-date</link>
        </item>
        <item>
          <title>Bitcoin rises with an invalid date</title>
          <description>Must be rejected.</description>
          <pubDate>not-a-date</pubDate>
          <link>https://publisher.example.test/story/invalid-date</link>
        </item>
      </channel></rss>
    `),
  );

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.canonicalUrl, "https://publisher.example.test/story/valid");
  assert.equal(result.items[0]?.verification.sourceCount, 1);
  assert.equal(result.source.status, "live");
  assert.equal(result.source.itemCount, 1);
});

test("a reachable RSS feed with no verifiable items is degraded", async () => {
  const result = await fetchNewsSource(
    rssConfig,
    "it",
    rssResponse(`
      <rss><channel><item>
        <title>Bitcoin market update</title>
        <description>Missing both a citation and a date.</description>
      </item></channel></rss>
    `),
  );

  assert.deepEqual(result.items, []);
  assert.equal(result.source.status, "degraded");
  assert.equal(result.source.itemCount, 0);
});

test("confirmation requires a direct relationship across different sources", () => {
  const sameSource = annotateNews([
    item("one-a", "one", "Euro dollar rises after softer inflation", "supportive"),
    item("one-b", "one", "Euro dollar rises after softer inflation", "supportive"),
  ]);
  assert.equal(sameSource.items[0]?.verification.status, "standalone");
  assert.equal(sameSource.items[0]?.verification.sourceCount, 1);
  assert.equal(sameSource.duplicates.length, 0);

  const confirmed = annotateNews([
    item("one-a", "one", "Euro dollar rises after softer inflation", "supportive"),
    item("two-a", "two", "Euro dollar rises as inflation cools", "supportive"),
  ]);
  assert.equal(confirmed.items[0]?.verification.status, "confirmed");
  assert.equal(confirmed.items[0]?.verification.sourceCount, 2);
  assert.deepEqual(confirmed.items[0]?.verification.relatedItemIds, ["two-a"]);
});

test("conflicts and duplicates only use direct cross-source event matches", () => {
  const conflict = annotateNews([
    item("one-a", "one", "Euro dollar rises after inflation data", "supportive"),
    item("two-a", "two", "Euro dollar falls after inflation data", "adverse"),
  ]);
  assert.equal(conflict.conflicts.length, 1);
  assert.equal(conflict.items[0]?.verification.status, "contradicted");
  assert.deepEqual(conflict.conflicts[0]?.sources, ["Source One", "Source Two"]);

  const duplicate = annotateNews([
    item("one-a", "one", "Euro dollar rises after softer inflation", "supportive", {
      canonicalUrl: "https://publisher.example.test/story/shared",
    }),
    item("two-a", "two", "Euro dollar rises after softer inflation", "supportive", {
      canonicalUrl: "https://publisher.example.test/story/shared",
    }),
  ]);
  assert.equal(duplicate.duplicates.length, 1);
  assert.equal(duplicate.items[0]?.verification.status, "duplicate");
  assert.equal(duplicate.items[0]?.verification.sourceCount, 2);

  const unrelatedSameUrl = annotateNews([
    item("one-a", "one", "Euro dollar rises after softer inflation", "supportive", {
      canonicalUrl: "https://publisher.example.test/story/shared",
    }),
    item("two-a", "two", "Bitcoin liquidity falls sharply", "adverse", {
      canonicalUrl: "https://publisher.example.test/story/shared",
      symbols: ["BTC/USD"],
      theme: "Crypto",
    }),
  ]);
  assert.equal(unrelatedSameUrl.conflicts.length, 0);
  assert.equal(unrelatedSameUrl.duplicates.length, 0);
  assert.equal(unrelatedSameUrl.items[0]?.verification.status, "standalone");
});

test("source coverage distinguishes live, partial, and degraded availability", () => {
  const oneAvailable = snapshotFrom(
    [item("one-a", "one", "Euro dollar rises after softer inflation", "supportive")],
    [source("one", "live", 1)],
    "en",
  );
  assert.equal(oneAvailable.sourceStatus, "live");
  assert.deepEqual(oneAvailable.sourceCoverage, { expected: 1, available: 1 });

  const twoAvailable = snapshotFrom(
    [
      item("one-a", "one", "Euro dollar rises after softer inflation", "supportive"),
      item("two-a", "two", "Euro dollar rises as inflation cools", "supportive"),
    ],
    [source("one", "live", 1), source("two", "live", 1)],
    "en",
  );
  assert.equal(twoAvailable.sourceStatus, "live");
  assert.deepEqual(twoAvailable.sourceCoverage, { expected: 2, available: 2 });

  const partiallyAvailable = snapshotFrom(
    [item("one-a", "one", "Euro dollar rises after softer inflation", "supportive")],
    [source("one", "live", 1), source("two", "degraded", 0), source("three", "live", 0)],
    "en",
  );
  assert.equal(partiallyAvailable.sourceStatus, "partial");
  assert.deepEqual(partiallyAvailable.sourceCoverage, { expected: 3, available: 1 });
  assert.match(partiallyAvailable.sourceLabel, /1\/3/);

  const unavailable = snapshotFrom(
    [],
    [source("one", "degraded", 0), source("two", "live", 0)],
    "it",
  );
  assert.equal(unavailable.sourceStatus, "degraded");
  assert.deepEqual(unavailable.sourceCoverage, { expected: 2, available: 0 });
  assert.equal(unavailable.items.length, 0);
  assert.match(unavailable.sourceLabel, /Nessun elemento di mercato live verificabile disponibile/);
  assert.doesNotMatch(unavailable.sourceLabel, /titolo|notizia|news/i);
});

test("canonical URLs reject non-HTTPS and unauthorized domains", () => {
  assert.equal(canonicalUrl("http://publisher.example.test/story", ["publisher.example.test"]), undefined);
  assert.equal(canonicalUrl("https://untrusted.example.test/story", ["publisher.example.test"]), undefined);
  assert.equal(canonicalUrl("https://publisher.example.test/story?ref=homepage#section", ["publisher.example.test"]), "https://publisher.example.test/story");
});
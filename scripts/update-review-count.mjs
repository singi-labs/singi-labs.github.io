#!/usr/bin/env node
// Refreshes the Sifa review badge in index.html from atstore.fyi.
//
// atstore has no JSON API and no CORS, so the rating + count are scraped from
// the server-rendered HTML at build time (a browser-side fetch would be blocked).
// Run by .github/workflows/update-review-count.yml on a daily cron; it commits
// index.html only when the numbers actually change.
//
// Exit codes:
//   0  success (whether or not anything changed), or a transient fetch failure
//      (atstore unreachable) — safe to retry next run, keeps the last value.
//   1  atstore responded but the rating/reviewCount could not be parsed — the
//      markup likely changed and the extractor below needs updating.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PRODUCT_URL = "https://atstore.fyi/products/sifa";
const HERE = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = join(HERE, "..", "index.html");

async function fetchProductHtml() {
  const res = await fetch(PRODUCT_URL, {
    headers: { "user-agent": "singi-labs-site-review-updater/1.0 (+https://singi.dev)" },
  });
  if (!res.ok) throw new Error(`atstore returned HTTP ${res.status}`);
  return res.text();
}

// The product data is embedded in the RSC payload as, e.g.:
//   ...category:"Sifa",accent:"blue",rating:5,reviewCount:13...
// Primary anchor is the Sifa product header; fallback anchors on its category
// slug and takes the nearest following rating/reviewCount pair.
function extractRatingAndCount(html) {
  const primary = /category:"Sifa",accent:"[a-z]+",rating:([\d.]+),reviewCount:(\d+)/;
  const fallback = /categorySlug:"apps\/sifa"[\s\S]{0,200}?rating:([\d.]+),reviewCount:(\d+)/;
  const m = html.match(primary) || html.match(fallback);
  if (!m) return null;
  const rating = Number(m[1]);
  const count = Number(m[2]);
  if (!Number.isFinite(rating) || !Number.isInteger(count) || count < 0) return null;
  return { rating, count };
}

function applyToHtml(html, { rating, count }) {
  const score = rating.toFixed(1); // atstore stores e.g. `5`; the badge shows `5.0`
  const noun = count === 1 ? "review" : "reviews";

  const replacements = [
    // aria-label on the badge link
    [
      /aria-label="Rated [\d.]+ out of 5 from \d+ reviews? on atstore"/,
      `aria-label="Rated ${score} out of 5 from ${count} ${noun} on atstore"`,
    ],
    // visible star score
    [
      /<span class="review-score">[\d.]+<\/span>/,
      `<span class="review-score">${score}</span>`,
    ],
    // visible "N reviews on atstore" text
    [
      /&middot; \d+ reviews? on atstore/,
      `&middot; ${count} ${noun} on atstore`,
    ],
  ];

  let out = html;
  for (const [pattern, next] of replacements) {
    if (!pattern.test(out)) {
      throw new Error(`badge pattern not found in index.html: ${pattern}`);
    }
    out = out.replace(pattern, next);
  }
  return out;
}

async function main() {
  let html;
  try {
    html = await fetchProductHtml();
  } catch (err) {
    console.warn(`[review-count] could not reach atstore, keeping current value: ${err.message}`);
    process.exit(0); // transient; retry next run
  }

  const data = extractRatingAndCount(html);
  if (!data) {
    console.error("[review-count] could not parse rating/reviewCount from atstore markup — the page structure likely changed.");
    process.exit(1);
  }

  const current = readFileSync(HTML_PATH, "utf8");
  const updated = applyToHtml(current, data);

  if (updated === current) {
    console.log(`[review-count] no change (rating ${data.rating.toFixed(1)}, ${data.count} reviews).`);
    return;
  }

  writeFileSync(HTML_PATH, updated);
  console.log(`[review-count] updated badge to rating ${data.rating.toFixed(1)}, ${data.count} reviews.`);
}

main().catch((err) => {
  console.error(`[review-count] unexpected error: ${err.message}`);
  process.exit(1);
});

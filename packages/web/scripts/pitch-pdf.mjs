// Renders docs/slides/index.html to docs/pitch.pdf (1280×720 pages) and a PNG per slide for review.
//   node scripts/pitch-pdf.mjs [pngDir]
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const docs = resolve(import.meta.dirname, "../../../docs");
const pngDir = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`file://${docs}/slides/index.html`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: `${docs}/pitch.pdf`, width: "1280px", height: "720px", printBackground: true });
if (pngDir) {
  mkdirSync(pngDir, { recursive: true });
  const slides = await page.locator(".slide").all();
  for (const [i, s] of slides.entries()) await s.screenshot({ path: `${pngDir}/slide-${String(i + 1).padStart(2, "0")}.png` });
  // Flag slides whose content overflows the 720px frame.
  const overflow = await page.$$eval(".slide", (els) => els.map((el, i) => (el.scrollHeight > el.clientHeight + 1 ? i + 1 : null)).filter(Boolean));
  console.log(overflow.length ? `overflowing slides: ${overflow.join(", ")}` : "no overflow");
}
await browser.close();
console.log("wrote docs/pitch.pdf");

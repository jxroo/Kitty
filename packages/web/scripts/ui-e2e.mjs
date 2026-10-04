// Drives the real UI against devnet with an injected Wallet Standard test wallet per member.
// Usage: npx playwright install chromium && node scripts/ui-e2e.mjs <baseUrl> .e2e-wallets.json <screenshotDir>
// (fund the test wallets first: npx tsx scripts/burners.ts fund; and keep the bot running:
//  npx tsx scripts/crank.ts, because nobody clicks to pull installments or collect them)
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import nacl from "tweetnacl";

const [base = "http://localhost:3100", walletsFile, shots] = process.argv.slice(2);
mkdirSync(shots, { recursive: true });
const keys = JSON.parse(readFileSync(walletsFile, "utf8")).map((a) => Uint8Array.from(a));
const ROLES = ["anna", "bartek", "celina"];
const NAMES = { anna: "Portfel Anny", bartek: "Portfel Bartka", celina: "Portfel Celiny" };

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(bytes) {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let s = "";
  while (n > 0n) {
    s = B58[Number(n % 58n)] + s;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    s = "1" + s;
  }
  return s;
}
function readCompactU16(buf, off) {
  let val = 0, shift = 0, i = 0;
  for (;;) {
    const b = buf[off + i++];
    val |= (b & 0x7f) << shift;
    if (!(b & 0x80)) break;
    shift += 7;
  }
  return [val, i];
}
function signWireTx(wire, secret) {
  const tx = Uint8Array.from(wire);
  const [numSigs, sigLen] = readCompactU16(tx, 0);
  const msgOff = sigLen + 64 * numSigs;
  const msg = tx.slice(msgOff);
  let p = msg[0] & 0x80 ? 1 : 0; // versioned prefix
  const numRequired = msg[p];
  p += 3;
  const [numKeys, kLen] = readCompactU16(msg, p);
  p += kLen;
  const pub = secret.slice(32);
  for (let k = 0; k < Math.min(numRequired, numKeys); k++) {
    const key = msg.slice(p + 32 * k, p + 32 * k + 32);
    if (key.every((b, i) => b === pub[i])) {
      tx.set(nacl.sign.detached(msg, secret), sigLen + 64 * k);
      return Array.from(tx);
    }
  }
  throw new Error("wallet key is not a required signer");
}

function walletScript(name, address, publicKey) {
  return `(() => {
    const cfg = ${JSON.stringify({ name, address, publicKey })};
    const listeners = {};
    let connected = false;
    const account = { address: cfg.address, publicKey: new Uint8Array(cfg.publicKey), chains: ['solana:devnet'], features: ['solana:signTransaction', 'solana:signMessage'], label: cfg.name, icon: undefined };
    const emit = (ev, data) => (listeners[ev] || []).forEach((l) => l(data));
    const wallet = {
      version: '1.0.0',
      name: cfg.name,
      icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz4=',
      chains: ['solana:devnet'],
      get accounts() { return connected ? [account] : []; },
      features: {
        'standard:connect': { version: '1.0.0', connect: async () => { connected = true; emit('change', { accounts: wallet.accounts }); return { accounts: wallet.accounts }; } },
        'standard:disconnect': { version: '1.0.0', disconnect: async () => { connected = false; emit('change', { accounts: [] }); } },
        'standard:events': { version: '1.0.0', on: (ev, l) => { (listeners[ev] ||= []).push(l); return () => { listeners[ev] = listeners[ev].filter((x) => x !== l); }; } },
        'solana:signTransaction': { version: '1.0.0', supportedTransactionVersions: ['legacy', 0],
          signTransaction: async (...inputs) => Promise.all(inputs.map(async (i) => ({ signedTransaction: new Uint8Array(await window.__burnerSign('tx', Array.from(i.transaction))) }))) },
        'solana:signMessage': { version: '1.0.0',
          signMessage: async (...inputs) => Promise.all(inputs.map(async (i) => ({ signedMessage: i.message, signature: new Uint8Array(await window.__burnerSign('msg', Array.from(i.message))) }))) },
      },
    };
    const callback = ({ register }) => register(wallet);
    try {
      window.dispatchEvent(new (class extends Event { constructor() { super('wallet-standard:register-wallet', { bubbles: false, cancelable: false, composed: false }); } get detail() { return callback; } })());
    } catch (e) { console.error(e); }
    window.addEventListener('wallet-standard:app-ready', ({ detail }) => callback(detail));
  })();`;
}

const browser = await chromium.launch();
const errors = [];
const T = 120_000;

async function openAs(role, url) {
  const secret = keys[ROLES.indexOf(role)];
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 });
  await ctx.exposeFunction("__burnerSign", (kind, bytes) =>
    kind === "tx" ? signWireTx(bytes, secret) : Array.from(nacl.sign.detached(Uint8Array.from(bytes), secret))
  );
  await ctx.addInitScript({ content: walletScript(NAMES[role], b58(secret.slice(32)), Array.from(secret.slice(32))) });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`[${role}] ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`[${role}] pageerror ${e.message}`));
  await page.goto(url);
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await page.getByRole("button", { name: NAMES[role] }).click();
  await page.waitForSelector("text=SOL", { timeout: 20000 });
  console.log(`${role} connected as ${b58(secret.slice(32))}`);
  return page;
}

const refresh = (p) => p.locator('button[title="Refresh from the chain"]').click();
const shot = (p, name) => p.screenshot({ path: `${shots}/${name}.png`, fullPage: true });

/** Clicks, then waits for the activity feed to report success (or throws with the program's message). */
async function act(p, click) {
  const count = (mark) => p.locator(`li:has-text("${mark}")`).count();
  const [ok, bad] = [await count("✅"), await count("⚠️")];
  await click();
  await p.waitForFunction(
    ([ok, bad]) => {
      const items = [...document.querySelectorAll("li")];
      return items.filter((li) => li.textContent.includes("✅")).length > ok || items.filter((li) => li.textContent.includes("⚠️")).length > bad;
    },
    [ok, bad],
    { timeout: T }
  );
  if ((await count("⚠️")) > bad) throw new Error(await p.locator('li:has-text("⚠️")').first().textContent());
}

const name = `IT Team Fund ${Date.now() % 10000}`;

// 1. Anna founds a kasa (demo schedule: installment every 60 s, 15 s grace), saves 1000 zł
//    and sets a 100 zł standing contribution: the bot pulls it from her wallet.
const anna = await openAs("anna", base);
await anna.waitForSelector("text=Reading funds", { state: "detached", timeout: T });
await shot(anna, "01-kasy-list");
await anna.fill("#kasa-name", name);
await anna.fill("#kasa-me", "Anna");
await shot(anna, "02-create-form");
await act(anna, () => anna.getByRole("button", { name: "Create the fund and join" }).click());
await anna.waitForSelector(`h1:has-text("${name}")`, { timeout: T });
const kasaUrl = anna.url();
await anna.fill("#dep", "1000");
await act(anna, () => anna.getByRole("button", { name: "Deposit", exact: true }).click());
await anna.fill("#contrib", "100");
await act(anna, () => anna.getByRole("button", { name: "Turn on standing contribution" }).click());
await anna.waitForSelector("text=next in", { timeout: T });
await shot(anna, "03-standing-order");
console.log("1. kasa created, contribution pulled by the bot", kasaUrl);

// 2. Bartek joins from the invite link, saves 500 zł and asks for 1000 zł in 4 installments.
const bartek = await openAs("bartek", kasaUrl);
await bartek.getByLabel("Your name in the fund").fill("Bartek");
await act(bartek, () => bartek.getByRole("button", { name: "Join", exact: true }).click());
await bartek.waitForSelector("#dep", { timeout: T });
await bartek.fill("#dep", "500");
await act(bartek, () => bartek.getByRole("button", { name: "Deposit", exact: true }).click());
await bartek.fill("#loan-amount", "1000");
await bartek.selectOption("#loan-inst", "4");
await act(bartek, () => bartek.getByRole("button", { name: "Request a loan" }).click());
await bartek.waitForSelector("text=Awaiting guarantees", { timeout: T });
await shot(bartek, "04-loan-requested");
console.log("2. loan requested");

// 3. Anna pledges 300 zł, Celina joins and pledges 200 zł.
await refresh(anna);
await anna.waitForSelector('[aria-label="Guarantee amount in PLN"]', { timeout: T });
await anna.getByLabel("Guarantee amount in PLN").fill("300");
await act(anna, () => anna.getByRole("button", { name: "Guarantee" }).click());
const celina = await openAs("celina", kasaUrl);
await celina.getByLabel("Your name in the fund").fill("Celina");
await act(celina, () => celina.getByRole("button", { name: "Join", exact: true }).click());
await celina.waitForSelector("#dep", { timeout: T });
await celina.fill("#dep", "1000");
await act(celina, () => celina.getByRole("button", { name: "Deposit", exact: true }).click());
await celina.getByLabel("Guarantee amount in PLN").fill("200");
await act(celina, () => celina.getByRole("button", { name: "Guarantee" }).click());
console.log("3. guaranteed");

// 4. Bartek pays the loan out (no approval) with the direct-debit box ticked (default).
await refresh(bartek);
await bartek.waitForSelector("text=The loan is fully covered", { timeout: T });
await shot(bartek, "05-loan-covered");
await act(bartek, () => bartek.getByRole("button", { name: "Pay the loan out to my wallet" }).click());
await bartek.waitForSelector("text=Automatic repayment is on", { timeout: T });
await shot(bartek, "06-loan-active-mandate");
console.log("4. disbursed with a mandate");

// 5. Installment 1 falls due: nobody clicks, the bot pulls it from Bartek's wallet.
await bartek.waitForSelector('span:has-text("Repaid automatically: 250 PLN")', { timeout: 240_000 });
await shot(bartek, "07-installment-pulled-by-bot");
await bartek.locator('article[aria-label^="Loan"]').first().screenshot({ path: `${shots}/07b-installment-pulled-card.png` });
console.log("5. installment 1 pulled by the bot");

// 6. Bartek stops paying: he revokes the mandate. After installment 2 + grace the bot
//    collects it from his locked savings; Celina just watches.
await act(bartek, () => bartek.getByRole("button", { name: "Turn off automatic repayment" }).click());
await bartek.waitForSelector("text=Automatic repayment is off", { timeout: T });
await refresh(celina);
await celina.waitForSelector("text=Covered from locked savings", { timeout: 240_000 });
await shot(celina, "08-collected-by-bot");
await celina.locator('article[aria-label^="Loan"]').first().screenshot({ path: `${shots}/08b-collected-card.png` });

console.log("6. installment 2 collected from collateral by the bot");

// 7. The kasa's history: every movement from the chain, the bot's rows, and the balance check.
const history = celina.getByRole("region", { name: "Fund history" });
await history.getByText("Unpaid installment covered from locked savings").first().waitFor({ timeout: T });
await history.getByText("matches the history").waitFor({ timeout: T });
await history.screenshot({ path: `${shots}/08c-kasa-history.png` });
console.log("7. kasa history shows the bot's pull, the collection and a matching balance");

// 8. Explainer.
await celina.getByRole("button", { name: "Where did the middleman go?" }).click();
await celina.waitForSelector("text=Exactly where the middleman disappears", { timeout: T });
await shot(celina, "09-how-it-works");

console.log(errors.length ? `CONSOLE ERRORS:\n${errors.join("\n")}` : "no console errors");
await browser.close();

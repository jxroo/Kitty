// Drives the real UI against devnet with an injected Wallet Standard test wallet per role.
// Usage: npx playwright install chromium && node scripts/ui-e2e.mjs <baseUrl> .e2e-wallets.json <screenshotDir>
// (fund the test wallets first: npx tsx scripts/burners.ts fund)
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import nacl from "tweetnacl";

const [base = "http://localhost:3100", walletsFile, shots] = process.argv.slice(2);
mkdirSync(shots, { recursive: true });
const keys = JSON.parse(readFileSync(walletsFile, "utf8")).map((a) => Uint8Array.from(a));
const ROLES = ["seller", "buyer", "arbiter"];
const NAMES = { seller: "Test Sprzedawca", buyer: "Test Kupujący", arbiter: "Test Arbiter" };

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
const pages = {};
const errors = [];
for (const [i, role] of ROLES.entries()) {
  const secret = keys[i];
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, deviceScaleFactor: 2 });
  await ctx.exposeFunction("__burnerSign", (kind, bytes) =>
    kind === "tx" ? signWireTx(bytes, secret) : Array.from(nacl.sign.detached(Uint8Array.from(bytes), secret))
  );
  await ctx.addInitScript({ content: walletScript(NAMES[role], b58(secret.slice(32)), Array.from(secret.slice(32))) });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`[${role}] ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`[${role}] pageerror ${e.message}`));
  await page.goto(base);
  await page.getByRole("button", { name: "Połącz portfel" }).click();
  await page.getByRole("button", { name: NAMES[role] }).click();
  await page.waitForSelector("text=SOL", { timeout: 20000 });
  pages[role] = page;
  console.log(`${role} connected as ${b58(secret.slice(32))}`);
}
const T = 120_000;
const tab = (p, name) => p.getByRole("button", { name }).click();
const refresh = (p) => p.locator('button[title="Odśwież stan z łańcucha"]').click();
const shot = (p, name) => p.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
async function lastActivity(p, pattern) {
  await p.waitForSelector(`li:has-text("${pattern}")`, { timeout: T });
}

const { seller, buyer, arbiter } = pages;
const arbiterAddress = b58(keys[2].slice(32));
const title = `Sony WH-1000XM5 UI test ${Date.now() % 10000}`;

// 1. Seller lists an item
await tab(seller, "4. Wystaw przedmiot");
await seller.locator('label:has-text("Tytuł") + input').fill(title);
await seller.locator('label:has-text("Cena") + input').fill("0.02");
await seller.getByPlaceholder("Adres portfela arbitra").fill(arbiterAddress);
await shot(seller, "01-create-form");
await seller.getByRole("button", { name: "Wystaw na łańcuchu" }).click();
await seller.waitForSelector("text=Oferta jest na łańcuchu", { timeout: T });
await shot(seller, "02-created-share");
console.log("1. listed");

// 2. Buyer buys from the post
await refresh(buyer);
await buyer.getByRole("button", { name: title.slice(0, 28) }).click().catch(() => {});
await buyer.waitForSelector(`text=${title}`, { timeout: T });
await shot(buyer, "03-feed-blink");
await buyer.getByRole("button", { name: /Kup i zablokuj/ }).click();
await buyer.waitForSelector("text=Jesteś kupującym", { timeout: T });
await buyer.waitForSelector("text=Opłacone", { timeout: T });
await shot(buyer, "04-buyer-funded");
console.log("2. bought");

// 3. Seller: decrypt address, try to steal (rejected), mark shipped
await tab(seller, "2. Moje transakcje");
await refresh(seller);
await seller.waitForSelector("text=Opłacone", { timeout: T });
await seller.getByRole("button", { name: /Odszyfruj adres/ }).click();
await seller.waitForSelector("text=Paczkomat KRA01M", { timeout: T });
await seller.getByRole("button", { name: /Spróbuj wypłacić sobie/ }).click();
await lastActivity(seller, "tylko kupujący może zwolnić");
await shot(seller, "05-seller-rule-rejected");
await seller.getByRole("button", { name: "Wysłane", exact: true }).click();
await seller.waitForSelector("text=Wysłane – czeka", { timeout: T });
console.log("3. decrypted, theft rejected, shipped");

// 4. Buyer opens a dispute
await tab(buyer, "2. Moje transakcje");
await refresh(buyer);
await buyer.waitForSelector("text=Wysłane – czeka", { timeout: T });
await buyer.getByPlaceholder(/Opisz problem/).fill("Lewy przetwornik ANC nie działa, pęknięty pałąk");
await buyer.getByRole("button", { name: "Spór", exact: true }).click();
await buyer.waitForSelector("text=Spór – decyduje arbiter", { timeout: T });
console.log("4. disputed");

// 5. Arbiter rules
await tab(arbiter, "3. Panel arbitra");
await refresh(arbiter);
await arbiter.waitForSelector("text=Podpisz werdykt", { timeout: T });
await shot(arbiter, "06-arbiter-panel");
await arbiter.getByRole("button", { name: /Podpisz werdykt/ }).click();
await lastActivity(arbiter, "Werdykt arbitra");
await arbiter.waitForSelector("text=Spór rozstrzygnięty", { timeout: T });
await shot(arbiter, "07-arbiter-resolved");
console.log("5. resolved");

// 6. Explainer tab + seller closes the account
await tab(seller, "Gdzie znika pośrednik?");
await seller.waitForSelector("text=Upgrade authority", { timeout: T });
await seller.waitForTimeout(2500);
await shot(seller, "08-how-it-works");
await tab(seller, "2. Moje transakcje");
await refresh(seller);
await seller.getByRole("button", { name: /Zamknij konto i odzyskaj rent/ }).click();
await lastActivity(seller, "Zamknięcie konta");
console.log("6. closed");

console.log(errors.length ? `CONSOLE ERRORS:\n${errors.join("\n")}` : "no console errors");
await browser.close();

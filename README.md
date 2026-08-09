# billSplitter 🧾

by **aunirbhan** · live at **https://aunirbhan.github.io/billSplitter/**

Snap the bill. Text the link. Everyone taps what they ate.

billSplitter is a **serverless** bill splitter that runs entirely on GitHub Pages. No backend, no database, no accounts, no saved data — **the link is the room**: the whole bill is compressed into the URL you text to your table. Any random person opens it and it just works. Money never moves through the app; it connects people to the host's own Zelle / Venmo / Cash App / PayPal.

Everything is open source (MIT) on a free stack: GitHub Pages hosting, MIT-licensed libraries, and an optional free-tier Cloudflare Worker for scanning.

## At dinner

1. **Host** snaps the receipt. Claude reads it — and *judges* it: incomplete, not readable, cut off, or not a bill at all, and asks one question for whatever's missing.
2. Fix anything by tapping the fields, or by **voice/text**: *"the wings were 14.50"*, *"tax was 4.60 and total 87"*, *"add a thai tea for six bucks"*.
3. Optionally **name the table** — every person gets a color that's identical on every phone.
4. Share the link (iMessage / WhatsApp / QR). Guests open it, tap their name, tap what they ate.
5. Two views of the same bill: **cards** (tap to claim, tag people by colored name chips) and **receipt** (the full printed-style breakdown with little colored lines showing who ate each item).
6. Everyone's *You owe* total grows as they tap — tax, tip & fees start evenly split. **Settle up** opens the host's payment links with the amount prefilled. Paid cash? Mark it, it's deducted.

## Keyless scanning for everyone (dev setup, ~5 min, free)

Receipt reading and voice edits call Claude. So no user ever needs an API key, deploy the tiny proxy in [`proxy/`](proxy/) to Cloudflare Workers (free tier, ~100k requests/day) — it holds **your** key as a server-side secret:

```sh
cd proxy
npx wrangler deploy                      # prints your worker URL
npx wrangler secret put ANTHROPIC_API_KEY
```

Then in the GitHub repo: **Settings → Secrets and variables → Actions → Variables** → add `ANTHROPIC_PROXY_URL` = your worker URL → re-run the deploy workflow. From then on every phone scans with zero setup. Cost lands on your Anthropic key (~1¢/receipt); the worker enforces an origin allowlist, model allowlist, body cap, and a soft rate limit — add a Cloudflare WAF rate rule on the route for a hard cap.

No proxy configured? The app still works: manual/dictated entry is always available, and a dev can put a personal key in Settings (stored in that phone's localStorage only).

## Architecture

| Piece | Choice |
|---|---|
| App | Vite + React 19 + TypeScript + Tailwind v4, hash-routed static SPA |
| Theme | Matte cream & brown; follows system light/dark automatically |
| Room state | lz-string–compressed bill JSON in the URL fragment (`#/r/…`) |
| Local state | `localStorage` via zustand persist — bills, claims, colors, settings |
| Receipt OCR + edits | Anthropic API (`claude-opus-5` vision + structured outputs) via the proxy, or direct-from-browser with a local key |
| Money math | Integer cents only; shares ceil-rounded in the host's favor (≤1¢/line); real head-counts override the host's ÷N when people are tagged |
| Payments | Deep links composed client-side — money never touches the app |

## Develop

```sh
npm install
npm run dev -- --host   # dev server + phones on your wifi
npm test                # split-engine / codec / attribution suite
npm run build           # typecheck + production build → dist/
```

Push to `main` → `.github/workflows/deploy.yml` tests, builds, and publishes to Pages.

## Honest limitations

- **No live sync between phones.** Each phone computes its own total from the shared link. Tagging names or fixing "shared by N" applies on your phone (and the host can re-share an updated link). That's the price of zero backend — and why it runs free, forever, on a static page.
- Clearing browser data erases saved bills (they also live in any link already shared).
- Payment deep-link URL schemes are owned by Venmo/CashApp/etc. and can change; every method has a copy button.
- Voice input uses the Web Speech API where available; typing always works.

# Tally 🧾

Snap the bill. Text the link. Everyone taps what they ate.

Tally is a **serverless** bill splitter that runs entirely on GitHub Pages. There is no backend, no database, and no accounts — **the link is the room**: the whole bill is compressed into the URL you text to your table. Anyone who opens it picks their items and watches their total grow; tax, tip, and fees are split evenly by default.

## How it works at dinner

1. **Host** taps *Snap a bill*, photographs the receipt. Claude reads it into tappable cards.
2. Host fixes anything by tapping — or by **voice/text**: *"the wings were actually 14.50"*, *"remove one soda"*, *"add a thai tea for six bucks"*.
3. Host sets the party size, then shares the link (iMessage / WhatsApp / QR).
4. **Guests** open the link — no install, no signup. Type a name, tap what you ate. Shared plates show `÷2`, `÷3`… and count once per person.
5. Everyone's *You owe* total animates up as they tap. *Settle up* shows the host's own Venmo / Cash App / PayPal / Zelle with the amount prefilled. Paid cash already? Mark it and it's deducted.
6. Bills stay on each phone under *My bills* — reopen last week's split anytime.

## Architecture

| Piece | Choice |
|---|---|
| App | Vite + React 19 + TypeScript + Tailwind v4, hash-routed static SPA |
| Room state | lz-string–compressed bill JSON in the URL fragment (`#/r/…`) |
| Local state | `localStorage` via zustand persist (bills, claims, settings) |
| Receipt OCR | Anthropic API (`claude-opus-5` vision + structured outputs), called **directly from the browser**; the API key lives only in the host's device localStorage |
| Money math | Integer cents only; shares ceil-rounded in the host's favor (≤1¢/line) |
| Payments | Deep links composed client-side — money never touches this app |

## Develop

```sh
npm install
npm run dev        # local dev server
npm test           # split-engine + codec suite
npm run build      # typecheck + production build → dist/
```

## Deploy

Push to `main` — `.github/workflows/deploy.yml` tests, builds, and publishes to GitHub Pages (Settings → Pages → Source: **GitHub Actions**).

## Honest limitations

- **No live sync between phones.** Each phone computes its own total from the shared link; shared items divide by the `÷N` the host set. That's the price of zero backend — and why it works from a static page forever.
- Clearing browser data erases your saved bills (they also live in any link you've shared).
- Payment deep-link URL schemes are set by Venmo/CashApp/etc. and can change; every method also has a copy button.
- Voice input uses the Web Speech API where available; typing always works.

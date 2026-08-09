import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import type { Bill } from "./types";
import { newId } from "./split";

/**
 * Two ways to reach Claude, in priority order:
 *
 * 1. A proxy you host (Cloudflare Worker in ./proxy — free tier) that holds
 *    the API key server-side. Set VITE_ANTHROPIC_PROXY at build time and
 *    NOBODY needs a key: any random person can open the app and scan.
 * 2. Direct-from-browser with a key in this device's localStorage
 *    (dev fallback / self-hosters).
 */
const PROXY_URL: string | undefined = import.meta.env.VITE_ANTHROPIC_PROXY;

export function hasProxy(): boolean {
  return Boolean(PROXY_URL);
}

/** Can this device scan/edit with AI right now? */
export function aiReady(apiKey: string): boolean {
  return hasProxy() || Boolean(apiKey);
}

function client(apiKey: string) {
  if (PROXY_URL) {
    return new Anthropic({
      baseURL: PROXY_URL.replace(/\/$/, ""),
      apiKey: "proxy-managed", // real key is injected by the worker
      dangerouslyAllowBrowser: true,
    });
  }
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

const MODEL = "claude-opus-5";

// ---------- Receipt photo → structured bill (with quality verdict) ----------

export type ScanStatus = "ok" | "incomplete" | "not_readable" | "not_fully_in_view" | "not_a_bill";

const ParsedReceipt = z.object({
  status: z.enum(["ok", "incomplete", "not_readable", "not_fully_in_view", "not_a_bill"]),
  /** one friendly sentence: what's wrong and/or what info is missing */
  question: z.string().nullable(),
  merchant: z.string().nullable(),
  items: z.array(
    z.object({
      label: z.string(),
      qty: z.number().int(),
      unitPriceCents: z.number().int(),
      lineTotalCents: z.number().int(),
    }),
  ),
  taxCents: z.number().int(),
  tipCents: z.number().int(),
  fees: z.array(z.object({ label: z.string(), cents: z.number().int() })),
  totalCents: z.number().int(),
});

const PARSE_PROMPT = `You are reading a photo that is supposed to be a restaurant receipt. First judge the photo, then extract what you can.

status — pick exactly one:
- "ok": a receipt, fully visible, readable; you extracted everything.
- "incomplete": a readable receipt but information is missing (no total, no tax line, items without prices, a handwritten tip you can't make out).
- "not_fully_in_view": clearly a receipt but part of it is cut off / out of frame.
- "not_readable": probably a receipt but too blurry/dark/crumpled to read reliably.
- "not_a_bill": the photo is not a bill or receipt at all.

question — null when status is "ok". Otherwise ONE short, friendly sentence a person at a dinner table can act on. Examples:
- incomplete: "I got all 8 items but can't see a tax or total — what were they?"
- not_fully_in_view: "The bottom of the receipt is cut off — retake with the total in frame, or tell me the tax, tip, and total."
- not_readable: "Too blurry to read — try again with more light and the receipt flat."
- not_a_bill: "That doesn't look like a receipt — snap the itemized bill."

Extraction rules (extract whatever IS readable even when status isn't "ok"; use 0 / [] for what you can't see — never guess):
- ALL money values are integer cents. $12.34 → 1234. Never floats, never dollars.
- qty is the printed quantity (default 1). unitPriceCents is per unit; lineTotalCents is the printed line total.
- fees = service charges, delivery fees, large-party surcharges — anything that's not an item, tax, or tip.
- tipCents: only if a tip/gratuity amount is actually written (printed or handwritten).
- totalCents: the printed grand total.
- Keep item labels short and human ("Pad Thai", not "1 PAD THAI CHK SPCY").`;

export interface ScanResult {
  status: ScanStatus;
  question: string | null;
  bill: Omit<Bill, "host" | "people">;
}

export async function parseReceipt(
  apiKey: string,
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png",
): Promise<ScanResult> {
  const res = await client(apiKey).messages.parse({
    model: MODEL,
    max_tokens: 16000,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: PARSE_PROMPT },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(ParsedReceipt) },
  });

  const parsed = res.parsed_output;
  if (!parsed) throw new Error("Couldn't process that photo — try again, or type the bill in.");

  // Explode qty>1 lines into individual tappable cards, preserving pennies
  // on the last card so the sum always matches the printed line total.
  const items = parsed.items.flatMap((it) => {
    const qty = Math.max(1, it.qty);
    if (qty === 1) {
      return [{ id: newId(), label: it.label, cents: Math.max(0, it.lineTotalCents || it.unitPriceCents), split: 1 }];
    }
    const unit = it.unitPriceCents > 0 ? it.unitPriceCents : Math.round(it.lineTotalCents / qty);
    const cards = [];
    for (let i = 0; i < qty; i++) {
      const cents = i === qty - 1 ? Math.max(0, it.lineTotalCents - unit * (qty - 1)) : unit;
      cards.push({ id: newId(), label: it.label, cents, split: 1 });
    }
    return cards;
  });

  const now = Date.now();
  const date = new Date(now).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return {
    status: parsed.status,
    question: parsed.question,
    bill: {
      v: 1,
      title: parsed.merchant ? `${parsed.merchant} · ${date}` : `Dinner · ${date}`,
      items,
      taxCents: Math.max(0, parsed.taxCents),
      tipCents: Math.max(0, parsed.tipCents),
      fees: parsed.fees.map((f) => ({ label: f.label, cents: Math.max(0, f.cents) })),
      totalCents: Math.max(0, parsed.totalCents),
      createdAt: now,
    },
  };
}

// ---------- Natural-language edits & completions (voice or text) ----------

const EditedBill = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      cents: z.number().int(),
      split: z.number().int(),
    }),
  ),
  taxCents: z.number().int(),
  tipCents: z.number().int(),
  fees: z.array(z.object({ label: z.string(), cents: z.number().int() })),
  totalCents: z.number().int(),
  people: z.number().int(),
  /** null when the bill looks complete; else ONE short question about what's still missing */
  question: z.string().nullable(),
});

const EDIT_PROMPT = (billJson: string, instruction: string, pendingQuestion: string | null) => `You edit and complete restaurant bills. Current bill as JSON (all money in integer cents):

${billJson}
${pendingQuestion ? `\nYou previously asked the user: "${pendingQuestion}" — their reply may answer it.\n` : ""}
The user, speaking or typing at the dinner table, says:

"${instruction}"

Rules:
- Return the COMPLETE corrected bill — every item, changed or not.
- Keep the existing "id" of every item you do not remove. Brand-new items get id "new-1", "new-2", ...
- "split" is how many people share that item; change it only if the instruction says so.
- All money stays integer cents. If a price is spoken without units, assume dollars ("fourteen fifty" → 1450).
- Interpret casual speech: "there was no second soda" → remove one soda card; "add a thai tea for six bucks" → new item 600; "tax was 4.60 and total 87" → set those fields.
- "people"/party size changes only if the instruction says so.
- Do not invent changes the instruction didn't ask for.
- After applying, check completeness: if items are missing prices, or tax/total are 0 and unmentioned, set "question" to ONE short friendly question asking for what's missing. If the bill looks complete (or the user says it's fine), question = null.`;

export interface EditResult {
  bill: Bill;
  changedIds: string[];
  question: string | null;
}

export async function editBill(
  apiKey: string,
  bill: Bill,
  instruction: string,
  pendingQuestion: string | null = null,
): Promise<EditResult> {
  const current = {
    items: bill.items,
    taxCents: bill.taxCents,
    tipCents: bill.tipCents,
    fees: bill.fees,
    totalCents: bill.totalCents,
    people: bill.people,
  };
  const res = await client(apiKey).messages.parse({
    model: MODEL,
    max_tokens: 16000,
    messages: [{ role: "user", content: EDIT_PROMPT(JSON.stringify(current), instruction, pendingQuestion) }],
    output_config: { format: zodOutputFormat(EditedBill) },
  });
  const out = res.parsed_output;
  if (!out) throw new Error("Didn't catch that — try rephrasing.");

  const before = new Map(bill.items.map((i) => [i.id, i]));
  const changedIds: string[] = [];
  const items = out.items.map((it) => {
    const isNew = !before.has(it.id);
    const id = isNew ? newId() : it.id;
    const prev = before.get(it.id);
    if (isNew || !prev || prev.label !== it.label || prev.cents !== it.cents || prev.split !== it.split) {
      changedIds.push(id);
    }
    return { id, label: it.label, cents: Math.max(0, it.cents), split: Math.max(1, it.split) };
  });

  return {
    bill: {
      ...bill,
      items,
      taxCents: Math.max(0, out.taxCents),
      tipCents: Math.max(0, out.tipCents),
      fees: out.fees.map((f) => ({ label: f.label, cents: Math.max(0, f.cents) })),
      totalCents: Math.max(0, out.totalCents),
      people: Math.max(1, out.people),
    },
    changedIds,
    question: out.question,
  };
}

export function friendlyError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError)
    return hasProxy() ? "The scan service rejected the request — check the proxy setup." : "That API key didn't work — check it in Settings.";
  if (e instanceof Anthropic.RateLimitError) return "Busy right now — give it a few seconds and retry.";
  if (e instanceof Anthropic.APIConnectionError) return "No connection — check your signal and retry.";
  if (e instanceof Error) return e.message;
  return "Something went wrong — try again.";
}

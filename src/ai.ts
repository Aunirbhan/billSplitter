import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import type { Bill } from "./types";
import { newId } from "./split";

/**
 * Static-host architecture: the browser calls Anthropic directly.
 * The API key lives only in the host's localStorage — it is never in
 * the repo, never on a server, and guests never need one.
 */
function client(apiKey: string) {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

const MODEL = "claude-opus-5";

// ---------- Receipt photo → structured bill ----------

const ParsedReceipt = z.object({
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

const PARSE_PROMPT = `Read this restaurant receipt and extract every line item.

Rules:
- ALL money values are integer cents. $12.34 → 1234. Never use floats or dollars.
- If a value is not printed on the receipt, use 0 — never guess.
- qty is the printed quantity (default 1). unitPriceCents is per unit; lineTotalCents = the printed line total.
- fees = service charges, delivery fees, large-party surcharges — anything that is not an item, tax, or tip.
- tipCents: only if a tip/gratuity amount is actually written (printed or handwritten).
- totalCents: the printed grand total.
- Keep item labels short and human ("Pad Thai", not "1 PAD THAI CHK SPCY").`;

export async function parseReceipt(
  apiKey: string,
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png",
): Promise<{ bill: Omit<Bill, "host" | "people">; merchant: string | null }> {
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
  if (!parsed) throw new Error("Couldn't read that receipt — try a flatter, brighter photo, or enter it by hand.");

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
    merchant: parsed.merchant,
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

// ---------- Natural-language edits ("wings were actually 14.50") ----------

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
});

const EDIT_PROMPT = (billJson: string, instruction: string) => `You edit restaurant bills. Here is the current bill as JSON (all money in integer cents):

${billJson}

Apply this instruction from the user, spoken or typed at the dinner table:

"${instruction}"

Rules:
- Return the COMPLETE corrected bill — every item, changed or not.
- Keep the existing "id" of every item you do not remove. For brand-new items use id "new-1", "new-2", ...
- "split" is how many people share that item; change it only if the instruction says so.
- All money stays integer cents. $14.50 → 1450.
- If the instruction mentions a price without naming dollars/cents, assume dollars ("wings were fourteen fifty" → 1450).
- Interpret casual speech: "there was no second soda" → remove one soda card; "add a thai tea for six bucks" → new item 600.
- "people"/party size changes only if the instruction says so.
- Do not invent changes the instruction didn't ask for.`;

export interface EditResult {
  bill: Bill;
  /** ids of items that were added or changed — for flash-highlighting */
  changedIds: string[];
}

export async function editBill(apiKey: string, bill: Bill, instruction: string): Promise<EditResult> {
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
    messages: [{ role: "user", content: EDIT_PROMPT(JSON.stringify(current), instruction) }],
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
  };
}

export function friendlyError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "That API key didn't work — check it in Settings.";
  if (e instanceof Anthropic.RateLimitError) return "Rate limited — give it a few seconds and retry.";
  if (e instanceof Anthropic.APIConnectionError) return "No connection — check your signal and retry.";
  if (e instanceof Error) return e.message;
  return "Something went wrong — try again.";
}

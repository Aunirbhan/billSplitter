import type { Bill, BillItem } from "./types";

/**
 * Integer-cents division, rounded UP to the whole cent.
 * Shares are computed independently on each phone (no central allocator),
 * so we round in the host's favor: nobody underpays, worst case a person
 * overpays by <1¢ per shared line. That is the honest tradeoff for a
 * serverless room.
 */
export function divUp(cents: number, n: number): number {
  if (n <= 1) return cents;
  return Math.ceil(cents / n);
}

export function itemsSubtotal(bill: Bill): number {
  return bill.items.reduce((s, it) => s + it.cents, 0);
}

export function extrasCents(bill: Bill): number {
  return bill.taxCents + bill.tipCents + bill.fees.reduce((s, f) => s + f.cents, 0);
}

/** What the lines actually add up to. */
export function computedTotal(bill: Bill): number {
  return itemsSubtotal(bill) + extrasCents(bill);
}

/**
 * Positive → lines add up to MORE than the printed total,
 * negative → less. 0 when it balances or no printed total is known.
 */
export function discrepancy(bill: Bill): number {
  if (!bill.totalCents) return 0;
  return computedTotal(bill) - bill.totalCents;
}

/** Everyone's even share of tax + tip + fees. */
export function extrasShare(bill: Bill): number {
  return divUp(extrasCents(bill), Math.max(1, bill.people));
}

/** One person's share of a single item. */
export function itemShare(item: BillItem): number {
  return divUp(item.cents, Math.max(1, item.split));
}

/** Reference number: the lazy even split of the whole bill. */
export function evenShare(bill: Bill): number {
  const total = bill.totalCents || computedTotal(bill);
  return divUp(total, Math.max(1, bill.people));
}

export interface MyTotal {
  /** shares of items I claimed and still owe for */
  itemsCents: number;
  /** my share of tax/tip/fees */
  extrasCents: number;
  /** shares of items I claimed but already paid in cash */
  cashCents: number;
  /** what I owe the host: items + extras (cash items excluded) */
  owedCents: number;
}

export function myTotal(bill: Bill, claims: string[], cash: string[]): MyTotal {
  const claimed = new Set(claims);
  const cashSet = new Set(cash);
  let items = 0;
  let cashPaid = 0;
  for (const it of bill.items) {
    if (!claimed.has(it.id)) continue;
    const share = itemShare(it);
    if (cashSet.has(it.id)) cashPaid += share;
    else items += share;
  }
  const extras = extrasShare(bill);
  return {
    itemsCents: items,
    extrasCents: extras,
    cashCents: cashPaid,
    owedCents: items + extras,
  };
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** "12.34", "$12.34", "12", ".99" → cents. NaN-safe: returns null on junk. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d*\.?\d{0,2}$/.test(cleaned) || cleaned === "" || cleaned === ".") return null;
  const [whole = "0", frac = ""] = cleaned.split(".");
  return parseInt(whole || "0", 10) * 100 + parseInt(frac.padEnd(2, "0") || "0", 10);
}

let counter = 0;
export function newId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

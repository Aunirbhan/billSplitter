import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { Bill } from "./types";

/**
 * The URL *is* the room. The whole bill is compressed into the hash
 * fragment, so a static host (GitHub Pages) can serve a fully working
 * shared bill with zero backend.
 */
export function encodeBill(bill: Bill): string {
  return compressToEncodedURIComponent(JSON.stringify(bill));
}

export function decodeBill(blob: string): Bill | null {
  try {
    const json = decompressFromEncodedURIComponent(blob);
    if (!json) return null;
    const bill = JSON.parse(json) as Bill;
    if (bill.v !== 1 || !Array.isArray(bill.items)) return null;
    // Defensive normalization — this came off the wire.
    bill.items = bill.items.map((it) => ({
      id: String(it.id),
      label: String(it.label ?? "Item"),
      cents: Math.max(0, Math.round(Number(it.cents) || 0)),
      split: Math.max(1, Math.round(Number(it.split) || 1)),
    }));
    bill.taxCents = Math.max(0, Math.round(Number(bill.taxCents) || 0));
    bill.tipCents = Math.max(0, Math.round(Number(bill.tipCents) || 0));
    bill.totalCents = Math.max(0, Math.round(Number(bill.totalCents) || 0));
    bill.people = Math.max(1, Math.round(Number(bill.people) || 1));
    bill.fees = (bill.fees ?? []).map((f) => ({
      label: String(f.label ?? "Fee"),
      cents: Math.max(0, Math.round(Number(f.cents) || 0)),
    }));
    bill.host = bill.host ?? { name: "the host" };
    return bill;
  } catch {
    return null;
  }
}

/** Stable id for a bill: content hash so the same link maps to the same saved entry. */
export function billId(bill: Bill): string {
  const s = JSON.stringify([bill.title, bill.createdAt, bill.totalCents, bill.items.map((i) => [i.label, i.cents])]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function roomUrl(bill: Bill): string {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#/r/${encodeBill(bill)}`;
}

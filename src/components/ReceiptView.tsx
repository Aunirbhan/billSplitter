import type { Bill } from "../types";
import { extrasCents, formatCents, itemShare, itemsSubtotal } from "../split";
import { colorFor } from "../people";
import { vibrate } from "../store";

/**
 * Receipt view: the whole bill as one printed-receipt sheet. Under each
 * item, small colored lines mark everyone who ate it — same person-colors
 * as the card view, so attribution reads at a glance.
 */
export function ReceiptView({
  bill,
  roster,
  myName,
  claims,
  cash,
  assign,
  onTapItem,
}: {
  bill: Bill;
  roster: string[];
  myName: string;
  claims: string[];
  cash: string[];
  assign: Record<string, string[]>;
  onTapItem: (id: string) => void;
}) {
  const extras = extrasCents(bill);

  return (
    <div className="rounded-3xl border border-line bg-card px-5 pb-6 pt-5 font-mono text-[13px] leading-relaxed">
      {/* perforation */}
      <div className="mb-4 border-b-2 border-dashed border-line pb-3 text-center">
        <div className="font-sans text-base font-bold tracking-wide text-ink">{bill.title}</div>
        <div className="mt-0.5 text-xs text-dim">
          {bill.people} people · hosted by {bill.host.name}
        </div>
      </div>

      <div className="space-y-2.5">
        {bill.items.map((it) => {
          const mine = claims.includes(it.id);
          const paidCash = cash.includes(it.id);
          const others = assign[it.id] ?? [];
          const eaters = [...(mine && myName ? [myName] : []), ...others];
          return (
            <button
              key={it.id}
              onClick={() => {
                vibrate();
                onTapItem(it.id);
              }}
              className="block w-full text-left active:opacity-70"
            >
              <div className="flex items-baseline gap-2">
                <span className={`truncate ${mine ? "font-bold text-ink" : "text-ink"}`}>
                  {it.label}
                  {it.split > 1 ? ` ÷${it.split}` : ""}
                </span>
                <span className="mx-1 flex-1 border-b border-dotted border-line" />
                <span className={`tabular-nums ${mine && !paidCash ? "font-bold" : ""} ${paidCash ? "text-money" : "text-ink"}`}>
                  {formatCents(it.cents)}
                </span>
              </div>
              {/* the little colored lines — one per person on this item */}
              {eaters.length > 0 && (
                <div className="mt-1 flex items-center gap-1">
                  {eaters.map((n) => (
                    <span
                      key={n}
                      title={n}
                      className="h-[3px] w-6 rounded-full"
                      style={{ backgroundColor: colorFor(n, roster) }}
                    />
                  ))}
                  {mine && (
                    <span className="ml-1.5 font-sans text-[11px] text-dim">
                      {paidCash ? "cash ✓" : `you: ${formatCents(itemShare(it))}`}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-1 border-t-2 border-dashed border-line pt-3">
        <Row label="Items" cents={itemsSubtotal(bill)} />
        {bill.taxCents > 0 && <Row label="Tax" cents={bill.taxCents} />}
        {bill.fees.map((f, i) => (
          <Row key={i} label={f.label} cents={f.cents} />
        ))}
        {bill.tipCents > 0 && <Row label="Tip" cents={bill.tipCents} />}
        <Row label={`Shared evenly ÷${bill.people}`} cents={extras} dim />
        <div className="flex items-baseline gap-2 pt-1 text-sm font-bold">
          <span>TOTAL</span>
          <span className="mx-1 flex-1 border-b border-dotted border-line" />
          <span className="tabular-nums">{formatCents(bill.totalCents || itemsSubtotal(bill) + extras)}</span>
        </div>
      </div>

      {roster.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-dotted border-line pt-3 font-sans text-xs">
          {roster.map((n) => (
            <span key={n} className="inline-flex items-center gap-1.5 text-dim">
              <span className="h-[3px] w-5 rounded-full" style={{ backgroundColor: colorFor(n, roster) }} />
              {n}
              {n === myName ? " (you)" : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, cents, dim }: { label: string; cents: number; dim?: boolean }) {
  return (
    <div className={`flex items-baseline gap-2 ${dim ? "text-dim" : "text-ink"}`}>
      <span>{label}</span>
      <span className="mx-1 flex-1 border-b border-dotted border-line" />
      <span className="tabular-nums">{formatCents(cents)}</span>
    </div>
  );
}

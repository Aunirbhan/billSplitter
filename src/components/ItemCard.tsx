import { formatCents, itemShare } from "../split";
import type { BillItem } from "../types";
import { vibrate } from "../store";
import { colorFor, initials } from "../people";

/**
 * Card view: one tap claims for you; the roster renders as colored name
 * chips so anyone at the table can be attributed to the item in their color.
 */
export function ItemCard({
  item,
  claimed,
  cashPaid,
  flash,
  roster,
  myName,
  assigned,
  onTap,
  onCash,
  onAssign,
  onSplit,
}: {
  item: BillItem;
  claimed: boolean;
  cashPaid: boolean;
  flash?: boolean;
  roster: string[];
  myName: string;
  /** other people (never me) attributed to this item on this phone */
  assigned: string[];
  onTap: () => void;
  onCash?: () => void;
  onAssign?: (name: string) => void;
  /** guest-local adjustment of how many people shared this item */
  onSplit?: (n: number) => void;
}) {
  const share = itemShare(item);
  const eaters = (claimed ? 1 : 0) + assigned.length;
  const showChips = roster.length > 0 && onAssign;

  return (
    <div
      className={`w-full rounded-3xl border transition-all ${flash ? "flash-edit" : ""} ${
        claimed
          ? cashPaid
            ? "border-money/50 bg-money/10"
            : "border-accent/60 bg-accent/10"
          : "border-line bg-card"
      }`}
    >
      <button
        onClick={() => {
          vibrate();
          onTap();
        }}
        className="w-full p-4 text-left active:opacity-80"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-base font-medium text-ink">{item.label}</span>
              {item.split > 1 && (
                <span className="shrink-0 rounded-full bg-card-hi px-2 py-0.5 text-xs text-dim">÷{item.split}</span>
              )}
            </div>
            {claimed && (
              <div className={`mt-0.5 flex flex-wrap items-center gap-x-3 text-sm ${cashPaid ? "text-money" : "text-accent"}`}>
                <span className="font-medium">
                  {cashPaid ? `paid ${formatCents(share)} cash ✓` : `your share ${formatCents(share)}`}
                </span>
                {onCash && (
                  <span
                    role="button"
                    tabIndex={0}
                    className="text-dim underline decoration-dotted"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCash();
                    }}
                  >
                    {cashPaid ? "undo" : "paid cash?"}
                  </span>
                )}
                {onSplit && !cashPaid && eaters <= 1 && (
                  <span className="inline-flex items-center gap-1 text-dim" onClick={(e) => e.stopPropagation()}>
                    <span>shared by</span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="grid size-6 place-items-center rounded-full border border-line bg-card-hi text-base leading-none active:text-ink"
                      onClick={() => onSplit(item.split - 1)}
                    >
                      −
                    </span>
                    <span className="min-w-4 text-center font-semibold text-ink">{item.split}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="grid size-6 place-items-center rounded-full border border-line bg-card-hi text-base leading-none active:text-ink"
                      onClick={() => onSplit(item.split + 1)}
                    >
                      +
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* stacked colored dots — who's on this item */}
            {(assigned.length > 0 || claimed) && (
              <div className="flex -space-x-1.5">
                {claimed && (
                  <span
                    className="grid size-6 place-items-center rounded-full text-[10px] font-bold text-white ring-2 ring-card"
                    style={{ backgroundColor: myName ? colorFor(myName, roster) : "var(--accent)" }}
                  >
                    {myName ? initials(myName) : "✓"}
                  </span>
                )}
                {assigned.slice(0, 4).map((n) => (
                  <span
                    key={n}
                    className="grid size-6 place-items-center rounded-full text-[10px] font-bold text-white ring-2 ring-card"
                    style={{ backgroundColor: colorFor(n, roster) }}
                  >
                    {initials(n)}
                  </span>
                ))}
                {assigned.length > 4 && (
                  <span className="grid size-6 place-items-center rounded-full bg-card-hi text-[10px] font-bold text-dim ring-2 ring-card">
                    +{assigned.length - 4}
                  </span>
                )}
              </div>
            )}
            <span className="text-base font-semibold tabular-nums text-ink">{formatCents(item.cents)}</span>
          </div>
        </div>
      </button>

      {/* roster chips — attribute anyone in their color */}
      {showChips && (
        <div className="scrollbar-none -mt-1 flex gap-1.5 overflow-x-auto px-4 pb-3">
          {roster.map((n) => {
            const isMe = n === myName;
            const active = isMe ? claimed : assigned.includes(n);
            const c = colorFor(n, roster);
            return (
              <button
                key={n}
                onClick={() => {
                  vibrate();
                  if (isMe) onTap();
                  else onAssign?.(n);
                }}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  active ? "text-white" : "text-dim"
                }`}
                style={
                  active
                    ? { backgroundColor: c, borderColor: c }
                    : { borderColor: "var(--line)", backgroundColor: "var(--card-hi)" }
                }
              >
                {n}
                {isMe ? " (you)" : ""}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

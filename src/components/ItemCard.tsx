import { formatCents, itemShare } from "../split";
import type { BillItem } from "../types";
import { vibrate } from "../store";

/**
 * The product lives in this component: one tap claims, the card lights up
 * in your color, and your share appears under the price.
 */
export function ItemCard({
  item,
  claimed,
  cashPaid,
  flash,
  onTap,
  onCash,
  onSplit,
}: {
  item: BillItem;
  claimed: boolean;
  cashPaid: boolean;
  flash?: boolean;
  onTap: () => void;
  onCash?: () => void;
  /** guest-local adjustment of how many people shared this item */
  onSplit?: (n: number) => void;
}) {
  const share = itemShare(item);
  const shared = item.split > 1;

  return (
    <button
      onClick={() => {
        vibrate();
        onTap();
      }}
      className={`w-full rounded-2xl border p-4 text-left transition-all ${flash ? "flash-edit" : ""} ${
        claimed
          ? cashPaid
            ? "border-mint/60 bg-mint/10"
            : "border-amber/70 bg-amber/10"
          : "border-line bg-card active:bg-card-hi"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`truncate text-base font-medium ${claimed ? "" : "text-ink"}`}>{item.label}</span>
            {shared && (
              <span className="shrink-0 rounded-full bg-card-hi px-2 py-0.5 text-xs text-dim">÷{item.split}</span>
            )}
          </div>
          {claimed && (
            <div className={`mt-0.5 flex flex-wrap items-center gap-x-3 text-sm ${cashPaid ? "text-mint" : "text-amber"}`}>
              <span>{cashPaid ? `paid ${formatCents(share)} cash ✓` : `your share ${formatCents(share)}`}</span>
              {onSplit && !cashPaid && (
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
              {onCash && !cashPaid && (
                <span
                  role="button"
                  tabIndex={0}
                  className="ml-3 text-dim underline decoration-dotted"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCash();
                  }}
                >
                  paid cash?
                </span>
              )}
              {onCash && cashPaid && (
                <span
                  role="button"
                  tabIndex={0}
                  className="ml-3 text-dim underline decoration-dotted"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCash();
                  }}
                >
                  undo
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold tabular-nums text-ink">{formatCents(item.cents)}</span>
          <span
            className={`grid size-6 shrink-0 place-items-center rounded-full border text-sm transition-colors ${
              claimed ? (cashPaid ? "border-mint bg-mint text-black" : "border-amber bg-amber text-black") : "border-line text-transparent"
            }`}
          >
            ✓
          </span>
        </div>
      </div>
    </button>
  );
}

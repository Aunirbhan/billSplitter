import { useStore } from "../store";
import { go } from "../router";
import { formatCents } from "../split";
import { computedTotal } from "../split";
import { Button } from "../components/ui";

export function Landing() {
  const bills = useStore((s) => s.bills);
  const removeBill = useStore((s) => s.removeBill);
  const list = Object.values(bills).sort((a, b) => b.savedAt - a.savedAt);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5">
      <div className="safe-top flex items-center justify-between pt-6">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">billSplitter</h1>
          <p className="mt-1 text-dim">Snap the bill. Text the link. Everyone taps what they ate.</p>
        </div>
        <button
          onClick={() => go("/settings")}
          className="rounded-full border border-line bg-card p-3 text-dim active:text-ink"
          aria-label="Settings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.6 1.6 0 0 0 .33 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.33 1.6 1.6 0 0 0-1 1.47V21a2 2 0 1 1-4 0v-.09a1.6 1.6 0 0 0-1-1.47 1.6 1.6 0 0 0-1.77.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.9 15a1.6 1.6 0 0 0-1.47-1H3.3a2 2 0 1 1 0-4h.09a1.6 1.6 0 0 0 1.47-1 1.6 1.6 0 0 0-.33-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.77.33h.13a1.6 1.6 0 0 0 1-1.47V3.3a2 2 0 1 1 4 0v.09a1.6 1.6 0 0 0 1 1.47h.13a1.6 1.6 0 0 0 1.77-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.33 1.77v.13a1.6 1.6 0 0 0 1.47 1h.09a2 2 0 1 1 0 4h-.09a1.6 1.6 0 0 0-1.47 1z" />
          </svg>
        </button>
      </div>

      <div className="mt-8">
        <Button className="w-full py-5 text-lg" onClick={() => go("/scan")}>
          📸 &nbsp;Snap a bill
        </Button>
        <p className="mt-2 text-center text-sm text-dim">
          Joining someone else's bill? Just open the link they texted you.
        </p>
      </div>

      {list.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-dim">My bills</h2>
          <div className="space-y-2">
            {list.map((sb) => (
              <div key={sb.id} className="flex items-center gap-2">
                <button
                  onClick={() => go(`/bill/${sb.id}`)}
                  className="flex flex-1 items-center justify-between rounded-2xl border border-line bg-card px-4 py-4 text-left active:bg-card-hi"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{sb.bill.title}</div>
                    <div className="text-sm text-dim">
                      {sb.role === "host" ? "you hosted" : "you joined"} ·{" "}
                      {new Date(sb.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-dim">
                    {formatCents(sb.bill.totalCents || computedTotal(sb.bill))}
                  </span>
                </button>
                <button
                  onClick={() => confirm(`Delete "${sb.bill.title}" from this device?`) && removeBill(sb.id)}
                  className="grid size-11 shrink-0 place-items-center rounded-2xl border border-line text-dim active:text-danger"
                  aria-label="Delete bill"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto pb-6 pt-10 text-center text-xs text-dim/60">
        Bills live on your phone and inside the links you share.
        <br />
        No accounts, no server, no tracking. · by aunirbhan
      </div>
    </div>
  );
}

import { useState } from "react";
import type { Bill } from "../types";
import { formatCents } from "../split";
import { Sheet, Button } from "./ui";

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Payment happens in the host's own apps — we just compose the deep links.
 * Every method also gets a copy button because URL schemes break silently.
 */
export function PaySheet({
  open,
  onClose,
  bill,
  owedCents,
  myName,
}: {
  open: boolean;
  onClose: () => void;
  bill: Bill;
  owedCents: number;
  myName: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const host = bill.host;
  const note = encodeURIComponent(`${bill.title} — ${myName || "me"}`);
  const amt = dollars(owedCents);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* older browsers */
    }
  };

  const rows: { label: string; handle: string; href?: string }[] = [];
  if (host.venmo)
    rows.push({
      label: "Venmo",
      handle: `@${host.venmo.replace(/^@/, "")}`,
      href: `https://venmo.com/${host.venmo.replace(/^@/, "")}?txn=pay&amount=${amt}&note=${note}`,
    });
  if (host.cashapp)
    rows.push({
      label: "Cash App",
      handle: `$${host.cashapp.replace(/^\$/, "")}`,
      href: `https://cash.app/$${host.cashapp.replace(/^\$/, "")}/${amt}`,
    });
  if (host.paypal)
    rows.push({
      label: "PayPal",
      handle: host.paypal,
      href: `https://paypal.me/${host.paypal}/${amt}`,
    });
  if (host.zelle) rows.push({ label: "Zelle", handle: host.zelle });

  const shareTotal = () => {
    const text = `${bill.title}: I owe ${host.name} ${formatCents(owedCents)} 🧾`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else copy("total", text);
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="mb-1 text-sm text-dim">You owe {host.name}</div>
      <div className="mb-5 text-4xl font-bold tabular-nums text-money">{formatCents(owedCents)}</div>

      {rows.length === 0 && (
        <p className="mb-4 text-dim">
          {host.name} hasn't added payment links — settle in person or over text.
        </p>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            {r.href ? (
              <a
                href={r.href}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center justify-between rounded-2xl border border-line bg-card-hi px-4 py-3.5 active:bg-line"
              >
                <span className="font-semibold">{r.label}</span>
                <span className="text-dim">{r.handle}</span>
              </a>
            ) : (
              <div className="flex flex-1 items-center justify-between rounded-2xl border border-line bg-card-hi px-4 py-3.5">
                <span className="font-semibold">{r.label}</span>
                <span className="text-dim">{r.handle}</span>
              </div>
            )}
            <button
              onClick={() => copy(r.label, r.handle)}
              className="grid size-12 shrink-0 place-items-center rounded-2xl border border-line bg-card-hi text-dim active:text-ink"
              aria-label={`Copy ${r.label} handle`}
            >
              {copied === r.label ? "✓" : "⧉"}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-5 flex gap-2">
        <Button kind="ghost" className="flex-1" onClick={shareTotal}>
          Text my total
        </Button>
        <Button kind="mint" className="flex-1" onClick={onClose}>
          Done
        </Button>
      </div>
    </Sheet>
  );
}

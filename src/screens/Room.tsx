import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store";
import { go } from "../router";
import { decodeBill, billId } from "../codec";
import { evenShare, extrasCents, formatCents, myTotal } from "../split";
import { ItemCard } from "../components/ItemCard";
import { PaySheet } from "../components/PaySheet";
import { ShareSheet } from "../components/ShareSheet";
import { AnimatedMoney, Button, Sheet, Field } from "../components/ui";

/**
 * The room. Works identically whether you got here from a shared link
 * (#/r/<blob>) or from "My bills" (#/bill/<id>). Everything is computed
 * on this phone — the link carried the whole bill.
 */
export function Room({ blob, savedId }: { blob?: string; savedId?: string }) {
  const store = useStore();
  const [expanded, setExpanded] = useState(false);
  const [paying, setPaying] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [decodeFailed, setDecodeFailed] = useState(false);

  // Resolve the bill: from a saved entry, or decode the link and save it.
  const resolvedId = useMemo(() => {
    if (savedId) return store.bills[savedId] ? savedId : null;
    if (blob) {
      const bill = decodeBill(blob);
      if (!bill) return null;
      return billId(bill);
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob, savedId]);

  useEffect(() => {
    if (savedId) return;
    if (!blob) return;
    const bill = decodeBill(blob);
    if (!bill) {
      setDecodeFailed(true);
      return;
    }
    const isMine = store.settings.name && bill.host.name === store.settings.name;
    store.saveBill(bill, isMine ? "host" : "guest");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob, savedId]);

  const saved = resolvedId ? store.bills[resolvedId] : undefined;

  if (decodeFailed || (!saved && !blob)) {
    return (
      <div className="mx-auto grid min-h-dvh max-w-md place-items-center px-8 text-center">
        <div>
          <div className="text-5xl">🫥</div>
          <h1 className="mt-3 text-xl font-bold">That link didn't work</h1>
          <p className="mt-1 text-dim">Ask for it to be sent again — the whole bill lives inside the link.</p>
          <Button className="mt-5" onClick={() => go("/")}>
            Home
          </Button>
        </div>
      </div>
    );
  }
  if (!saved) return null; // decoding effect hasn't committed yet

  const bill = saved.bill;
  const totals = myTotal(bill, saved.claims, saved.cash);
  const needsName = !saved.myName;
  const iAmHost = saved.role === "host";

  const setName = () => {
    const n = nameInput.trim();
    if (!n) return;
    store.updateBill(saved.id, { myName: n });
    if (!store.settings.name) store.setSettings({ name: n });
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="safe-top sticky top-0 z-40 border-b border-line bg-bg/90 px-5 pb-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => go("/")} className="-ml-1 rounded-full p-1.5 text-dim active:text-ink" aria-label="Home">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">{bill.title}</h1>
            <p className="text-xs text-dim">
              {bill.people} people · even split {formatCents(evenShare(bill))} each · from {bill.host.name}
            </p>
          </div>
          <button
            onClick={() => setSharing(true)}
            className="rounded-full border border-line bg-card p-2.5 text-dim active:text-ink"
            aria-label="Share room"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-2 px-5 py-4 pb-40">
        <p className="pb-1 text-sm text-dim">Tap everything {saved.myName ? `you` : "you"} had — shared plates count once each.</p>
        {bill.items.map((it) => (
          <ItemCard
            key={it.id}
            item={it}
            claimed={saved.claims.includes(it.id)}
            cashPaid={saved.cash.includes(it.id)}
            onTap={() => store.toggleClaim(saved.id, it.id)}
            onCash={() => store.toggleCash(saved.id, it.id)}
          />
        ))}
        <div className="pt-2 text-center text-xs text-dim/70">
          Your picks stay on your phone. When you're done, hit <b>Settle up</b> below
          {iAmHost ? " — and others do the same from your link." : ` and pay ${bill.host.name}.`}
        </div>
      </div>

      {/* The growing total */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-line bg-bg/95 px-5 pt-3 backdrop-blur">
        <button className="flex w-full items-center justify-between py-1" onClick={() => setExpanded(!expanded)}>
          <div className="text-left">
            <div className="text-xs uppercase tracking-wide text-dim">You owe</div>
            <AnimatedMoney cents={totals.owedCents} className="text-3xl font-extrabold text-mint" />
          </div>
          <span className="text-dim">{expanded ? "▾ hide" : "▴ breakdown"}</span>
        </button>

        {expanded && (
          <div className="space-y-1.5 border-t border-line py-3 text-sm">
            {bill.items
              .filter((it) => saved.claims.includes(it.id))
              .map((it) => {
                const cash = saved.cash.includes(it.id);
                return (
                  <div key={it.id} className={`flex justify-between ${cash ? "text-dim line-through" : ""}`}>
                    <span>
                      {it.label}
                      {it.split > 1 ? ` ÷${it.split}` : ""}
                      {cash ? " (cash)" : ""}
                    </span>
                    <span className="tabular-nums">{formatCents(Math.ceil(it.cents / it.split))}</span>
                  </div>
                );
              })}
            <div className="flex justify-between text-dim">
              <span>
                tax + tip + fees ({formatCents(extrasCents(bill))} ÷ {bill.people})
              </span>
              <span className="tabular-nums">{formatCents(totals.extrasCents)}</span>
            </div>
            {totals.cashCents > 0 && (
              <div className="flex justify-between text-mint">
                <span>already paid in cash</span>
                <span className="tabular-nums">−{formatCents(totals.cashCents)}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 pb-1 pt-1">
          <Button kind="mint" className="w-full py-4 text-lg" onClick={() => setPaying(true)}>
            Settle up →
          </Button>
        </div>
      </div>

      <PaySheet open={paying} onClose={() => setPaying(false)} bill={bill} owedCents={totals.owedCents} myName={saved.myName} />
      <ShareSheet open={sharing} onClose={() => setSharing(false)} bill={bill} />

      {/* First-open name gate */}
      <Sheet open={needsName} onClose={() => {}}>
        <h2 className="mb-1 text-xl font-bold">
          {bill.host.name} split the bill from {bill.title.split("·")[0].trim()} 🧾
        </h2>
        <p className="mb-4 text-dim">Add your name, then tap what you ate — your total adds up as you go.</p>
        <Field label="Your name" value={nameInput} onChange={setNameInput} placeholder="Bob" />
        <Button className="mt-4 w-full py-4" disabled={!nameInput.trim()} onClick={setName}>
          Let's eat the consequences →
        </Button>
      </Sheet>
    </div>
  );
}

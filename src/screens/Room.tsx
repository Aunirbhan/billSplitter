import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store";
import { go } from "../router";
import { decodeBill, billId } from "../codec";
import { applySplits, evenShare, extrasCents, formatCents, itemShare, myTotal, withAttribution } from "../split";
import { colorFor } from "../people";
import { ItemCard } from "../components/ItemCard";
import { ReceiptView } from "../components/ReceiptView";
import { PaySheet } from "../components/PaySheet";
import { ShareSheet } from "../components/ShareSheet";
import { AnimatedMoney, Button, Sheet, Field } from "../components/ui";

/**
 * The room. Two ways to see the same bill:
 *   cards   — big tappable items, roster chips for color-coded attribution
 *   receipt — the whole bill as one printed sheet, colored person-lines per item
 * Reached from a shared link (#/r/<blob>) or from "My bills" (#/bill/<id>).
 */
export function Room({ blob, savedId }: { blob?: string; savedId?: string }) {
  const store = useStore();
  const [view, setView] = useState<"cards" | "receipt">("cards");
  const [expanded, setExpanded] = useState(false);
  const [paying, setPaying] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [decodeFailed, setDecodeFailed] = useState(false);
  const [justMine, setJustMine] = useState(false);

  const resolvedId = useMemo(() => {
    if (savedId) return savedId;
    if (blob) {
      const bill = decodeBill(blob);
      if (!bill) return null;
      return billId(bill);
    }
    return null;
  }, [blob, savedId]);

  useEffect(() => {
    if (savedId || !blob) return;
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
          <h1 className="font-display mt-3 text-xl font-bold">That link didn't work</h1>
          <p className="mt-1 text-dim">Ask for it to be sent again — the whole bill lives inside the link.</p>
          <Button className="mt-5" onClick={() => go("/")}>
            Home
          </Button>
        </div>
      </div>
    );
  }
  if (!saved) return null; // decoding effect hasn't committed yet

  const assign = saved.assign ?? {};
  const roster = saved.bill.roster ?? [];
  // attribution adjusts head-counts; explicit local overrides win last
  const bill = applySplits(withAttribution(saved.bill, saved.claims, assign), saved.splits ?? {});
  const totals = myTotal(bill, saved.claims, saved.cash);
  const needsName = !saved.myName;
  const iAmHost = saved.role === "host";
  const longList = bill.items.length > 10;
  const visibleItems = justMine ? bill.items.filter((it) => saved.claims.includes(it.id)) : bill.items;

  const setName = () => {
    const n = nameInput.trim();
    if (!n) return;
    store.updateBill(saved.id, { myName: n });
    if (!store.settings.name) store.setSettings({ name: n });
  };

  const editAsHost = () => {
    store.setDraft(saved.bill);
    store.setDraftNote(null);
    go("/review");
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
            <h1 className="font-display truncate text-xl font-bold">{bill.title}</h1>
            <p className="text-xs text-dim">
              even split {formatCents(evenShare(bill))} each · from {bill.host.name}
            </p>
          </div>
          {iAmHost && (
            <button
              onClick={editAsHost}
              className="rounded-full border border-line bg-card p-2.5 text-dim active:text-ink"
              aria-label="Edit bill"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setSharing(true)}
            className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink active:scale-[0.97]"
            aria-label="Share room"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Share
          </button>
        </div>

        {/* view toggle */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex rounded-full border border-line bg-card p-0.5">
            {(["cards", "receipt"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                  view === v ? "bg-accent text-accent-ink" : "text-dim"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          {longList && view === "cards" && (
            <button
              onClick={() => setJustMine(!justMine)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
                justMine ? "border-accent bg-accent/15 text-accent" : "border-line bg-card text-dim"
              }`}
            >
              {justMine ? `mine (${saved.claims.length}) ✕` : "just mine"}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-2 px-5 py-4 pb-44">
        {view === "cards" ? (
          <>
            <p className="pb-1 text-sm text-dim">
              Tap what you had{roster.length > 0 ? " — or tag anyone by name" : " — shared plates count once each"}.
            </p>
            {visibleItems.map((it) => (
              <ItemCard
                key={it.id}
                item={it}
                claimed={saved.claims.includes(it.id)}
                cashPaid={saved.cash.includes(it.id)}
                roster={roster}
                myName={saved.myName}
                assigned={(assign[it.id] ?? []).filter((n) => n !== saved.myName)}
                onTap={() => store.toggleClaim(saved.id, it.id)}
                onCash={() => store.toggleCash(saved.id, it.id)}
                onAssign={(n) => store.toggleAssign(saved.id, it.id, n)}
                onSplit={(n) => store.setSplit(saved.id, it.id, n)}
              />
            ))}
            {justMine && visibleItems.length === 0 && (
              <div className="rounded-3xl border border-dashed border-line py-8 text-center text-dim">
                Nothing claimed yet — switch off "just mine" and start tapping.
              </div>
            )}
          </>
        ) : (
          <ReceiptView
            bill={bill}
            roster={roster}
            myName={saved.myName}
            claims={saved.claims}
            cash={saved.cash}
            assign={assign}
            onTapItem={(id) => store.toggleClaim(saved.id, id)}
          />
        )}
      </div>

      {/* The growing total */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-line bg-bg/95 px-5 pt-3 backdrop-blur">
        <button className="flex w-full items-center justify-between py-1" onClick={() => setExpanded(!expanded)}>
          <div className="text-left">
            <div className="text-xs uppercase tracking-wide text-dim">You owe</div>
            <AnimatedMoney cents={totals.owedCents} className="font-display text-3xl font-extrabold text-money" />
          </div>
          <span className="text-sm text-dim">{expanded ? "hide ▾" : "breakdown ▴"}</span>
        </button>

        {expanded && (
          <div className="space-y-1.5 border-t border-line py-3 text-sm">
            {bill.items
              .filter((it) => saved.claims.includes(it.id))
              .map((it) => {
                const isCash = saved.cash.includes(it.id);
                return (
                  <div key={it.id} className={`flex justify-between ${isCash ? "text-dim line-through" : ""}`}>
                    <span>
                      {it.label}
                      {it.split > 1 ? ` ÷${it.split}` : ""}
                      {isCash ? " (cash)" : ""}
                    </span>
                    <span className="tabular-nums">{formatCents(itemShare(it))}</span>
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
              <div className="flex justify-between text-money">
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
      <ShareSheet open={sharing} onClose={() => setSharing(false)} bill={saved.bill} />

      {/* First-open name gate */}
      <Sheet open={needsName} onClose={() => {}}>
        <h2 className="font-display mb-1 text-2xl font-bold">
          {bill.host.name} split the bill 🧾
        </h2>
        <p className="mb-4 text-dim">
          {roster.length > 0 ? "Who are you? Tap your name," : "Add your name,"} then tap what you ate — your total adds up
          as you go.
        </p>
        {roster.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {roster.map((n) => (
              <button
                key={n}
                onClick={() => setNameInput(n)}
                className={`rounded-full border px-4 py-2 text-sm font-medium ${
                  nameInput === n ? "text-white" : "text-ink"
                }`}
                style={
                  nameInput === n
                    ? { backgroundColor: colorFor(n, roster), borderColor: colorFor(n, roster) }
                    : { borderColor: "var(--line)", backgroundColor: "var(--card-hi)" }
                }
              >
                {n}
              </button>
            ))}
          </div>
        )}
        <Field label={roster.length > 0 ? "…or type a name" : "Your name"} value={nameInput} onChange={setNameInput} placeholder="Bob" />
        <Button className="mt-4 w-full py-4" disabled={!nameInput.trim()} onClick={setName}>
          Start tapping →
        </Button>
      </Sheet>
    </div>
  );
}

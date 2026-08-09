import { useState } from "react";
import { useStore } from "../store";
import { go } from "../router";
import { computedTotal, discrepancy, formatCents, itemsSubtotal, newId, parseMoney } from "../split";
import { aiReady, editBill, friendlyError } from "../ai";
import { colorFor } from "../people";
import { CommandBar } from "../components/CommandBar";
import { ShareSheet } from "../components/ShareSheet";
import { Button, Field, Stepper, TopBar } from "../components/ui";
import type { Bill } from "../types";

function MoneyInput({ cents, onChange }: { cents: number; onChange: (c: number) => void }) {
  // Buffer only while focused, otherwise mirror the prop — so AI/voice edits
  // that change the bill are reflected immediately in every field.
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <input
      inputMode="decimal"
      value={editing ?? (cents / 100).toFixed(2)}
      onFocus={(e) => {
        setEditing((cents / 100).toFixed(2));
        e.target.select();
      }}
      onChange={(e) => {
        setEditing(e.target.value);
        const c = parseMoney(e.target.value);
        if (c !== null) onChange(c);
      }}
      onBlur={() => setEditing(null)}
      className="w-24 rounded-lg border border-line bg-card-hi px-2 py-1.5 text-right tabular-nums focus:border-accent focus:outline-none"
    />
  );
}

export function Review() {
  const draft = useStore((s) => s.draft);
  const setDraft = useStore((s) => s.setDraft);
  const saveBill = useStore((s) => s.saveBill);
  const apiKey = useStore((s) => s.settings.apiKey);
  const draftNote = useStore((s) => s.draftNote);
  const setDraftNote = useStore((s) => s.setDraftNote);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [flashIds, setFlashIds] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);
  const [nameInput, setNameInput] = useState("");

  if (!draft) {
    go("/scan");
    return null;
  }
  const bill = draft;
  const delta = discrepancy(bill);

  const patch = (p: Partial<Bill>) => setDraft({ ...bill, ...p });
  const patchItem = (id: string, p: Partial<Bill["items"][number]>) =>
    patch({ items: bill.items.map((it) => (it.id === id ? { ...it, ...p } : it)) });

  const applyAi = async (instruction: string) => {
    if (!aiReady(apiKey)) {
      setAiError("Scanning isn't set up for this build — edit by tapping the fields instead.");
      return;
    }
    setAiBusy(true);
    setAiError(null);
    try {
      const { bill: edited, changedIds, question } = await editBill(apiKey, bill, instruction, draftNote);
      setDraft(edited);
      setDraftNote(question); // model may ask a follow-up, or clear it
      setFlashIds(changedIds);
      setTimeout(() => setFlashIds([]), 1300);
    } catch (e) {
      setAiError(friendlyError(e));
    } finally {
      setAiBusy(false);
    }
  };

  const addName = () => {
    const n = nameInput.trim();
    if (!n) return;
    const roster = [...(bill.roster ?? []), n].filter((v, i, a) => a.indexOf(v) === i);
    patch({ roster, people: Math.max(bill.people, roster.length) });
    setNameInput("");
  };

  const openRoom = () => {
    const id = saveBill(bill, "host");
    setSharing(false);
    go(`/bill/${id}`);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <TopBar title="Check the bill" back={() => go("/scan")} />

      <div className="flex-1 space-y-4 px-5 py-4 pb-44">
        {draftNote && (
          <div className="pop-in flex items-start gap-2.5 rounded-3xl border border-accent/50 bg-accent/10 p-4">
            <span className="text-xl">🤔</span>
            <div className="flex-1">
              <p className="text-sm">{draftNote}</p>
              <p className="mt-1 text-xs text-dim">Answer by typing or speaking below — or fix the fields by hand.</p>
            </div>
            <button onClick={() => setDraftNote(null)} className="text-dim" aria-label="Dismiss">
              ✕
            </button>
          </div>
        )}

        <Field label="Bill name" value={bill.title} onChange={(v) => patch({ title: v })} />

        <div className="space-y-2">
          {bill.items.map((it) => (
            <div
              key={it.id}
              className={`rounded-2xl border border-line bg-card p-3 ${flashIds.includes(it.id) ? "flash-edit" : ""}`}
            >
              <div className="flex items-center gap-2">
                <input
                  value={it.label}
                  onChange={(e) => patchItem(it.id, { label: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 focus:border-line focus:bg-card-hi focus:outline-none"
                />
                <MoneyInput cents={it.cents} onChange={(c) => patchItem(it.id, { cents: c })} />
                <button
                  onClick={() => patch({ items: bill.items.filter((x) => x.id !== it.id) })}
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-dim active:text-danger"
                  aria-label={`Remove ${it.label}`}
                >
                  ✕
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between px-1">
                <span className="text-xs text-dim">shared by</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => patchItem(it.id, { split: it.split === bill.people ? 1 : bill.people })}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      it.split === bill.people && bill.people > 1
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-line bg-card-hi text-dim"
                    }`}
                  >
                    everyone
                  </button>
                  <Stepper value={it.split} onChange={(v) => patchItem(it.id, { split: v })} suffix="" />
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={() => patch({ items: [...bill.items, { id: newId(), label: "New item", cents: 0, split: 1 }] })}
            className="w-full rounded-2xl border border-dashed border-line py-3 text-dim active:text-ink"
          >
            + Add item
          </button>
        </div>

        <div className="space-y-2 rounded-2xl border border-line bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-dim">Items</span>
            <span className="tabular-nums">{formatCents(itemsSubtotal(bill))}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-dim">Tax</span>
            <MoneyInput cents={bill.taxCents} onChange={(c) => patch({ taxCents: c })} />
          </div>
          {bill.fees.map((f, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-dim">{f.label}</span>
              <MoneyInput
                cents={f.cents}
                onChange={(c) => patch({ fees: bill.fees.map((x, j) => (j === i ? { ...x, cents: c } : x)) })}
              />
            </div>
          ))}
          <div className="flex items-center justify-between">
            <span className="text-dim">Tip</span>
            <MoneyInput cents={bill.tipCents} onChange={(c) => patch({ tipCents: c })} />
          </div>
          <div className="flex items-center justify-between border-t border-line pt-2 font-semibold">
            <span>Adds up to</span>
            <span className="tabular-nums">{formatCents(computedTotal(bill))}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-dim">Printed total</span>
            <MoneyInput cents={bill.totalCents} onChange={(c) => patch({ totalCents: c })} />
          </div>
          {bill.totalCents > 0 && (
            <div
              className={`rounded-lg px-3 py-2 text-center text-sm font-medium ${
                delta === 0 ? "bg-money/10 text-money" : "bg-danger/10 text-danger"
              }`}
            >
              {delta === 0
                ? "Balances to $0.00 ✓"
                : `${formatCents(Math.abs(delta))} ${delta > 0 ? "over" : "under"} the printed total — fix a line or say what's wrong below`}
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-3xl border border-line bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">How many people?</div>
              <div className="text-sm text-dim">tax, tip & fees split evenly</div>
            </div>
            <Stepper value={bill.people} onChange={(v) => patch({ people: v })} min={Math.max(1, (bill.roster ?? []).length)} />
          </div>
          <div className="border-t border-line pt-3">
            <div className="mb-2 text-sm text-dim">
              Name the table <span className="text-dim/60">(optional)</span> — everyone gets a color, and tagging who ate
              what becomes one tap.
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(bill.roster ?? []).map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    const roster = (bill.roster ?? []).filter((x) => x !== n);
                    patch({ roster: roster.length ? roster : undefined });
                  }}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-white"
                  style={{ backgroundColor: colorFor(n, bill.roster ?? []) }}
                >
                  {n} ✕
                </button>
              ))}
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addName()}
                onBlur={() => nameInput.trim() && addName()}
                placeholder="+ add name"
                className="w-28 rounded-full border border-dashed border-line bg-transparent px-3 py-1.5 text-sm placeholder:text-dim/60 focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        </div>

        {aiError && <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{aiError}</div>}
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md space-y-3 border-t border-line bg-bg/95 px-5 pt-3 backdrop-blur">
        <CommandBar busy={aiBusy} onSubmit={applyAi} />
        <Button className="w-full py-4 text-lg" onClick={() => setSharing(true)}>
          Looks right — share with the table →
        </Button>
      </div>

      <ShareSheet
        open={sharing}
        onClose={() => setSharing(false)}
        bill={bill}
      />
      {sharing && (
        <div className="fixed bottom-4 left-1/2 z-[60] w-[calc(100%-2.5rem)] max-w-md -translate-x-1/2">
          <Button kind="mint" className="w-full" onClick={openRoom}>
            Open my view of the room →
          </Button>
        </div>
      )}
    </div>
  );
}

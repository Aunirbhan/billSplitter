import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Bill, SavedBill, Settings } from "./types";
import { billId } from "./codec";

interface TallyState {
  settings: Settings;
  setSettings: (patch: Partial<Settings>) => void;

  /** the bill the host is currently building */
  draft: Bill | null;
  setDraft: (bill: Bill | null) => void;

  /** every bill this device has hosted or joined, with my selections */
  bills: Record<string, SavedBill>;
  saveBill: (bill: Bill, role: "host" | "guest") => string;
  updateBill: (id: string, patch: Partial<SavedBill>) => void;
  toggleClaim: (id: string, itemId: string) => void;
  toggleCash: (id: string, itemId: string) => void;
  setSplit: (id: string, itemId: string, split: number) => void;
  removeBill: (id: string) => void;
}

export const useStore = create<TallyState>()(
  persist(
    (set, get) => ({
      settings: { name: "", apiKey: "", venmo: "", cashapp: "", zelle: "", paypal: "" },
      setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),

      draft: null,
      setDraft: (bill) => set({ draft: bill }),

      bills: {},
      saveBill: (bill, role) => {
        const id = billId(bill);
        const existing = get().bills[id];
        set({
          bills: {
            ...get().bills,
            [id]: existing
              ? { ...existing, bill } // refresh content, keep my claims
              : {
                  id,
                  bill,
                  role,
                  claims: [],
                  cash: [],
                  myName: get().settings.name,
                  savedAt: Date.now(),
                },
          },
        });
        return id;
      },
      updateBill: (id, patch) => {
        const b = get().bills[id];
        if (!b) return;
        set({ bills: { ...get().bills, [id]: { ...b, ...patch } } });
      },
      toggleClaim: (id, itemId) => {
        const b = get().bills[id];
        if (!b) return;
        const has = b.claims.includes(itemId);
        set({
          bills: {
            ...get().bills,
            [id]: {
              ...b,
              claims: has ? b.claims.filter((c) => c !== itemId) : [...b.claims, itemId],
              cash: has ? b.cash.filter((c) => c !== itemId) : b.cash,
            },
          },
        });
      },
      toggleCash: (id, itemId) => {
        const b = get().bills[id];
        if (!b) return;
        const has = b.cash.includes(itemId);
        const claims = b.claims.includes(itemId) ? b.claims : [...b.claims, itemId];
        set({
          bills: {
            ...get().bills,
            [id]: { ...b, claims, cash: has ? b.cash.filter((c) => c !== itemId) : [...b.cash, itemId] },
          },
        });
      },
      setSplit: (id, itemId, split) => {
        const b = get().bills[id];
        if (!b) return;
        set({
          bills: {
            ...get().bills,
            [id]: { ...b, splits: { ...(b.splits ?? {}), [itemId]: Math.max(1, split) } },
          },
        });
      },
      removeBill: (id) => {
        const bills = { ...get().bills };
        delete bills[id];
        set({ bills });
      },
    }),
    { name: "tally-v1" },
  ),
);

export function vibrate(ms = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* iOS: no-op */
  }
}

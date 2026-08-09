/** All money is integer cents. Floats never touch a dollar amount. */

export interface BillItem {
  id: string;
  label: string;
  /** line total for this card, cents */
  cents: number;
  /** how many people share this item (>= 1) — divides the price */
  split: number;
}

export interface Fee {
  label: string;
  cents: number;
}

export interface HostInfo {
  name: string;
  venmo?: string;
  cashapp?: string;
  zelle?: string;
  paypal?: string;
}

export interface Bill {
  v: 1;
  /** e.g. "Thai Palace · Aug 9" */
  title: string;
  items: BillItem[];
  taxCents: number;
  tipCents: number;
  fees: Fee[];
  /** printed receipt total; 0 = unknown */
  totalCents: number;
  /** party size — divides tax/tip/fees evenly */
  people: number;
  host: HostInfo;
  createdAt: number;
}

/** A bill saved on this device, with my local selections. */
export interface SavedBill {
  id: string;
  bill: Bill;
  role: "host" | "guest";
  /** item ids I claimed */
  claims: string[];
  /** item ids I claimed but already paid in cash */
  cash: string[];
  /** my local corrections to how many people shared an item */
  splits?: Record<string, number>;
  myName: string;
  savedAt: number;
}

export interface Settings {
  name: string;
  apiKey: string;
  venmo: string;
  cashapp: string;
  zelle: string;
  paypal: string;
}

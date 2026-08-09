import { describe, expect, it } from "vitest";
import {
  applySplits,
  withAttribution,
  computedTotal,
  discrepancy,
  divUp,
  evenShare,
  extrasShare,
  formatCents,
  itemShare,
  myTotal,
  parseMoney,
} from "./split";
import { decodeBill, encodeBill } from "./codec";
import type { Bill, BillItem } from "./types";

function bill(partial: Partial<Bill> = {}): Bill {
  return {
    v: 1,
    title: "Test",
    items: [],
    taxCents: 0,
    tipCents: 0,
    fees: [],
    totalCents: 0,
    people: 1,
    host: { name: "Das" },
    createdAt: 0,
    ...partial,
  };
}

function item(id: string, label: string, cents: number, split = 1): BillItem {
  return { id, label, cents, split };
}

describe("divUp", () => {
  it("rounds up in host favor", () => {
    expect(divUp(1499, 2)).toBe(750);
    expect(divUp(1500, 2)).toBe(750);
    expect(divUp(1000, 3)).toBe(334);
    expect(divUp(999, 1)).toBe(999);
    expect(divUp(0, 4)).toBe(0);
  });
});

describe("the Thai dinner — Das, Bob, Sam, Steve", () => {
  // 4 sodas $3 each; wings $14 shared Das+Bob; pad thai $16 (Das);
  // drunken noodles $15 (Sam); fried rice $12 shared Steve+Bob.
  // tax $4.60, service fee $2.00, tip $11.40 → extras $18, $4.50/person.
  const b = bill({
    items: [
      item("s1", "Soda", 300),
      item("s2", "Soda", 300),
      item("s3", "Soda", 300),
      item("s4", "Soda", 300),
      item("w", "Wings", 1400, 2),
      item("pt", "Pad Thai", 1600),
      item("dn", "Drunken Noodles", 1500),
      item("fr", "Fried Rice", 1200, 2),
    ],
    taxCents: 460,
    fees: [{ label: "Service", cents: 200 }],
    tipCents: 1140,
    totalCents: 8700, // 6900 items + 1800 extras
    people: 4,
  });

  it("bill reconciles", () => {
    expect(computedTotal(b)).toBe(8700);
    expect(discrepancy(b)).toBe(0);
  });

  it("extras split evenly", () => {
    expect(extrasShare(b)).toBe(450);
  });

  it("das: soda + half wings + pad thai + extras", () => {
    const t = myTotal(b, ["s1", "w", "pt"], []);
    expect(t.owedCents).toBe(300 + 700 + 1600 + 450); // 30.50
  });

  it("bob: soda + half wings + half fried rice + extras", () => {
    const t = myTotal(b, ["s2", "w", "fr"], []);
    expect(t.owedCents).toBe(300 + 700 + 600 + 450); // 20.50
  });

  it("sam: soda + drunken noodles + extras", () => {
    const t = myTotal(b, ["s3", "dn"], []);
    expect(t.owedCents).toBe(300 + 1500 + 450); // 22.50
  });

  it("steve: soda + half fried rice + extras", () => {
    const t = myTotal(b, ["s4", "fr"], []);
    expect(t.owedCents).toBe(300 + 600 + 450); // 13.50
  });

  it("everyone's shares cover the whole bill", () => {
    const das = myTotal(b, ["s1", "w", "pt"], []).owedCents;
    const bob = myTotal(b, ["s2", "w", "fr"], []).owedCents;
    const sam = myTotal(b, ["s3", "dn"], []).owedCents;
    const steve = myTotal(b, ["s4", "fr"], []).owedCents;
    expect(das + bob + sam + steve).toBeGreaterThanOrEqual(b.totalCents);
    // ceil rounding never overshoots by more than a cent per shared division
    expect(das + bob + sam + steve - b.totalCents).toBeLessThanOrEqual(4);
  });

  it("sam already paid cash for a thai tea", () => {
    const withTea = bill({
      ...b,
      items: [...b.items, item("tt", "Thai Tea", 600)],
      totalCents: 9300,
    });
    const t = myTotal(withTea, ["s3", "dn", "tt"], ["tt"]);
    expect(t.cashCents).toBe(600);
    expect(t.owedCents).toBe(300 + 1500 + 450); // tea excluded from owed
  });
});

describe("12-person table", () => {
  it("rounding stays within a cent per person", () => {
    const b = bill({
      items: [item("app", "Giant Appetizer Platter", 8999, 12)],
      taxCents: 1234,
      tipCents: 2000,
      fees: [{ label: "Large party fee", cents: 500 }],
      totalCents: 8999 + 1234 + 2000 + 500,
      people: 12,
    });
    const per = myTotal(b, ["app"], []).owedCents;
    const exact = (8999 + 1234 + 2000 + 500) / 12;
    expect(per).toBeGreaterThanOrEqual(Math.floor(exact));
    expect(per - exact).toBeLessThan(2); // ≤1¢ over on item + ≤1¢ on extras
    expect(per * 12).toBeGreaterThanOrEqual(b.totalCents);
  });
});

describe("property: totals always cover the bill", () => {
  it("random bills, random splits", () => {
    let seed = 42;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    for (let trial = 0; trial < 200; trial++) {
      const people = 2 + rand(10);
      const nItems = 1 + rand(15);
      const items: BillItem[] = [];
      for (let i = 0; i < nItems; i++) {
        items.push(item(`i${i}`, `Item ${i}`, 100 + rand(5000), 1 + rand(people)));
      }
      const b = bill({
        items,
        taxCents: rand(1000),
        tipCents: rand(2000),
        people,
        totalCents: 0,
      });
      b.totalCents = computedTotal(b);
      // every item fully claimed by exactly `split` people.
      // ceil-rounding overshoot: ≤ (split-1)¢ per item, ≤ (people-1)¢ on extras.
      let collected = 0;
      let bound = people - 1;
      for (const it of items) {
        collected += itemShare(it) * it.split;
        bound += it.split - 1;
      }
      collected += extrasShare(b) * people;
      expect(collected).toBeGreaterThanOrEqual(b.totalCents);
      expect(collected - b.totalCents).toBeLessThanOrEqual(bound);
    }
  });
});

describe("guest-local split overrides", () => {
  it("recomputes shares with my correction, without mutating the original", () => {
    const b = bill({
      items: [item("w", "Wings", 1400, 2), item("pt", "Pad Thai", 1600)],
      taxCents: 400,
      people: 4,
      totalCents: 3400,
    });
    // "actually 3 of us shared the wings"
    const mine = applySplits(b, { w: 3 });
    expect(myTotal(mine, ["w"], []).owedCents).toBe(467 + 100); // ceil(1400/3) + 400/4
    // original untouched
    expect(b.items[0].split).toBe(2);
    expect(myTotal(b, ["w"], []).owedCents).toBe(700 + 100);
  });

  it("clamps override to at least 1 and ignores unknown ids", () => {
    const b = bill({ items: [item("a", "X", 900)], people: 1 });
    const mine = applySplits(b, { a: 0, ghost: 5 });
    expect(mine.items[0].split).toBe(1);
    expect(mine.items.length).toBe(1);
  });

  it("no overrides returns the same object", () => {
    const b = bill({ items: [item("a", "X", 900)] });
    expect(applySplits(b, {})).toBe(b);
  });
});

describe("name attribution adjusts head-counts", () => {
  const b = bill({
    items: [item("w", "Wings", 1400, 2), item("pt", "Pad Thai", 1600)],
    taxCents: 400,
    people: 4,
  });

  it("attributed count matching host split changes nothing", () => {
    const adj = withAttribution(b, ["w"], { w: ["Bob"] }); // me + Bob = 2 = host's ÷2
    expect(adj.items[0].split).toBe(2);
    expect(myTotal(adj, ["w"], []).itemsCents).toBe(700);
  });

  it("more eaters than the host guessed raises the divide", () => {
    const adj = withAttribution(b, ["w"], { w: ["Bob", "Carol"] }); // 3 people now
    expect(adj.items[0].split).toBe(3);
    expect(myTotal(adj, ["w"], []).itemsCents).toBe(467);
  });

  it("never shrinks below the host's split, and explicit override wins last", () => {
    const adj = withAttribution(b, [], { w: ["Bob"] }); // 1 eater, host said 2
    expect(adj.items[0].split).toBe(2);
    const overridden = applySplits(withAttribution(b, ["w"], { w: ["Bob", "Carol"] }), { w: 5 });
    expect(overridden.items[0].split).toBe(5);
    expect(myTotal(overridden, ["w"], []).itemsCents).toBe(280);
  });

  it("untouched items pass through", () => {
    const adj = withAttribution(b, ["w"], { w: ["Bob"] });
    expect(adj.items[1]).toEqual(b.items[1]);
  });
});

describe("money parsing/formatting", () => {
  it("formats", () => {
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(5)).toBe("$0.05");
    expect(formatCents(2340)).toBe("$23.40");
    expect(formatCents(-150)).toBe("-$1.50");
  });
  it("parses", () => {
    expect(parseMoney("12.34")).toBe(1234);
    expect(parseMoney("$12.34")).toBe(1234);
    expect(parseMoney("12")).toBe(1200);
    expect(parseMoney(".99")).toBe(99);
    expect(parseMoney("12.3")).toBe(1230);
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("1.2.3")).toBeNull();
  });
});

describe("codec", () => {
  it("roundtrips a bill through the URL fragment", () => {
    const b = bill({
      title: "Thai Palace · Aug 9",
      items: [item("a", "Pad Thai", 1600), item("b", "Wings", 1400, 2)],
      taxCents: 300,
      tipCents: 500,
      fees: [{ label: "Service", cents: 150 }],
      totalCents: 3950,
      people: 4,
      host: { name: "Das", venmo: "das-v", zelle: "555-0142" },
      createdAt: 1754700000000,
    });
    const blob = encodeBill(b);
    expect(blob).not.toContain("#");
    expect(blob).not.toContain("&");
    const back = decodeBill(blob);
    expect(back).toEqual(b);
  });

  it("rejects junk", () => {
    expect(decodeBill("garbage!!!")).toBeNull();
    expect(decodeBill("")).toBeNull();
  });

  it("normalizes hostile numbers", () => {
    const b = bill({ items: [item("a", "X", 100)] });
    const raw = JSON.parse(JSON.stringify(b));
    raw.items[0].cents = -50;
    raw.items[0].split = 0;
    raw.people = -3;
    const blob = encodeBill(raw as Bill);
    const back = decodeBill(blob)!;
    expect(back.items[0].cents).toBe(0);
    expect(back.items[0].split).toBe(1);
    expect(back.people).toBe(1);
  });

  it("evenShare uses printed total when present", () => {
    const b = bill({ totalCents: 10000, people: 3, items: [item("a", "X", 100)] });
    expect(evenShare(b)).toBe(3334);
  });
});

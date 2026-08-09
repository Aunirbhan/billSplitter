import { useRef, useState } from "react";
import { useStore } from "../store";
import { go } from "../router";
import { aiReady, friendlyError, hasProxy, parseReceipt } from "../ai";
import { newId } from "../split";
import { Button, TopBar, Field } from "../components/ui";
import type { Bill } from "../types";

/** Downscale on-device: faster upload on restaurant signal, fewer image tokens. */
async function toJpegBase64(file: File, maxEdge = 1568): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Couldn't read that photo."));
      img.src = url;
    });
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  } finally {
    URL.revokeObjectURL(url);
  }
}

function emptyBill(hostName: string): Bill {
  const date = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return {
    v: 1,
    title: `Dinner · ${date}`,
    items: [{ id: newId(), label: "Item", cents: 0, split: 1 }],
    taxCents: 0,
    tipCents: 0,
    fees: [],
    totalCents: 0,
    people: 4,
    host: { name: hostName || "Host" },
    createdAt: Date.now(),
  };
}

export function Capture() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const setDraft = useStore((s) => s.setDraft);
  const setDraftNote = useStore((s) => s.setDraftNote);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const needsKey = !aiReady(settings.apiKey);

  const pick = (f: File) => {
    setFile(f);
    setNotice(null);
    const r = new FileReader();
    r.onload = () => setPreview(r.result as string);
    r.readAsDataURL(f);
  };

  const toReview = (bill: Omit<Bill, "host" | "people">, note: string | null) => {
    setDraft({
      ...bill,
      people: 4,
      host: {
        name: settings.name || "Host",
        venmo: settings.venmo || undefined,
        cashapp: settings.cashapp || undefined,
        zelle: settings.zelle || undefined,
        paypal: settings.paypal || undefined,
      },
    });
    setDraftNote(note);
    go("/review");
  };

  const parse = async () => {
    if (!file || needsKey) return;
    setBusy(true);
    setNotice(null);
    try {
      const b64 = await toJpegBase64(file);
      const scan = await parseReceipt(settings.apiKey, b64, "image/jpeg");
      switch (scan.status) {
        case "ok":
          toReview(scan.bill, null);
          break;
        case "incomplete":
        case "not_fully_in_view":
          // Take what was readable into review; the parser's question rides
          // along so voice/text can fill in the rest.
          if (scan.bill.items.length > 0) {
            toReview(scan.bill, scan.question ?? "Some info was missing — tell me what to fill in.");
          } else {
            setNotice(scan.question ?? "Couldn't read enough of that — retake with the whole receipt in frame.");
          }
          break;
        case "not_readable":
          setNotice(scan.question ?? "Too blurry to read — more light, receipt flat, try again.");
          break;
        case "not_a_bill":
          setNotice(scan.question ?? "That doesn't look like a receipt — snap the itemized bill.");
          break;
      }
    } catch (e) {
      setNotice(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const manual = () => {
    setDraft(emptyBill(settings.name));
    setDraftNote(null);
    go("/review");
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <TopBar title="Snap the bill" back={() => go("/")} />
      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        {needsKey && !hasProxy() && (
          <div className="rounded-3xl border border-accent/40 bg-accent/5 p-4">
            <div className="mb-1 font-semibold">Dev setup needed</div>
            <p className="mb-3 text-sm text-dim">
              No scan proxy is configured for this build, so scanning needs an Anthropic API key on this phone (see
              README → proxy for the keyless setup). Or skip and type the bill in.
            </p>
            <Field label="Anthropic API key" value={keyInput} onChange={setKeyInput} type="password" placeholder="sk-ant-…" />
            <Button
              className="mt-3 w-full"
              disabled={!keyInput.trim().startsWith("sk-ant-")}
              onClick={() => setSettings({ apiKey: keyInput.trim() })}
            >
              Save key
            </Button>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
        />

        {preview ? (
          <div className="pop-in flex flex-1 flex-col gap-3">
            <div className="relative flex-1 overflow-hidden rounded-3xl bg-card">
              <img src={preview} alt="Receipt preview" className="absolute inset-0 size-full object-contain" />
              {busy && (
                <div className="absolute inset-0 grid place-items-center bg-bg/60 backdrop-blur-sm">
                  <div className="text-center">
                    <div className="shimmer text-4xl">🧾</div>
                    <div className="mt-2 font-medium">Reading the receipt…</div>
                    <div className="text-sm text-dim">items, tax, tip, total</div>
                  </div>
                </div>
              )}
            </div>
            {notice && (
              <div className="pop-in rounded-2xl border border-danger/40 bg-danger/10 p-3.5 text-sm text-ink">
                <span className="mr-1.5">🤔</span>
                {notice}
              </div>
            )}
            <div className="flex gap-2">
              <Button kind="ghost" className="flex-1" onClick={() => fileRef.current?.click()} disabled={busy}>
                Retake
              </Button>
              <Button className="flex-[2]" onClick={parse} disabled={busy || needsKey}>
                {busy ? "Reading…" : "Read it →"}
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="group relative flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border-2 border-dashed border-accent/50 bg-card/60 transition-colors active:bg-card"
          >
            {/* corner ticks — camera-viewfinder feel */}
            <span className="absolute left-4 top-4 size-6 rounded-tl-lg border-l-[3px] border-t-[3px] border-accent/70" />
            <span className="absolute right-4 top-4 size-6 rounded-tr-lg border-r-[3px] border-t-[3px] border-accent/70" />
            <span className="absolute bottom-4 left-4 size-6 rounded-bl-lg border-b-[3px] border-l-[3px] border-accent/70" />
            <span className="absolute bottom-4 right-4 size-6 rounded-br-lg border-b-[3px] border-r-[3px] border-accent/70" />

            {/* receipt silhouette */}
            <div className="flex w-32 flex-col gap-2 rounded-lg border-2 border-dashed border-line bg-bg/70 p-3 opacity-80">
              <div className="mx-auto h-1.5 w-16 rounded bg-line" />
              <div className="h-1 w-full rounded bg-line" />
              <div className="h-1 w-3/4 rounded bg-line" />
              <div className="h-1 w-full rounded bg-line" />
              <div className="h-1 w-2/3 rounded bg-line" />
              <div className="mx-auto mt-1 h-1.5 w-12 rounded bg-line" />
            </div>
            <div className="text-center">
              <div className="font-display text-lg font-bold">Fit the receipt in the frame</div>
              <div className="mt-1 text-sm text-dim">flat on the table · good light · total in view</div>
            </div>
            <span className="rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink transition-transform group-active:scale-95">
              📸 Open camera
            </span>
          </button>
        )}

        <button onClick={manual} className="pb-2 text-center text-sm text-dim underline decoration-dotted">
          No photo — type or dictate the bill instead
        </button>
      </div>
    </div>
  );
}

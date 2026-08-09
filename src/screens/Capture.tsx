import { useRef, useState } from "react";
import { useStore } from "../store";
import { go } from "../router";
import { parseReceipt, friendlyError } from "../ai";
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const needsKey = !settings.apiKey;

  const pick = (f: File) => {
    setFile(f);
    setError(null);
    const r = new FileReader();
    r.onload = () => setPreview(r.result as string);
    r.readAsDataURL(f);
  };

  const parse = async () => {
    if (!file || !settings.apiKey) return;
    setBusy(true);
    setError(null);
    try {
      const b64 = await toJpegBase64(file);
      const { bill } = await parseReceipt(settings.apiKey, b64, "image/jpeg");
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
      go("/review");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const manual = () => {
    setDraft(emptyBill(settings.name));
    go("/review");
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <TopBar title="Snap the bill" back={() => go("/")} />
      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        {needsKey && (
          <div className="rounded-2xl border border-amber/40 bg-amber/5 p-4">
            <div className="mb-1 font-semibold">One-time setup for scanning</div>
            <p className="mb-3 text-sm text-dim">
              Reading receipts uses Claude. Paste an Anthropic API key — it stays on <em>this phone only</em>{" "}
              (guests never need one). Or skip and type the bill in.
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
          <div className="flex flex-1 flex-col gap-3">
            <img src={preview} alt="Receipt preview" className="max-h-[50vh] w-full rounded-2xl object-contain bg-card" />
            {error && <div className="rounded-xl border border-coral/40 bg-coral/10 p-3 text-sm text-coral">{error}</div>}
            <div className="mt-auto flex gap-2">
              <Button kind="ghost" className="flex-1" onClick={() => fileRef.current?.click()} disabled={busy}>
                Retake
              </Button>
              <Button className="flex-[2]" onClick={parse} disabled={busy || needsKey}>
                {busy ? "Reading receipt…" : "Read it →"}
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="grid flex-1 place-items-center rounded-3xl border-2 border-dashed border-line bg-card/50 active:bg-card"
          >
            <div className="text-center">
              <div className="text-5xl">📸</div>
              <div className="mt-2 font-semibold">Tap to photograph the receipt</div>
              <div className="mt-1 text-sm text-dim">flat on the table, all of it in frame</div>
            </div>
          </button>
        )}

        <button onClick={manual} className="pb-2 text-center text-sm text-dim underline decoration-dotted">
          No photo — type the bill in instead
        </button>
      </div>
    </div>
  );
}

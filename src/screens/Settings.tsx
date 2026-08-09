import { useState } from "react";
import { useStore } from "../store";
import { go } from "../router";
import { hasProxy } from "../ai";
import { Button, Field, TopBar } from "../components/ui";

export function Settings() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [saved, setSaved] = useState(false);
  const [local, setLocal] = useState(settings);

  const save = () => {
    setSettings(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <TopBar title="Settings" back={() => go("/")} />
      <div className="flex-1 space-y-6 px-5 py-5">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-dim">You</h2>
          <Field label="Your name" value={local.name} onChange={(v) => setLocal({ ...local, name: v })} placeholder="Das" />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-dim">How friends pay you</h2>
          <p className="-mt-2 text-sm text-dim">
            Saved once, attached to every bill you host — guests get one-tap pay buttons with the amount filled in.
            Money never moves through this app.
          </p>
          <Field label="Venmo username" value={local.venmo} onChange={(v) => setLocal({ ...local, venmo: v })} placeholder="das-pays" />
          <Field label="Cash App cashtag" value={local.cashapp} onChange={(v) => setLocal({ ...local, cashapp: v })} placeholder="daspays" />
          <Field label="Zelle (phone or email)" value={local.zelle} onChange={(v) => setLocal({ ...local, zelle: v })} placeholder="555-014-2222" inputMode="tel" />
          <Field label="PayPal.me name" value={local.paypal} onChange={(v) => setLocal({ ...local, paypal: v })} placeholder="daspays" />
        </section>

        {hasProxy() ? (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-dim">Receipt scanning</h2>
            <p className="-mt-1 text-sm text-dim">
              ✓ Scanning is built in for everyone on this site — no key, no setup, nothing to do here.
            </p>
          </section>
        ) : (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-dim">Receipt scanning (dev)</h2>
            <p className="-mt-2 text-sm text-dim">
              This build has no scan proxy configured, so scanning needs an Anthropic API key stored on this phone. See
              the README's proxy section to make scanning free for everyone.
            </p>
            <Field
              label="Anthropic API key"
              value={local.apiKey}
              onChange={(v) => setLocal({ ...local, apiKey: v })}
              type="password"
              placeholder="sk-ant-…"
            />
          </section>
        )}

        <Button className="w-full py-4" onClick={save}>
          {saved ? "Saved ✓" : "Save"}
        </Button>

        <p className="pb-6 text-center text-xs text-dim/60">
          Everything in this app — your bills, picks, handles, key — lives on this device. Clearing browser data
          erases it, so keep bill links you care about.
        </p>
      </div>
    </div>
  );
}

import { useRef, useState } from "react";
import { listen, speechAvailable, type Listener } from "../speech";

/**
 * Voice + text edits: "the wings were actually 14.50", "remove one soda",
 * "add a thai tea for six bucks". Submits the instruction to Claude, which
 * returns the corrected bill.
 */
export function CommandBar({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (instruction: string) => void;
}) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const listenerRef = useRef<Listener | null>(null);
  const hasMic = speechAvailable();

  const stopMic = () => {
    listenerRef.current?.stop();
    listenerRef.current = null;
    setRecording(false);
  };

  const startMic = () => {
    if (recording) {
      stopMic();
      return;
    }
    const l = listen(
      (t, isFinal) => {
        setText(t);
        if (isFinal && t) {
          stopMic();
          onSubmit(t);
          setText("");
        }
      },
      () => setRecording(false),
    );
    if (l) {
      listenerRef.current = l;
      setRecording(true);
    }
  };

  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    onSubmit(t);
    setText("");
  };

  return (
    <div className="flex items-center gap-2">
      {hasMic && (
        <button
          onClick={startMic}
          disabled={busy}
          aria-label={recording ? "Stop listening" : "Speak an edit"}
          className={`grid size-12 shrink-0 place-items-center rounded-full border transition-colors ${
            recording ? "border-danger bg-danger/20 text-danger" : "border-line bg-card-hi text-dim active:text-ink"
          }`}
        >
          {recording ? (
            <span className="size-3.5 rounded-sm bg-danger" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z" />
              <path d="M19 11a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V22h2v-2.06A9 9 0 0 0 21 11h-2z" />
            </svg>
          )}
        </button>
      )}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        disabled={busy}
        placeholder={recording ? "Listening…" : 'Fix anything… "wings were 14.50"'}
        className={`min-w-0 flex-1 rounded-full border border-line bg-card-hi px-4 py-3 text-ink placeholder:text-dim/60 focus:border-accent focus:outline-none ${busy ? "shimmer" : ""}`}
      />
      <button
        onClick={submit}
        disabled={busy || !text.trim()}
        aria-label="Apply edit"
        className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-accent-ink disabled:opacity-30"
      >
        {busy ? (
          <span className="size-4 animate-spin rounded-full border-2 border-accent-ink/30 border-t-accent-ink" />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </div>
  );
}

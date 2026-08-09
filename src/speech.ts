/**
 * Thin wrapper over the Web Speech API. Chrome/Android and iOS Safari 14.5+
 * expose webkitSpeechRecognition; where it's missing the mic button simply
 * doesn't render and typing is the path.
 */

type AnySpeechRecognition = {
  new (): {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
    onerror: ((e: unknown) => void) | null;
    onend: (() => void) | null;
  };
};

function getCtor(): AnySpeechRecognition | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition as AnySpeechRecognition) || (w.webkitSpeechRecognition as AnySpeechRecognition) || null;
}

export function speechAvailable(): boolean {
  return getCtor() !== null;
}

export interface Listener {
  stop: () => void;
}

export function listen(
  onText: (text: string, isFinal: boolean) => void,
  onEnd: () => void,
): Listener | null {
  const Ctor = getCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = navigator.language || "en-US";
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (e) => {
    let text = "";
    let final = false;
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      text += r[0].transcript;
      if (r.isFinal) final = true;
    }
    onText(text.trim(), final);
  };
  rec.onerror = () => onEnd();
  rec.onend = () => onEnd();
  try {
    rec.start();
  } catch {
    return null;
  }
  return { stop: () => rec.stop() };
}

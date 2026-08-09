import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { Bill } from "../types";
import { roomUrl } from "../codec";
import { evenShare, formatCents } from "../split";
import { Sheet, Button } from "./ui";

export function ShareSheet({ open, onClose, bill }: { open: boolean; onClose: () => void; bill: Bill }) {
  const [qr, setQr] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const url = roomUrl(bill);

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(url, {
      margin: 1,
      width: 480,
      errorCorrectionLevel: "M",
      color: { dark: "#4a3e37", light: "#fffdf9" },
    })
      .then(setQr)
      .catch(() => setQr(""));
  }, [open, url]);

  const message = `🧾 ${bill.title} — tap what you ate and it totals you up (even split is ${formatCents(
    evenShare(bill),
  )}):\n${url}`;

  const share = () => {
    if (navigator.share) {
      navigator.share({ text: message }).catch(() => {});
    } else {
      copy();
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <h2 className="mb-1 text-xl font-bold">Send to the table</h2>
      <p className="mb-4 text-sm text-dim">
        The link carries the whole bill — anyone who opens it can pick their items. No app, no signup.
      </p>
      {qr && (
        <div className="mb-4 flex justify-center">
          <img src={qr} alt="Room QR code" className="w-56 rounded-2xl" />
        </div>
      )}
      <div className="flex gap-2">
        <Button kind="ghost" className="flex-1" onClick={copy}>
          {copied ? "Copied ✓" : "Copy link"}
        </Button>
        <Button className="flex-1" onClick={share}>
          Share
        </Button>
      </div>
    </Sheet>
  );
}

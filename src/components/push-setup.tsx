"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State =
  | { kind: "unsupported" }
  | { kind: "needs-install" }
  | { kind: "blocked" }
  | { kind: "prompt" }
  | { kind: "subscribed" };

export function PushSetup() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState({ kind: "unsupported" });
        return;
      }
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS && !standalone) {
        setState({ kind: "needs-install" });
        return;
      }

      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        if (Notification.permission === "denied") {
          setState({ kind: "blocked" });
        } else if (sub && Notification.permission === "granted") {
          setState({ kind: "subscribed" });
        } else {
          setState({ kind: "prompt" });
        }
      } catch (e) {
        console.error(e);
        setState({ kind: "unsupported" });
      }
    })();
  }, []);

  async function subscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState({ kind: "blocked" });
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        ),
      });
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });
      setState({ kind: "subscribed" });
    } finally {
      setBusy(false);
    }
  }

  if (!state || state.kind === "subscribed") return null;

  if (state.kind === "unsupported") {
    return (
      <div className="card bg-[var(--warning-soft)] text-[var(--warning)]">
        הדפדפן הזה לא תומך בהתראות. נסה בדפדפן חדש יותר.
      </div>
    );
  }

  if (state.kind === "needs-install") {
    return (
      <div className="card bg-[var(--primary-soft)] border-[var(--primary)] space-y-2">
        <h3 className="font-bold text-lg">להפעלת התראות באייפון</h3>
        <ol className="list-decimal pr-5 text-base space-y-1">
          <li>פתח את האתר ב-Safari (לא בכרום)</li>
          <li>גע בכפתור השיתוף בתחתית המסך</li>
          <li>בחר &quot;הוספה למסך הבית&quot;</li>
          <li>פתח את האפליקציה ממסך הבית</li>
        </ol>
      </div>
    );
  }

  if (state.kind === "blocked") {
    return (
      <div className="card bg-[var(--danger-soft)] text-[var(--danger)]">
        ההתראות חסומות. אפשר אותן בהגדרות הדפדפן.
      </div>
    );
  }

  return (
    <div className="card bg-[var(--primary-soft)] border-[var(--primary)] flex items-center justify-between gap-3">
      <div>
        <h3 className="font-bold text-lg">הפעלת תזכורות</h3>
        <p className="text-base">קבל התראה כשהגיע הזמן לקחת תרופה.</p>
      </div>
      <button onClick={subscribe} disabled={busy} className="btn-primary">
        {busy ? "..." : "הפעל"}
      </button>
    </div>
  );
}

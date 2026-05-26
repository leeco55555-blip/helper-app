"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Role = "patient" | "family";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupInner />
    </Suspense>
  );
}

function SignupInner() {
  const router = useRouter();
  const params = useSearchParams();
  const inviteToken = params.get("invite");

  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error || !data.user) {
      setLoading(false);
      setError(error?.message ?? "שגיאה בהרשמה");
      return;
    }

    // If email confirmation is disabled in Supabase, we already have a session.
    // If it's enabled, signUp returns a user but no session — we'll still try to sign in.
    if (!data.session) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInErr) {
        setLoading(false);
        setError("יש לאשר את האימייל. בדוק את תיבת הדואר שלך.");
        return;
      }
    }

    // Create the profile and (if patient) the patient row, server-side.
    const res = await fetch("/api/auth/finalize-signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        full_name: fullName,
        phone: phone || null,
        role_type: role,
        invite_token: inviteToken,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "שגיאה ביצירת הפרופיל");
      return;
    }

    const j = await res.json();
    router.replace(j.redirect || "/today");
    router.refresh();
  }

  if (!role) {
    return (
      <main className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-md mx-auto w-full gap-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">הרשמה</h1>
            <p className="text-[var(--muted)] text-lg">קודם כל — מי אתה?</p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setRole("patient")}
              className="card text-right hover:border-[var(--primary)] transition flex flex-col gap-2 cursor-pointer"
            >
              <div className="text-2xl font-bold">אני המטופל</div>
              <div className="text-[var(--muted)] text-lg">
                אני רוצה לעקוב אחרי התרופות, הבדיקות והאימונים שלי
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRole("family")}
              className="card text-right hover:border-[var(--primary)] transition flex flex-col gap-2 cursor-pointer"
            >
              <div className="text-2xl font-bold">אני בן משפחה</div>
              <div className="text-[var(--muted)] text-lg">
                אני רוצה לעזור לבן משפחה לעקוב אחרי הטיפול שלו
              </div>
            </button>
          </div>

          <p className="text-center text-lg">
            כבר יש לך חשבון?{" "}
            <Link href="/login" className="text-[var(--primary)] font-semibold underline">כניסה</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-md mx-auto w-full gap-6">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setRole(null)}
            className="text-[var(--primary)] text-base mb-3"
          >
            ← חזרה
          </button>
          <h1 className="text-3xl font-bold">
            {role === "patient" ? "הרשמה כמטופל" : "הרשמה כבן משפחה"}
          </h1>
          <p className="text-[var(--muted)] text-lg">פרטים בסיסיים. תוכל לערוך אחר כך.</p>
        </div>

        <form onSubmit={onSubmit} className="card flex flex-col gap-4">
          <div>
            <label className="label" htmlFor="name">שם מלא</label>
            <input
              id="name"
              type="text"
              required
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="שם פרטי ומשפחה"
            />
          </div>

          <div>
            <label className="label" htmlFor="email">אימייל</label>
            <input
              id="email"
              type="email"
              required
              inputMode="email"
              className="input"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label className="label" htmlFor="phone">טלפון (לא חובה)</label>
            <input
              id="phone"
              type="tel"
              className="input"
              dir="ltr"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05X-XXXXXXX"
            />
          </div>

          <div>
            <label className="label" htmlFor="password">סיסמא</label>
            <input
              id="password"
              type="password"
              required
              minLength={1}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-sm text-[var(--muted)] mt-2">
              הסיסמא הראשונית היא <strong>1</strong>. מומלץ לשנות בהגדרות.
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-[var(--danger-soft)] text-[var(--danger)] px-4 py-3 text-base font-medium">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "מבצע..." : "יצירת חשבון"}
          </button>
        </form>
      </div>
    </main>
  );
}

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/today";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message === "Invalid login credentials"
        ? "אימייל או סיסמא לא נכונים"
        : error.message);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <main className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-md mx-auto w-full gap-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">כניסה</h1>
          <p className="text-[var(--muted)] text-lg">ברוכים השבים</p>
        </div>

        <form onSubmit={onSubmit} className="card flex flex-col gap-4">
          <div>
            <label className="label" htmlFor="email">אימייל</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
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
            <label className="label" htmlFor="password">סיסמא</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-xl bg-[var(--danger-soft)] text-[var(--danger)] px-4 py-3 text-base font-medium">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "מתחבר..." : "כניסה"}
          </button>
        </form>

        <p className="text-center text-lg">
          אין לך חשבון?{" "}
          <Link href="/signup" className="text-[var(--primary)] font-semibold underline">הרשמה</Link>
        </p>
      </div>
    </main>
  );
}

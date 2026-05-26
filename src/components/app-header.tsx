"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AppHeader({ title, backHref }: { title: string; backHref?: string }) {
  const router = useRouter();
  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <header className="sticky top-0 z-10 bg-[var(--background)]/95 backdrop-blur border-b border-[var(--border)]">
      <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {backHref && (
            <Link href={backHref} className="btn-ghost px-2" aria-label="חזרה">
              <span aria-hidden>→</span>
            </Link>
          )}
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
        <button onClick={logout} className="btn-ghost text-base">יציאה</button>
      </div>
    </header>
  );
}

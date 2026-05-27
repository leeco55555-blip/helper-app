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
    <header className="sticky top-0 z-10 bg-[var(--background)]/85 backdrop-blur-md">
      <div className="max-w-2xl mx-auto px-4 pt-3 pb-2 flex flex-col gap-2">
        <div className="flex items-center justify-between min-h-[40px]">
          {backHref ? (
            <Link href={backHref} className="btn-ghost px-2" aria-label="חזרה">
              <span aria-hidden className="text-xl">→</span>
            </Link>
          ) : (
            <span />
          )}
          <button onClick={logout} className="btn-ghost text-[var(--muted-strong)]">
            יציאה
          </button>
        </div>
        <h1 className="page-title pb-1 truncate">{title}</h1>
      </div>
    </header>
  );
}

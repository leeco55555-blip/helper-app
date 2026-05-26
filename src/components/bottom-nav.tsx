"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/today", label: "היום", icon: "🏠" },
  { href: "/schedules", label: "לו״ז", icon: "📋" },
  { href: "/family", label: "משפחה", icon: "👨‍👩‍👧" },
  { href: "/settings", label: "הגדרות", icon: "⚙️" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-[var(--border)] bg-[var(--surface)]">
      <ul className="max-w-2xl mx-auto grid grid-cols-4">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/") || pathname.startsWith(t.href + "?");
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`flex flex-col items-center justify-center gap-1 py-3 text-sm font-medium ${
                  active ? "text-[var(--primary)]" : "text-[var(--muted)]"
                }`}
              >
                <span className="text-2xl" aria-hidden>{t.icon}</span>
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

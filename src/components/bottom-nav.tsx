"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/today", label: "היום", icon: "🏠" },
  { href: "/tomorrow", label: "מחר", icon: "📅" },
  { href: "/schedules", label: "לו״ז", icon: "📋" },
  { href: "/history", label: "היסטוריה", icon: "📊" },
  { href: "/stats", label: "סטטיסטיקה", icon: "📈" },
  { href: "/settings", label: "הגדרות", icon: "⚙️" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-20"
      style={{
        background: "color-mix(in oklab, var(--surface) 92%, transparent)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 -1px 2px rgba(15,17,21,0.04), 0 -8px 24px rgba(15,17,21,0.06)",
      }}
    >
      <ul className="max-w-2xl mx-auto grid grid-cols-6 px-1 pt-2 pb-3 gap-0.5">
        {TABS.map((t) => {
          const active =
            pathname === t.href ||
            pathname.startsWith(t.href + "/") ||
            pathname.startsWith(t.href + "?");
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                prefetch
                className="flex flex-col items-center justify-center gap-0.5 px-1 py-2 rounded-2xl text-[11px] font-semibold transition"
                style={{
                  color: active ? "var(--primary)" : "var(--muted)",
                  background: active ? "var(--primary-soft)" : "transparent",
                }}
              >
                <span className="text-2xl leading-none" aria-hidden>{t.icon}</span>
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

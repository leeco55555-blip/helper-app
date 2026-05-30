import { AppHeader } from "@/components/app-header";
import { OccurrencesSkeleton } from "@/components/occurrences-skeleton";

export default function Loading() {
  return (
    <main className="flex-1 flex flex-col pb-28">
      <AppHeader title="ניהול לו״ז" />
      <OccurrencesSkeleton />
    </main>
  );
}

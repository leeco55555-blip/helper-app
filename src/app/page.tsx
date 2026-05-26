import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/today");

  return (
    <main className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-xl mx-auto text-center gap-8">
        <div className="size-20 rounded-3xl bg-[var(--primary)] grid place-items-center text-white text-3xl font-bold">
          תז
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-balance">תזכורת</h1>
          <p className="text-xl text-[var(--muted)] text-balance">
            לא לשכוח לקחת תרופות, למדוד לחץ דם, ולהתאמן.
            <br />
            עבורך — ועבור היקרים לך.
          </p>
        </div>
        <div className="w-full flex flex-col gap-3 pt-4">
          <Link href="/signup" className="btn-primary w-full">התחלה — יצירת חשבון</Link>
          <Link href="/login" className="btn-secondary w-full">כבר יש לי חשבון</Link>
        </div>
      </div>
    </main>
  );
}

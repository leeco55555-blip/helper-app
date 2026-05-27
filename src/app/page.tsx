import Link from "next/link";
import Image from "next/image";
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
        <Image
          src="/icons/icon-512.png"
          alt="עוזר אישי"
          width={96}
          height={96}
          className="rounded-3xl shadow-lg"
          priority
        />
        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-balance">עוזר אישי</h1>
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

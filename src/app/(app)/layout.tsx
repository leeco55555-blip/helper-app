import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/bottom-nav";
import { PushSetup } from "@/components/push-setup";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <>
      <div className="flex-1 flex flex-col">{children}</div>
      <div className="fixed bottom-20 inset-x-0 px-4 z-10 pointer-events-none">
        <div className="max-w-2xl mx-auto pointer-events-auto">
          <PushSetup />
        </div>
      </div>
      <BottomNav />
    </>
  );
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({
  status: z.enum(["pending", "taken", "skipped"]),
  values: z.array(z.number()).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad input" }, { status: 400 });
  }
  const { status, values } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const update: Record<string, unknown> = { status };
  if (status === "taken") {
    update.taken_at = new Date().toISOString();
    update.taken_by_profile_id = user.id;
    if (values) update.measurement_values = values;
  } else {
    update.taken_at = null;
    update.taken_by_profile_id = null;
    if (status === "pending") update.measurement_values = null;
  }

  const { error } = await supabase
    .from("schedule_occurrences")
    .update(update)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

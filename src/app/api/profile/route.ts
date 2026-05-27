import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const TimeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const Body = z.object({
  default_times: z
    .object({
      morning: z.string().regex(TimeRe),
      noon: z.string().regex(TimeRe),
      evening: z.string().regex(TimeRe),
    })
    .optional(),
  full_name: z.string().min(1).optional(),
});

export async function PATCH(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

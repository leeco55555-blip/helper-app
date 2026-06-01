import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { getPatientRole, roleAtLeast } from "@/lib/schedules/access";

const Guest = z.object({
  name: z.string().trim().max(120).default(""),
  email: z.string().trim().toLowerCase().email(),
});

const Body = z.object({
  guests: z.array(Guest).max(50),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!roleAtLeast(await getPatientRole(id), "editor")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  // De-duplicate by email, keeping the last name provided.
  const byEmail = new Map<string, { name: string; email: string }>();
  for (const g of parsed.data.guests) byEmail.set(g.email, g);
  const guests = [...byEmail.values()];

  const svc = createServiceClient();
  const { error } = await svc
    .from("patients")
    .update({ default_calendar_guests: guests })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, guests });
}

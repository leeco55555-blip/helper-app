import { createClient } from "@/lib/supabase/server";

export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return profile ? { user, profile } : { user, profile: null };
}

export async function requireProfile() {
  const result = await getCurrentProfile();
  if (!result?.user) throw new Error("UNAUTHENTICATED");
  return result;
}

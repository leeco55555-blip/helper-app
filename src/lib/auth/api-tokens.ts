import { createHash } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function verifyApiToken(req: Request, requiredScope: string) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return { ok: false as const, error: "missing token", status: 401 };
  const raw = m[1].trim();
  const hash = hashToken(raw);

  const svc = createServiceClient();
  const { data: row } = await svc
    .from("api_tokens")
    .select("*")
    .eq("token_hash", hash)
    .maybeSingle();

  if (!row) return { ok: false as const, error: "invalid token", status: 401 };
  if (row.revoked_at) return { ok: false as const, error: "revoked", status: 401 };
  if (!Array.isArray(row.scopes) || !row.scopes.includes(requiredScope)) {
    return { ok: false as const, error: "insufficient scope", status: 403 };
  }

  await svc.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
  return { ok: true as const, token: row };
}

export { hashToken };

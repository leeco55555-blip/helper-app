import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/server";

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_MAILTO || "mailto:admin@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  occurrence_id?: string;
  tag?: string;
  actions?: { action: string; title: string }[];
};

export async function sendPushToProfile(profileId: string, payload: PushPayload) {
  configure();
  const svc = createServiceClient();
  const { data: subs } = await svc
    .from("push_subscriptions")
    .select("*")
    .eq("profile_id", profileId);

  if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

  const json = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const toDelete: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json,
        );
        sent++;
        await svc.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", s.id);
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        failed++;
        if (status === 404 || status === 410) toDelete.push(s.id);
      }
    }),
  );

  if (toDelete.length) {
    await svc.from("push_subscriptions").delete().in("id", toDelete);
  }

  return { sent, failed };
}
